# Product-readiness gaps — full codebase review (2026-07-05)

> **Status (Marko, 2026-07-05): ALL post-MVP.** Current priority is making the app
> function properly for Marko alone — i.e. the items in
> [testing-feedback-2026-07-05.md](testing-feedback-2026-07-05.md) plus Phase 7 polish.
> Revisit this doc only when Astrameath heads toward going public.

What's missing for Astrameath to be a **sellable digital product**, beyond Marko's own
testing notes ([testing-feedback-2026-07-05.md](testing-feedback-2026-07-05.md)).
Found by reviewing every file in `src/`, the migrations, and the build plan.

The plan's "Post-MVP: Public Prep" section already lists: Stripe + subscriptions,
enforced per-user AI quotas/rate limits, security hardening, public signup. Everything
below is **additional** to that, grouped by how much it threatens a launch.

## A. Financial / legal blockers (must exist before taking money)

1. **AI spend is tracked but never enforced.** `ai_usage` logs every turn's cost, but
   `/api/ai/chat` and `/api/ai/memorize` never read it. Any user can chat without
   limit on the shared `ANTHROPIC_API_KEY` — a single enthusiastic (or hostile) user
   can cost more than their subscription. This is the #1 financial risk. The quota
   check is one query over `ai_usage` before inference; do it early, not at launch.
2. **No entitlements model.** Nothing in the schema distinguishes free vs paid users —
   no `subscriptions`/`plan` column, no feature-gating scaffold. Stripe is post-MVP,
   but the schema hook (e.g. `profiles.plan` + a `can(feature)` helper) is cheap now
   and painful to retrofit.
3. **No legal pages at all:** privacy policy, terms of service, refund policy, cookie
   notice. Selling to EU customers ⇒ GDPR applies regardless of where Marko is based.
   Chat messages being sent to Anthropic (a US processor) must be disclosed.
4. **No GDPR data rights plumbing:**
   - **Account deletion** — the danger zone wipes app/AI *data* but cannot delete the
     auth account itself (right to erasure). Needs a server route with service-role key.
   - **Data export** — no way to download your data (right to portability).

## B. Auth & account (blockers for real users, even invite-only)

5. **No password reset.** Login-only page; a forgotten password = locked out (even for
   Marko today). Needs forgot-password flow + Supabase email template.
6. **No signup flow** — known/intentional (invite-only), listed for completeness.
7. **No email change / password change** in the profile.
8. **No email verification flow** (matters once signups open).
9. **No OAuth** ("Continue with Google"). Not required, but for a consumer product it
   measurably improves conversion; Supabase makes it cheap.
10. **Auth emails use Supabase's built-in SMTP** — hard-limited to ~2–4 emails/hour,
    fine for one user, dead on arrival for public signups. Needs custom SMTP
    (e.g. Resend) before launch.

## C. Trust & first impressions (what a buyer sees)

11. **No landing/marketing page.** Unauthenticated visitors get a bare login form.
    A product needs a public page that sells it (features, screenshots, pricing, CTA)
    — can be a separate site, but must exist.
12. **No onboarding.** Marko tests with a populated account; a new customer lands on
    an empty app. Empty states exist (e.g. projects view) which helps, but there's no
    guided first-run (create first project → first task → meet the companion).
13. **No App Router error surfaces:** no `error.tsx`, `not-found.tsx`, or global
    `loading.tsx`. Any thrown error shows Next's default white screen — instant
    trust-killer in a paid product.

## D. Operations (you can't fix what you can't see)

14. **No error monitoring** (Sentry or similar). When a customer hits a bug, there is
    currently zero signal.
15. **No analytics** — not even privacy-friendly (Vercel Analytics / Umami / Plausible).
    No way to know what features are used or where users drop off.
16. **No tests, no CI.** No `.github/`, no test runner. Highest-value targets: the XP
    triggers, `recurrence.ts`, and `xp.ts` level math — these compute the product's
    core promise, and a regression there corrupts user trust in the whole game layer.
17. **Backups:** Supabase free tier has no point-in-time recovery and limited backups.
    Paying customers' data needs at least the Supabase Pro backup story, or scheduled
    `pg_dump`s.

## E. Smaller notes (worth a line each)

18. `avatars` storage bucket is public-read — any avatar is fetchable by URL. Fine
    for now, but a privacy-policy line item.
19. PWA manifest exists but there's no service worker — "installable" but not
    offline-capable. Fine for MVP; don't advertise offline.
20. `tzOffsetMinutes` comes from the client per request — DST boundary days can
    mislabel "today" by an hour. Edge case; revisit if streaks become strict.
21. Login page has no rate-limit/captcha of its own (Supabase provides basic
    protection; revisit at public launch alongside the hardening pass).
22. `package.json` version is untouched `0.1.0` and there's no changelog — once
    customers exist, a visible "what's new" builds retention.

## Suggested order

Pre-launch hard blockers: **1, 3, 4, 5, 10, 11, 13, 14** (spend caps, legal, account
deletion/export, password reset, real SMTP, landing page, error pages, monitoring).
Everything else can trail the first paying user without existential risk.
