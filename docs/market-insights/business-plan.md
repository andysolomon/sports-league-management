# sprtsmng — Business Plan

**Sports League Management Platform**
*Last updated: 2026-03-17*

---

## 1. Executive Summary

sprtsmng is a full-stack sports league management platform that combines a modern Next.js web application with Salesforce as the system of record. The product serves two distinct channels: a standalone SaaS application for league administrators, team managers, and fans, and a Salesforce AppExchange listing for organizations already invested in the Salesforce ecosystem.

The product is built and functional today — not a concept deck. Three development sprints have delivered a complete Salesforce backend (5 custom objects, layered service architecture, 94% test coverage, 60+ Apex tests), a Next.js 15 frontend with Clerk authentication and Google sign-in, Apex REST APIs, role-based permission sets, Playwright E2E tests, and a pnpm/Turborepo monorepo. The codebase has 24 merged pull requests across 17 completed user stories.

The sports management software market is dominated by standalone tools (TeamSnap, SportsEngine) that have no Salesforce integration, and legacy Salesforce apps (LeagueAthletics) with dated UIs. sprtsmng is the only product offering a modern React frontend backed by Salesforce data infrastructure, giving it a dual-channel advantage no competitor can easily replicate.

**Ask:** Pre-revenue. Seeking initial customers for the standalone SaaS product while preparing for AppExchange security review.

---

## 2. Problem & Opportunity

### The Problem

League administrators and team managers rely on fragmented tools to manage their organizations:

- **Spreadsheets and email** remain the default for small to mid-size leagues
- **Standalone tools** (TeamSnap, Heja) work well but offer no enterprise integration — organizations on Salesforce must maintain separate systems
- **Salesforce-native options** (LeagueAthletics) exist on AppExchange but have dated interfaces and limited multi-sport support
- **No solution bridges both worlds** — a modern consumer-grade experience backed by enterprise data infrastructure

### The Opportunity

| Market Signal | Evidence |
|---|---|
| Salesforce ecosystem demand | 150K+ Salesforce customers, AppExchange as major distribution channel |
| Gap in AppExchange offerings | Few quality sports management apps; LeagueAthletics reviews cite dated UI |
| Multi-sport need | Reddit threads and user feedback confirm single-sport tools frustrate multi-sport organizations |
| Modern UX expectations | Users expect mobile-responsive, fast interfaces — current SF-native options don't deliver |

The intersection of "Salesforce-first organizations that manage sports leagues" is underserved and growing as more nonprofits, schools, and community organizations adopt Salesforce.

---

## 3. Solution & Product

### Architecture

sprtsmng follows a **BFF (Backend-for-Frontend) architecture** with Salesforce as the system of record:

```
External Users (Fans, Team Managers)
        │
        ▼
Next.js 15 App (apps/web/)
├── Clerk Auth (Google SSO, email)
├── BFF API Routes (session validation)
└── Dashboard Pages (Teams, Players, Seasons, Divisions)
        │
        │ jsforce (JWT bearer flow)
        ▼
Salesforce Org
├── Apex REST API (/sportsmgmt/v1/*)
├── Service / Repository Layer
├── 5 Custom Objects (League, Team, Division, Season, Player)
└── Lightning Experience (Operators Only)
```

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 19, Tailwind CSS 4, TypeScript |
| Authentication | Clerk (Google SSO, email) |
| Backend / Data | Salesforce (Apex, LWC, Custom Objects) |
| Integration | jsforce (JWT bearer flow), Apex REST API |
| Shared Packages | `@sprtsmng/shared-types`, `@sprtsmng/api-contracts` (Zod) |
| Monorepo | pnpm workspaces + Turborepo |
| Testing | Playwright (E2E), Jest (LWC unit), Apex test framework |
| Hosting | Vercel (frontend), Salesforce (backend) |

### Key Differentiators

1. **Modular multi-sport architecture** — Core package (`sportsmgmt`) handles universal concepts; sport-specific packages (`sportsmgmt-football`) extend it. Any sport can be added without modifying the core.
2. **Dual interface** — External users get a modern React app with Google sign-in. League operators get the full Salesforce Lightning Experience for admin workflows.
3. **Enterprise-grade backend** — Salesforce provides HIPAA-eligible infrastructure, audit trails, reporting, and workflow automation out of the box.
4. **TypeScript end-to-end** — Shared type packages ensure API contract consistency between frontend and backend.

