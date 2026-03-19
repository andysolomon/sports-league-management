# User Types & Billing Model

**sprtsmng — Who Uses the App and How They're Billed**
*Last updated: 2026-03-19*

---

## 1. Overview

sprtsmng has three distinct user worlds, each with its own authentication system, capabilities, and cost profile. Understanding this split is critical for pricing, infrastructure planning, and feature development.

```
┌─────────────────────────────────────────────────────────┐
│  World 1: External App Users                            │
│  Auth: Clerk (Google SSO, email)                        │
│  Interface: Next.js web app                             │
│  Billing: Stripe subscriptions                          │
│  Salesforce license needed: NO                          │
├─────────────────────────────────────────────────────────┤
│  World 2: Operators                                     │
│  Auth: Salesforce Identity                              │
│  Interface: Lightning Experience (LWC)                  │
│  Billing: Salesforce user licenses (you pay)            │
│  Salesforce license needed: YES                         │
├─────────────────────────────────────────────────────────┤
│  World 3: Integration User (Machine Identity)           │
│  Auth: JWT Bearer Flow (no human login)                 │
│  Interface: Apex REST API                               │
│  Billing: 1 Salesforce license (you pay)                │
│  Salesforce license needed: YES                         │
└─────────────────────────────────────────────────────────┘
```

---

## 2. World 1: External App Users

These people sign in with Google via Clerk on the Next.js frontend. They never touch Salesforce directly — no Salesforce user record, no Salesforce license, no awareness that Salesforce exists. The BFF layer uses the integration user's JWT connection to read/write Salesforce data on their behalf.

### Personas

| Persona | What They Do | Subscription Tier | Who Pays |
|---------|-------------|-------------------|----------|
| **Team Coach / Manager** | Manage roster, update player info, view schedule | Free or Plus | The coach, or the league on their behalf |
| **League Administrator** | Create leagues, manage divisions, set up seasons, run the organization | Club or League | The league organization |
| **Parent / Fan** | View team roster, check schedules, see standings | Free (read-only) | Nobody — free tier |
| **Club Director** | Oversee multiple teams, multiple admins, analytics | Club | The club/organization |

### Subscription Tiers (Stripe)

| Tier | Price | Trigger | Key Features |
|------|-------|---------|-------------|
| **Free** | $0/mo | Sign up | 1 team, 50 players, basic scheduling |
| **Plus** | $4.99/mo ($49/yr) | Need unlimited teams | Unlimited teams, payment collection, notifications |
| **Club** | $19.99/mo ($199/yr) | Need multi-admin | Multiple admins, analytics, custom branding |
| **League** | $49.99/mo ($499/yr) | Need multi-location | Multi-location, API access, priority support |

Plus **2.5% transaction fee** when a league collects registration fees or dues through Stripe Connect.

### Cost to Serve (Per External User)

| Service | Cost | Notes |
|---------|------|-------|
| Clerk auth | $0 up to 10K MAU, then $0.02/MAU | Auth cost per external user |
| Vercel | $0-20/mo total | Hosting all requests |
| Salesforce API calls | $0 marginal | Consumed via integration user, not per-user |
| **Effective per-user cost** | **~$0** below 10K MAU | Salesforce cost is fixed, not per-user |

---

## 3. World 2: Operators

These people log into Salesforce directly. They use Lightning Experience with the LWC components (Division Management, Team Details, Season Management, Player Roster). They are either your internal team or high-value enterprise customers on the AppExchange channel.

### Personas (Mapped to Salesforce Permission Sets)

| Persona | Permission Set | Object Access | Interface |
|---------|---------------|---------------|-----------|
| **League Administrator** | `League_Administrator` | Full CRUD on all 5 objects (League, Team, Division, Season, Player) | Lightning Experience, all tabs |
| **Team Manager** (operator) | `Team_Manager` | Full CRUD on Team + Player; Read-only on League, Division, Season | Lightning Experience, limited tabs |
| **Data Viewer** | `Data_Viewer` | Read-only on all 5 objects | Lightning Experience, all tabs visible, no edit |
| **System Admin** | Admin Profile | Full admin: deploy metadata, manage users, configure org | Full admin access |

### Permission Set Detail

Derived from the actual `.permissionset-meta.xml` files in `sportsmgmt/main/default/permissionsets/`:

| Object | League Admin | Team Manager | Data Viewer |
|--------|:-----------:|:------------:|:-----------:|
| League__c | CRUD | Read | Read |
| Team__c | CRUD | CRUD | Read |
| Division__c | CRUD | Read | Read |
| Season__c | CRUD | Read | Read |
| Player__c | CRUD | CRUD | Read |

### Operator Billing

Each operator requires a **Salesforce user license**, which **you pay for**:

| License Type | Cost/User/Month | Typical Use |
|-------------|-----------------|-------------|
| Platform Starter | $25 | Custom app access only, 10 custom objects max, limited API |
| Platform Plus | $100 | More API headroom, workflows, larger object limit |
| Sales/Service Cloud Enterprise | $165 | Full CRM features, reports, dashboards, 100K base API calls |

**Standalone SaaS channel:** You pay for these licenses. The number is small and fixed — typically 1 admin + 1 integration user + 1-3 league operators = 3-5 people total.

**AppExchange channel:** The customer already has their own Salesforce org and licenses. They install your managed package. You don't pay for their licenses — Salesforce takes a revenue share instead:

