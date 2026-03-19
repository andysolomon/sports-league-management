# TeamSnap Competitive Analysis

**sprtsmng — Can We Compete on Cost?**
*Last updated: 2026-03-19*

---

## 1. Executive Summary

sprtsmng can compete with TeamSnap on price. The Plus tier ($4.99/mo) undercuts TeamSnap Premium ($10/mo) by 59%, and the League tier ($499/yr) undercuts TeamSnap's opaque club/league pricing. Salesforce's fixed-cost licensing model means per-user infrastructure cost is near zero once past the licensing floor of ~$350-450/month — margins converge with TeamSnap's commodity-cloud economics by ~500 paid users and exceed them at scale. The real competitive advantage is not COGS arbitrage but dual-channel distribution (standalone SaaS + AppExchange) that TeamSnap cannot replicate.

---

## 2. Head-to-Head Pricing (What Customers Pay)

Sources: [TeamSnap pricing](https://teamsnap.com/pricing/teams) (March 2026), sprtsmng tiers from [monetization.md](../market-insights/monetization.md).

| Tier | TeamSnap | sprtsmng | Delta |
|------|----------|----------|-------|
| **Free** | $0 (up to 15 players) | $0 (1 team, 50 players) | sprtsmng more generous |
| **Entry paid** | $10/mo annual ($120/yr) Premium | $4.99/mo ($49/yr) Plus | **sprtsmng 59% cheaper** |
| **Mid-tier** | $12.50/mo annual ($150/yr) Ultra | $19.99/mo ($199/yr) Club | TeamSnap 37% cheaper |
| **League/Org** | Custom (opaque, est. $1K-5K+/yr) | $49.99/mo ($499/yr) League | **sprtsmng likely cheaper + transparent** |

### Tier-Level Notes

- **Free tier:** sprtsmng's 50-player limit is 3.3x TeamSnap's 15-player cap — a stronger freemium hook for small leagues.
- **Plus vs. Premium:** The 59% price gap is the primary acquisition lever. Plus includes unlimited teams; TeamSnap Premium is still single-team.
- **Club vs. Ultra:** sprtsmng is $50/yr more expensive, but Club includes multi-admin, analytics, and custom branding that TeamSnap reserves for its custom club/league pricing tier.
- **League vs. Club/League custom:** TeamSnap hides pricing behind "contact sales." sprtsmng's transparent $499/yr is a strong positioning choice for price-sensitive league administrators who distrust opaque sales processes.

---

## 3. Infrastructure Cost Comparison (What You Pay to Run It)

### Path A: Own Production Salesforce Org (Recommended for Standalone SaaS)

The BFF architecture means only operators and the integration service user need Salesforce licenses. External app users authenticate via Clerk and never touch Salesforce.

| Expense | Monthly | Annual | Notes |
|---------|---------|--------|-------|
| Salesforce (3-4 Platform Plus licenses) | $300-400 | $3,600-4,800 | Integration user + 2-3 operators |
| Vercel Pro | $20 | $240 | Covers most production traffic |
| Clerk | $0-25 | $0-300 | Free up to 10K MAUs |
| Stripe processing | 2.9% + $0.30 | Variable | Pass-through to customers |
| Domain/DNS | ~$2 | ~$24 | Minimal |
| **Total fixed** | **$322-447** | **$3,864-5,364** | |

API ceiling on Enterprise Edition: **100,000 calls/day** base + 1,000 per license. At ~10-15 API calls per user session, that supports ~7,000-10,000 user sessions/day (**15,000-25,000 MAU** raw, **50,000-100,000 MAU** with Composite API + BFF caching).

### Path B: OEM Embedded (AppExchange / ISV Route)

| Expense | Rate | Notes |
|---------|------|-------|
| OEM licenses | $25/user/month | Only for users who need a Salesforce login |
| Revenue share to Salesforce | **25% of revenue** | OEM Embedded model |

Lower floor but 25% revenue tax at scale. At $150K/mo revenue (10K paid users), that's $37,500/mo to Salesforce.

### Path C: What TeamSnap Probably Pays

TeamSnap runs on commodity cloud infrastructure (AWS/GCP equivalent):

| Expense | Per-User/Mo | Notes |
|---------|-------------|-------|
| Compute/hosting | $0.10-0.50 | Standard cloud |
| Database (managed Postgres) | $0.05-0.20 | Co-located, sub-5ms reads |
| CDN/storage | $0.02-0.10 | S3 + CloudFront equivalent |
| **Est. COGS per user** | **$0.20-0.80** | ~5-8% of revenue |

TeamSnap's marginal cost per user is near zero. That is the fundamental difference.

---

## 4. Margin Comparison at Scale

### At 100 Paid Users (~$1,500/mo revenue)

| | sprtsmng Path A | sprtsmng Path B | TeamSnap (est.) |
|--|-----------------|-----------------|-----------------|
| Infrastructure | ~$350/mo | ~$100/mo base | ~$50/mo |
| Revenue share | $0 | $375/mo (25%) | $0 |
| **Total COGS** | **$350** | **$475** | **~$50** |
| **Gross margin** | **77%** | **68%** | **~97%** |

### At 1,000 Paid Users (~$15,000/mo revenue)

| | sprtsmng Path A | sprtsmng Path B | TeamSnap (est.) |
|--|-----------------|-----------------|-----------------|
| Infrastructure | ~$450/mo | ~$200/mo base | ~$400/mo |
| Revenue share | $0 | $3,750/mo | $0 |
| **Total COGS** | **$450** | **$3,950** | **~$400** |
| **Gross margin** | **97%** | **74%** | **~97%** |

### At 10,000 Paid Users (~$150,000/mo revenue)

| | sprtsmng Path A | sprtsmng Path B | TeamSnap (est.) |
|--|-----------------|-----------------|-----------------|
| Infrastructure | ~$800/mo | ~$500/mo base | ~$3,000/mo |
| Revenue share | $0 | $37,500/mo | $0 |
| **Total COGS** | **$800** | **$38,000** | **~$3,000** |
| **Gross margin** | **99%+** | **75%** | **~98%** |
| API calls/day | ~45K (within 100K limit) | N/A | No limit |

**Key finding:** On Path A, Salesforce cost is mostly **fixed**. It barely changes whether you have 100 or 10,000 users because only operators need licenses. Margins *improve* as you scale — until you hit the API ceiling.

**On Path B (OEM/ISV), the 25% revenue share costs $37,500/month at 10K users.** Avoid this path for the standalone SaaS channel; reserve it for AppExchange distribution only.

---

## 5. Scalability Walls

### Wall 1: API Call Limit (~15,000-25,000 MAUs raw)

Enterprise Edition gives ~100K API calls/day. At ~7 calls per session (see [backend-comparison.md](backend-comparison.md#7-api-call-budget-analysis)):

| Mitigation | Multiplier | Effective Ceiling |
|------------|-----------|-------------------|
| Raw (no optimization) | 1x | ~15K MAU |
| Composite API (batch reads) | ~4x | ~60K MAU |
| BFF caching (Redis/memory) | ~5x | ~75K MAU |
| Composite + caching combined | ~15-20x | **50K-100K MAU** |

With aggressive caching, a single Enterprise Edition org can realistically support 50,000-100,000 MAUs — covering Year 1 through Year 3 of the business plan.

### Wall 2: Latency Tax

| Operation | Salesforce | Commodity DB (Postgres) |
|-----------|-----------|------------------------|
| API round-trip | 100-300ms | 5-20ms |
| Cached read (BFF) | 1-5ms | 1-5ms |
| Write operation | 200-500ms | 10-30ms |

Caching neutralizes read latency. Writes remain slower. For a league management app (read-heavy, infrequent writes), this is acceptable. For real-time features (live scoring, chat), it is not.

### Wall 3: Governor Limits

Salesforce enforces per-transaction limits (100 SOQL queries, 150 DML statements, 6MB heap). The current layered architecture (service → repository pattern) handles this well for CRUD operations. Complex cross-league aggregations (standings across hundreds of teams) will hit limits that Postgres handles trivially.

---

## 6. Pros and Cons of Salesforce Backend for Competing with TeamSnap

### Why It Works

1. **Fixed cost advantage** — Infrastructure is ~$350-450/mo regardless of user count (to the API ceiling). At 1,000 paid users, margins match TeamSnap's.
2. **Enterprise features for free** — Audit trails, approval workflows, reporting, HIPAA-eligible storage, multi-tenant architecture. TeamSnap spent years building these.
3. **Dual-channel moat** — No TeamSnap competitor can also sell on AppExchange. That distribution channel is structurally unreachable without Salesforce expertise.
4. **CRM nature** — League operators on Salesforce get a unified experience for donors, volunteers, communications, and league management. TeamSnap is always a silo.
5. **Data model maturity** — 5 custom objects with 94% test coverage, interface-driven architecture, and 4 permission sets already rival what TeamSnap built internally over years.

### Why It's a Risk

1. **Higher floor** — Need ~25-50 paid users to cover Salesforce licensing. TeamSnap needs ~1 paid user. Pre-revenue burn matters for a solo founder.
2. **API ceiling** — Without optimization, capped at ~15-25K MAU. With optimization, ~50-100K MAU. TeamSnap has no architectural ceiling.
3. **Latency tax** — 100-300ms per Salesforce round-trip vs. 5-20ms for co-located Postgres. At scale, users notice TeamSnap is snappier (mitigated by BFF caching for reads).
4. **Vendor dependency** — Salesforce can raise prices annually (5-7% uplift is common). The entire backend cost is controlled by one vendor's pricing decisions.
5. **Engineering talent** — Salesforce/Apex developers are more expensive and harder to find than Node.js/Postgres developers. The talent pool is 10-20x smaller.

---

## 7. Verdict: Phased Strategy

### Phase 1 (0-1,000 users): Salesforce-only backend is fine

- Infrastructure cost: ~$350-450/mo fixed
- Break-even: ~25-50 paid users
- Gross margin at 100 paid users: ~77%
- Gross margin at 1,000 paid users: ~97%
- Focus on product-market fit, not infrastructure optimization

### Phase 2 (1,000-10,000 users): Add caching, optimize API usage

Introduce Redis/Upstash in the BFF to cache read-heavy data (rosters, schedules, standings). Extends Salesforce API runway by 3-5x.

- Infrastructure cost: ~$500-600/mo (adding cache)
- Gross margin at 5,000 paid users: ~96%

### Phase 3 (10,000+ users): Hybrid architecture

Move runtime read data to Neon Postgres. Salesforce becomes system of record for operators with sync to the runtime DB. Eliminates API ceiling and latency tax while keeping CRM benefits.

- Infrastructure cost: ~$1,000-2,000/mo (Salesforce + external DB + Vercel)
- Gross margin at 10,000 paid users: ~98%+

### The Bottom Line

TeamSnap has near-zero marginal infrastructure cost. sprtsmng can't match that at very small scale. But the **fixed cost model** means margins converge by ~500 paid users, and the **dual-channel distribution + enterprise features** give differentiation that TeamSnap cannot replicate.

**Compete on value, not on COGS.**

---

## 8. Sources

- [TeamSnap pricing — teams](https://teamsnap.com/pricing/teams) (March 2026)
- [TeamSnap pricing — clubs & leagues](https://www.teamsnap.com/leagues-and-clubs/plans-and-pricing) (March 2026)
- [Salesforce API limits](https://developer.salesforce.com/blogs/2024/11/api-limits-and-monitoring-your-api-usage) (November 2024)
- [Salesforce API limits cheatsheet](https://developer.salesforce.com/docs/atlas.en-us.242.0.salesforce_app_limits_cheatsheet.meta/salesforce_app_limits_cheatsheet/salesforce_app_limits_platform_api.htm)
- [Salesforce Platform pricing](https://www.salesforce.com/editions-pricing/platform/) (March 2026)
- [Salesforce ISV/OEM license comparison](https://developer.salesforce.com/docs/atlas.en-us.202.0.packagingGuide.meta/packagingGuide/oem_user_license_comparison.htm)
- sprtsmng internal: [monetization.md](../market-insights/monetization.md), [business-plan.md](../market-insights/business-plan.md), [competitors.md](../market-insights/competitors.md)
- sprtsmng internal: [backend-comparison.md](backend-comparison.md)

---

*This analysis is based on published pricing as of March 2026 and API call patterns observed in the sprtsmng codebase (`salesforce-api.ts`). TeamSnap infrastructure costs are estimates based on typical SaaS cloud economics.*