---

## 4. Market Analysis

### Competitive Landscape

| Competitor | Type | Price | Strengths | Weaknesses |
|---|---|---|---|---|
| **TeamSnap** | Standalone | $130/yr | Market leader, mobile-first | No Salesforce integration, no enterprise features |
| **SportsEngine** | Standalone | $58-69/mo | Enterprise focus, NBC Sports backing | Expensive, no Salesforce integration |
| **GameChanger** | Standalone | $100+/yr | Strong in baseball/softball | Single-sport, acquired by DICK'S (limited roadmap) |
| **Heja** | Standalone | Free/$5/mo | Modern UI, free tier | No Salesforce, limited admin features |
| **LeagueAthletics** | AppExchange | $49/mo | Established on AppExchange | Dated UI, limited sport coverage |

### Market Gaps We Exploit

1. **Salesforce-first organizations** — Orgs already on Salesforce want integrated solutions, not another standalone tool
2. **Multi-sport support** — Most competitors are single-sport focused; organizations managing multiple sports need one platform
3. **Modern UI on AppExchange** — The AppExchange sports category has few options and none with modern LWC + React interfaces
4. **Dual-channel distribution** — No competitor serves both standalone SaaS and AppExchange markets simultaneously

### Target Segments

| Segment | Size | Channel | Willingness to Pay |
|---|---|---|---|
| Youth sports leagues | Large | Standalone SaaS | Low-Medium ($5-20/mo) |
| School athletic departments | Medium | Both | Medium ($20-50/mo) |
| Community sports organizations on Salesforce | Small but high-value | AppExchange | High ($50-500/mo) |
| Nonprofits on Salesforce (sports-oriented) | Small | AppExchange | Medium (Salesforce.org discounts) |

---

## 5. Business Model

### Revenue Streams

#### Primary: SaaS Subscriptions (Standalone Web App)

| Tier | Price | Features |
|---|---|---|
| **Free** | $0/mo | 1 team, 50 players, basic scheduling |
| **Plus** | $4.99/mo ($49/yr) | Unlimited teams, payment collection, notifications |
| **Club** | $19.99/mo ($199/yr) | Multiple admins, analytics, custom branding |
| **League** | $49.99/mo ($499/yr) | Multi-location, API access, priority support |

#### Secondary: Transaction Fees
- **2.5% per transaction** on payment processing (registration fees, dues collection)

#### Tertiary: Salesforce AppExchange
- Listed as a managed package for Salesforce customers
- Integration services: $5K-20K one-time setup for enterprise customization

### Unit Economics (Target)

| Metric | Value |
|---|---|
| Free-to-paid conversion | 10% |
| Average revenue per paid user | ~$15/mo blended |
| CAC (organic/content) | $20-40 |
| LTV (18-month avg tenure) | $270 |
| LTV:CAC ratio | 6.75-13.5x |
| Gross margin | ~85% (Vercel + Salesforce costs) |

### Revenue Projections

| Scenario | Year 1 | Year 2 | Year 3 |
|---|---|---|---|
| **Conservative** | $10K | $50K | $150K |
| **Moderate** | $25K | $100K | $350K |
| **Optimistic** | $50K | $200K | $750K |

**Year 1 targets:** 1,000 free users, 100 paid subscribers, $500 MRR, <10% monthly churn.

---

## 6. Go-to-Market Strategy

### Channel 1: Standalone SaaS (Primary)

**Phase 1 — Deploy (Weeks 1-2)**
- Deploy Next.js app to Vercel with production Salesforce org
- Connect Stripe for payment processing
- Configure Clerk for production authentication

**Phase 2 — Soft Launch (Weeks 3-4)**
- Landing page with product screenshots and pricing
- Soft launch to friends, family, and local leagues
- Gather feedback, fix critical issues
- Target: 10 beta users

**Phase 3 — Growth (Months 2-6)**
- Product Hunt launch
- Content marketing: SEO-optimized guides on league management
- Social media presence (Twitter/X, Reddit r/sportsmanagement)
- Target: 100 users, 20 paid subscribers, $1K MRR

**Phase 4 — Scale (Months 7-12)**
- Paid acquisition (targeted Facebook/Google ads to league organizers)
- Partnership with youth sports associations
- Add more sport modules
- Target: 500 users, 100 paid subscribers, $10K MRR