| Licensing Model | Revenue Share | Who It's For |
|----------------|--------------|-------------|
| ISVforce (existing SF customers) | **15%** of your app revenue | Customers who already have Salesforce |
| ISVforce (new-to-Salesforce) | **25%** of your app revenue | Customers who don't have Salesforce yet |
| OEM Embedded | $25/user/mo + **25%** revenue share | Standalone distribution with bundled SF licenses |

Plus a **$2,700 one-time fee** for AppExchange Security Review.

---

## 4. World 3: Integration User (Machine Identity)

The invisible bridge between Worlds 1 and 2. A single Salesforce user record with the `External_App_Integration` permission set. Authenticates via JWT bearer flow (no human login). All requests from the Next.js BFF flow through this identity.

### Capabilities (from `External_App_Integration` permission set)

| Object | Access Level | Notes |
|--------|-------------|-------|
| League__c | Read only | View all records |
| Division__c | Read only | View all records |
| Season__c | Read only | View all records |
| Team__c | Read + Edit | Can update team details (city, stadium, founded year, division) |
| Player__c | Full CRUD | Can create, read, update, delete players |

Plus access to all 5 REST resource classes (`LeagueRestResource`, `DivisionRestResource`, `TeamRestResource`, `PlayerRestResource`, `SeasonRestResource`) and their underlying service and repository classes.

### Cost Profile

- Consumes **1 Salesforce user license** — same cost as an operator ($25-165/mo depending on edition)
- Fixed cost regardless of how many external users it serves
- Consumes the **org-wide API call budget** — every request from Next.js counts against this identity's daily limit
- This is the scalability bottleneck discussed in [backend-comparison.md](backend-comparison.md) and [teamsnap-competitive-analysis.md](teamsnap-competitive-analysis.md)

---

## 5. Money Flow

### Revenue In

```
External App Users → Stripe → You
├── Free:       $0/mo (funnel / volume)
├── Plus:       $4.99/mo per subscriber
├── Club:       $19.99/mo per subscriber
├── League:     $49.99/mo per subscriber
└── Txn Fee:    2.5% on payment processing (Stripe Connect)

AppExchange Customers → You (minus Salesforce revenue share)
└── Custom pricing ($50-500/mo) minus 15-25% to Salesforce
```

### Costs Out

```
You → Salesforce     $50-500/mo   (operator + integration user licenses)
You → Clerk          $0-1,825/mo  (free to 10K MAU, then $0.02/MAU)
You → Vercel         $0-20/mo     (hosting)
You → Stripe         2.9% + $0.30 (per transaction, passed through)
```

### Unit Economics at Steady State (Year 1 Target: 100 Paid Users)

| Metric | Value |
|--------|-------|
| Blended ARPU | ~$15/mo |
| Monthly revenue | ~$1,500 |
| Salesforce cost | ~$350/mo (fixed) |
| Vercel + Clerk | ~$20/mo |
| **Gross margin** | **~75%** |
| Break-even on fixed costs | **~25-30 paid users** |

---

## 6. Gap: Subscription Tier Enforcement

There is a structural gap in the current implementation that needs to be addressed before launch.

### The Problem

Salesforce permission sets (`League_Administrator`, `Team_Manager`, `Data_Viewer`) control what **operators** can do inside Lightning Experience. Subscription tiers (Free, Plus, Club, League) control what **external app users** can access via the Next.js frontend.

The BFF uses a **single integration user** for all external requests regardless of tier. Salesforce sees every request as `External_App_Integration` and cannot distinguish a Free user from a League user.

### What This Means

| Enforcement | Where It Lives | Current Status |
|------------|---------------|----------------|
| Salesforce object/field access | Permission sets in Salesforce | Implemented |
| Subscription tier limits (teams, players, features) | BFF middleware in Next.js | **Not yet implemented** |
| Usage metering (API access, multi-location) | BFF middleware + Stripe metadata | **Not yet implemented** |

### What Needs to Be Built

The Next.js BFF layer (or a middleware) must:

1. **Read the user's subscription tier** from Clerk metadata or Stripe subscription status on each request
2. **Enforce tier limits** before forwarding to Salesforce:
   - Free: reject team creation if user already has 1 team; reject player creation above 50
   - Plus: allow unlimited teams; reject multi-admin features
   - Club: allow multi-admin; reject multi-location features
   - League: allow everything
3. **Gate premium features** like analytics, custom branding, and API access at the BFF level

This is a distinct piece of work not currently captured in any sprint plan. It should be scoped as a pre-launch story, estimated at ~1-2 sprints depending on the complexity of the feature gating rules.

### Recommended Approach

Store the subscription tier as Clerk user metadata (set by a Stripe webhook when subscription changes). The BFF reads `user.publicMetadata.tier` on each request and applies limits before calling Salesforce. This keeps Salesforce clean (no subscription awareness needed) and keeps all billing logic in the web app layer where Stripe and Clerk already live.

---

## 7. Summary Table

| User Type | Auth System | Needs SF License? | Pays You? | You Pay For Them? |
|-----------|------------|-------------------|-----------|-------------------|
| External app user (Free) | Clerk | No | No | Clerk MAU (free < 10K) |
| External app user (Paid) | Clerk | No | Yes (Stripe) | Clerk MAU + Vercel |
| Operator (your team) | Salesforce | Yes | No | SF license ($25-165/mo) |
| Operator (AppExchange customer) | Salesforce | Yes (their own) | Yes (app fee) | No (they own license) |
| Integration user | JWT bearer | Yes | N/A (machine) | SF license ($25-165/mo) |

---

*This document reflects the architecture and permission sets checked into the `sportsmgmt` package as of March 2026. Subscription tier enforcement is a planned feature not yet implemented.*
