# Soft launch plan — v0.3.0

**Last updated:** 2026-04-08

## Objective

Invite 10-20 beta users to try sprtsmng over a 1-2 week window, collect actionable feedback, and decide whether to open public signups.

## Audience

Personal-network outreach to people who match the youth/rec coach ICP:

- Volunteer or paid coaches managing 1-2 teams in local rec leagues
- League commissioners or club admins running small organizations
- Anyone in the user's professional network who has expressed interest in trying it

**Out of scope for soft launch:** public Reddit/HN/ProductHunt posting, paid ads, cold outreach to strangers.

## Timeline

| Day | Action |
|---|---|
| **Day 0** | Wave 1: invite 5 users via personal email |
| **Day 1-3** | Monitor signups, watch Vercel logs, respond to inbound emails the same day |
| **Day 3-5** | Review wave 1 feedback, file any bugs as GitHub issues, fix critical bugs |
| **Day 5** | Wave 2: invite remaining 10-15 users |
| **Day 5-12** | Continue monitoring, responding, fixing |
| **Day 14** | Soft launch retrospective: write `docs/launch/soft-launch-retrospective.md` |
| **Day 14+** | Decision: proceed to public launch, extend beta, or pivot |

## Onboarding email template

**Subject:** You're invited: try sprtsmng (free, takes 30 seconds)

```
Hi [name],

I built sprtsmng to manage youth sports teams without the spreadsheets.
It's in soft launch and I'd love your feedback.

→ Sign up: https://sprtsmng.andrewsolomon.dev
→ Free for one team, forever
→ 30 seconds with Google sign-in

What I'd love to know after you try it:

1. What was confusing in the first 5 minutes?
2. What's missing that you'd need before using this for your real team?
3. Did anything break? (Bonus points for screenshots / steps to reproduce.)

You can reply to this email or open a feedback issue at:
https://github.com/andysolomon/sports-league-management/issues/new/choose

Thanks for helping me ship this.
[your name]
```

## Wave plan

### Wave 1 (Day 0): 5 users

Target: 5 users you trust to give honest feedback. Personal/professional network only.

Track in a private file (e.g., `docs/launch/beta-users.md` — gitignored, or in a personal CRM) with columns:
- Name
- Email
- Wave (1 or 2)
- Invited date
- Signup date (or "no")
- Feedback received (date + summary)
- Issues filed (linked)

### Wave 2 (Day 5): 10-15 users

Same structure. Send only after fixing any critical bugs surfaced in wave 1.

## Feedback collection

Two channels:

1. **`feedback@sprtsmng.andrewsolomon.dev`** — mailto link in marketing footer. Replies route to your personal inbox. (Note: this requires email forwarding setup; if not already done, configure in your DNS provider or just use a plain catch-all.)
2. **GitHub issue template** at `.github/ISSUE_TEMPLATE/beta-feedback.yml`. Beta users can open `https://github.com/andysolomon/sports-league-management/issues/new/choose` and pick "Beta Feedback".

Triage rule: respond to every piece of feedback within 24 hours. Even if the answer is "I'll look into it next week."

## Soft launch retrospective template

After day 14, write `docs/launch/soft-launch-retrospective.md` covering:

- How many users invited / signed up / used the product
- Top 5 pieces of feedback
- Bugs found and fixed
- Lighthouse score before vs after
- Actual deliverability rates for emails
- Decision: proceed to public launch, extend beta, or pivot scope
- Any new follow-up issues to file

## What public launch will need (out of scope here)

For visibility, the items below are NOT in the soft launch plan. They go in a v0.4.0 or v0.3.1 milestone after the retrospective:

- Lawyer-reviewed Terms / Privacy
- Stripe live keys (currently test mode)
- Clerk live keys on the custom domain (currently test mode due to SSL provisioning issue)
- OG image / favicon designer pass
- ProductHunt / Reddit posting strategy
- Customer support runbook
- Status page