### Channel 2: Salesforce AppExchange (Secondary)

- Submit for Salesforce Security Review (required for AppExchange listing)
- Create AppExchange listing with screenshots, demo video, and documentation
- Leverage Salesforce ISV program for distribution support
- Target enterprise customers already on Salesforce platform

### Why Dual-Channel Works

The standalone app drives volume and validates product-market fit. The AppExchange listing captures high-value enterprise customers who need Salesforce integration. The same codebase serves both — the Salesforce backend is shared, and the frontend is additive.

---

## 7. Competitive Advantage & Moat

### Structural Advantages

1. **Architecture moat** — The modular Salesforce package system (core + sport-specific) is difficult to replicate. Competitors would need to rebuild on Salesforce from scratch or build Salesforce connectors as afterthoughts.

2. **Dual-distribution** — Standalone competitors can't easily add AppExchange distribution (requires Salesforce expertise). AppExchange competitors can't easily add a modern React frontend (requires web engineering expertise). We have both.

3. **Enterprise data infrastructure for free** — Salesforce provides audit trails, HIPAA-eligible storage, workflow automation, and reporting that standalone competitors spend years building.

4. **Multi-sport extensibility** — The `sportsmgmt` / `sportsmgmt-football` package split means adding a new sport (basketball, soccer, baseball) is a package addition, not a rewrite.

### Defensibility Over Time

- **Data network effects** — As leagues accumulate historical data (seasons, player stats, game results), switching costs increase
- **AppExchange reviews and ratings** — Early mover advantage in an underserved category compounds over time
- **Integration depth** — Enterprise customers who integrate sprtsmng with their broader Salesforce workflows (donations, volunteers, communications) become deeply locked in

---

## 8. Current Status & Traction

### What's Built (as of March 2026)

| Component | Status | Details |
|---|---|---|
| Salesforce data model | Complete | 5 custom objects: League, Team, Division, Season, Player |
| Service layer (Apex) | Complete | Interface → Wrapper → Repository → Service → Controller pattern |
| Lightning Web Components | Complete | 4 LWC pages: Division Mgmt, Team Details, Season Mgmt, Player Roster |
| Apex REST API | Complete | Read/write endpoints for all 5 entities at `/sportsmgmt/v1/*` |
| Next.js frontend | Complete | Next.js 15, React 19, Tailwind 4, Clerk auth, dashboard pages |
| Shared type packages | Complete | `shared-types` (TypeScript) + `api-contracts` (Zod validation) |
| Permission sets | Complete | 4 roles: League Admin, Team Manager, Data Viewer, External App Integration |
| E2E testing | Complete | Playwright tests for all LWC pages + permission-based access control |
| Monorepo infrastructure | Complete | pnpm + Turborepo with workspace packages |
| Test coverage | 94% | 60+ Apex tests, Jest LWC tests, Playwright E2E suite |

### Development Velocity

Three sprints completed across 17 user stories and 24 merged PRs:

| Sprint | Focus | Stories | Points | Status |
|---|---|---|---|---|
| **2025.07** | Season & Player Management | W-000017 through W-000021 | 29 pts | Complete |
| **2025.08** | E2E Testing & Permission Sets | W-000022 through W-000027 | 29 pts | Complete |
| **2025.09** | External React Frontend | W-000028 through W-000033 | 32 pts | Complete |

**Average velocity:** ~30 story points per 2-week sprint.

### Remaining Work Before Launch

| Task | Effort | Blocking Launch? |
|---|---|---|
| Deploy Next.js app to Vercel | Small | Yes |
| Configure production Salesforce org | Small | Yes |
| Connect Stripe payments | Medium | Yes |
| Create landing/marketing page | Medium | Yes |
| AppExchange security review | Large | No (AppExchange channel only) |
| Domain setup + SEO | Small | No |
| Analytics (Vercel/GA) | Small | No |

**Estimated time to standalone launch:** 2-4 weeks of focused work.

---

## 9. Product Roadmap

### Near-Term (Q2 2026) — Launch

- Deploy standalone app to production (Vercel + production Salesforce org)
- Stripe integration for payment processing
- Landing page and marketing materials
- Soft launch with beta users
- Product Hunt launch

### Medium-Term (Q3 2026) — Growth

- Game/Match management (the next data model layer — depends on Season + Team)
- Schedule builder and calendar integration
- Notification system (email/push for game reminders, roster changes)
- Mobile-responsive optimization pass
- AppExchange security review submission

### Long-Term (Q4 2026 - Q1 2027) — Scale

- Additional sport modules (basketball, baseball, soccer)
- Payment collection for registration fees and dues (Stripe Connect)
- Statistics tracking and analytics dashboards
- AppExchange listing goes live
- Public API for third-party integrations
- Venue management and facility scheduling

### Architecture Evolution

The current architecture (Option A: Salesforce as system of record, external app through BFF) is designed to evolve. If the external app becomes the primary product surface and user traffic outgrows Salesforce-centric patterns, the architecture can migrate to Option B (external app owns runtime data, Salesforce as back office) with a sync layer — without rewriting the frontend or breaking operator workflows.

---

## 10. Financial Projections

### Cost Structure

| Expense | Monthly | Annual | Notes |
|---|---|---|---|
| Vercel hosting | $0-20 | $0-240 | Free tier covers initial traffic |
| Salesforce org | $0-25 | $0-300 | Developer edition free; Production starts at $25/user |
| Clerk auth | $0-25 | $0-300 | Free up to 10K MAUs |
| Stripe fees | 2.9% + $0.30/txn | Variable | Pass-through on payment processing |
| Domain + DNS | $1-2 | $12-24 | Annual domain registration |
| **Total fixed costs** | **$1-72** | **$12-864** | Scales with usage |

### Break-Even Analysis

At the blended $15/mo average revenue per paid user with ~85% gross margin:
- **Break-even on fixed costs:** 5-6 paid users
- **Break-even including 20 hrs/week founder time (at $50/hr opportunity cost):** ~340 paid users

### Year 1 Detailed (Moderate Scenario)

| Quarter | Free Users | Paid Users | MRR | Revenue |
|---|---|---|---|---|
| Q1 | 50 | 5 | $75 | $225 |
| Q2 | 200 | 20 | $300 | $900 |
| Q3 | 500 | 50 | $750 | $2,250 |
| Q4 | 1,000 | 100 | $1,500 | $4,500 |
| **Total** | | | | **~$25K** |

---

## 11. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Salesforce API limits** at scale | Medium | High | Architecture designed to migrate to Option B (app-owned data) if needed; BFF caches responses |
| **AppExchange security review** rejection/delay | Medium | Medium | AppExchange is secondary channel; standalone app launches independently |
| **TeamSnap adds Salesforce integration** | Low | High | Our Salesforce-native architecture is deeper than any bolt-on integration; multi-sport modularity is structural |
| **Low initial adoption** | Medium | Medium | Free tier removes friction; content marketing targets long-tail search; local league partnerships for seeding |
| **Single-developer bus factor** | High | High | Clean architecture, 94% test coverage, comprehensive sprint documentation, and CI/CD reduce onboarding friction for additional contributors |
| **Salesforce pricing changes** | Low | Medium | Architecture supports migration to Option B with external database if Salesforce costs become prohibitive |
| **Clerk/Vercel vendor lock-in** | Low | Low | Standard Next.js app; auth and hosting are swappable layers |

---

## 12. Team & Execution

### Current Team

Solo technical founder with demonstrated execution velocity:
- 3 sprints completed in ~6 weeks
- 17 user stories shipped across full stack (Salesforce + React + infrastructure)
- ~30 story points per sprint sustained velocity
- Production-quality engineering: 94% test coverage, E2E testing, role-based security, shared type packages

### Execution Evidence

The codebase itself is the strongest evidence of execution capability:
- **Layered architecture** following SOLID principles (Interface → Wrapper → Repository → Service → Controller → LWC)
- **Dependency injection** throughout for testability
- **Four permission-set roles** with E2E-tested access control
- **Shared TypeScript/Zod packages** ensuring frontend-backend contract consistency
- **Comprehensive documentation** including sprint plans with implementation details for every story

### What's Needed

| Role | When | Why |
|---|---|---|
| Design/UX | Pre-launch | Landing page, product polish, brand identity |
| Marketing | Launch | Content strategy, social media, community building |
| Additional engineer | Post-PMF | Scale feature development, add sport modules |

---

*This document synthesizes research from the sprtsmng market analysis suite (competitors.md, monetization.md, validation.md, roadmap.md, mvp.md) and is grounded in the actual codebase state as of Sprint 2025.09 (March 2026).*
