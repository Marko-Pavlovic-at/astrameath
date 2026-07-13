# MVP → Launch roadmap (2026-07-10)

Live, actionable roadmap agreed with Marko. Supersedes the old "Phase 7 next"
framing for ordering purposes. Two stages:

1. **Finish the MVP** — a short set of UX/functionality tasks, done *before*
   Phase 7 polish.
2. **Make the app deployable ("go public")** — was "Post-MVP: Public Prep" in
   the plan; now the committed next major stage. Approach: **build in public.**

The detailed launch checklist lives in
[product-readiness-gaps.md](product-readiness-gaps.md) (22 items). This doc sets
the **order**; that doc is the **inventory**.

---

## Stage 1 — Finish the MVP (do these before Phase 7)

Ordered. Each is a parent task with its own subtasks.

### 1. Subtasks on tasks + parent progress bar
- [ ] Let a task hold **subtasks** (checklist of child steps under a task).
- [ ] Parent task shows a **progress bar** that fills by % of subtasks done
      (e.g. 3/5 done → 60%).
- [ ] Completing/uncompleting a subtask updates the bar live (optimistic).
- **Open decisions (resolve before coding):**
  - Schema: new `subtasks` table (`task_id`, `title`, `completed_at`,
    `position`) vs. self-referential `tasks.parent_id`. Leaning toward a
    dedicated `subtasks` table — lighter, no recursion, can't be scheduled or
    timed.
  - Do subtasks award XP, or is XP still only on the parent task's completion?
    (Recommend: **no XP on subtasks** — avoids double-counting; parent
    completion keeps its existing +10.)
  - Relationship to goals/milestones: this is a **different axis**. Projects →
    goals → milestones = objectives. Subtasks = decomposition of a single task.
    Keep them separate; don't merge the concepts in the UI.

### 2. Move the running-timer widget out of the bottom-right corner — DONE (ca4357a)
- [x] Problem: when a timer is running, the timer bar sits in the **bottom-right
      corner and covers the AI companion chat window** (`timer-bar.tsx`).
- [x] Relocate the running-timer display into the **nav**, sitting **between the
      "Sign out" button and the XP / level display** (`nav.tsx`).
- [x] Keep start/stop controls reachable; verify it survives reload (the timer
      *is* the open `time_sessions` row — display change only, no data change).
- Shipped as `SidebarTimer` in `nav.tsx` (md+, sidebar is `hidden md:flex`); the
  floating bar went `md:hidden` and stays the mobile affordance. Exactly one
  timer at every width.

### 3. Calendar drag-and-drop on mobile — TESTED, BROKEN → folded into task 4
- [x] Tested by Marko on a real phone (2026-07-13): **drag-and-drop does not
      work on touch.** As suspected — the calendar uses **HTML5 drag events**
      (`dragstart`/`dragover`/`drop`), which mobile browsers do not synthesise
      from touch. This is a confirmed defect, not an open question.
- [ ] **Fix belongs to the design pass (task 4)** — it's a mobile interaction
      design problem, not a bug to patch in isolation. Options, cheapest first:
  - Make the **date-input fallback the primary mobile affordance** (already
    exists in `undated-sidebar.tsx`) — tap a task → pick a date. No DnD at all
    on touch. Cheapest, and arguably the better phone interaction anyway.
  - **Pointer-events-based DnD** (`pointerdown`/`pointermove` + touch-action)
    replacing the HTML5 API, so one code path serves mouse and touch.
  - A drag library with touch support (dnd-kit) — heaviest; only if the
    hand-rolled pointer path proves fiddly.
- Decide the affordance during task 4 rather than bolting touch onto the
  existing HTML5 path.

### 4. Mobile view pass / design pass — DONE (2026-07-13)
Audited all ten routes at 375px in real Chromium (touch emulation, running
timer, seeded data). The layout was already sound — **no horizontal overflow on
any route, no console errors, every input ≥16px** — so the pass was about touch,
not breakage. What shipped:
- [x] **Month calendar was unusable on a phone** (the real headline, worse than
      the DnD bug): 7 columns × 47px cells truncated every title to "Shi…".
      Below `sm` the grid now renders **project-coloured dots** (max 4, then
      "+N") and a tap opens the day view, which reads properly. Chips still
      render ≥sm — desktop is unchanged.
- [x] **Touch DnD resolved (task 3):** the date field is now the touch path.
      Copy is **pointer-based, not width-based** (`pointer-fine:`) so a touch
      tablet — wide *and* coarse — gets "Pick a date to schedule." rather than a
      lie about dragging. HTML5 DnD is left intact for mice.
- [x] **Tap targets to ~44px**: checkboxes (were 16px, 12px in week view — the
      most-tapped control in the app) via a padded `<label>` wrapper that grows
      the hit area without inflating the box; calendar arrows/toggles, stats
      range chips, Start/Stop, goal/subtask ✕, and the page header buttons.
- [x] **Stats chart was hover-only** — decorative on a phone. Bars now take a
      tap to set the readout.
- [x] Content padding cleared the timer bar (`pb-24` = 96px < nav 52px + bar
      48px, so the last card sat under it) and the project-detail new-task form
      no longer wraps across three ragged rows.
- Compact styling is gated on **wide AND fine pointer** (`sm:pointer-fine:`), so
  a small screen always keeps big targets.
- GOTCHA for future browser checks: Playwright's `isMobile`/`hasTouch` still
  reports `pointer: fine`, so the CSS a real phone takes is only reachable by
  forcing it over CDP (`Emulation.setEmulatedMedia`) — **and the override resets
  on navigation**, so re-apply it on the final page or the test silently
  measures the desktop branch.

> Still open for **Phase 7 polish**: theming pass, animations, PWA install.
> Only known sub-44px target left: stats chart columns (23px wide — inherent to
> a bar chart; they are 127px tall, adjacent, and now tappable).

> After Stage 1: **Phase 7 polish** as originally planned — theming pass
> (Hollow Knight / Dark Souls / WuWa mood), animations, PWA install. Responsive
> audit is largely handled by task 4.

---

## Stage 2 — Make the app deployable ("go public")

Committed next major stage after the MVP. **Work-in-public approach**: build it
transparently (devlog, visible changelog, share progress). Marko described the
minimum — payment, landing page, VPS hosting, security + legal minimum — this
section expands it into the real scope. Full item-by-item detail (with the
"suggested order" of hard blockers) is in
[product-readiness-gaps.md](product-readiness-gaps.md).

### A. Payments & entitlements
- [ ] Payment / subscriptions (Stripe — already the plan's choice).
- [ ] Entitlements model: `profiles.plan` (free vs paid) + a `can(feature)`
      helper. Cheap to add now, painful to retrofit.
- [ ] **Enforce per-user AI quotas / rate limits** on `/api/ai/*`, read from the
      existing `ai_usage` ledger *before* inference. #1 financial risk today: the
      shared `ANTHROPIC_API_KEY` is unlimited per user.

### B. Landing / marketing / first-run
- [ ] Public **landing page** (features, screenshots, pricing, CTA) — today
      unauthenticated visitors just get a bare login form.
- [ ] **Onboarding** first-run flow (create first project → first task → meet the
      companion) instead of dropping new users into an empty app.
- [ ] Visible **changelog / "what's new"** — fits the work-in-public angle and
      builds retention.

### C. Hosting — migrate off Vercel to a VPS
- [ ] **Decision made:** self-host on a **VPS** (e.g. Hetzner ~€4–6/mo) rather
      than pay Vercel Pro (~€20/mo). Resolves testing-feedback #6.
- [ ] Next.js **standalone build** on the VPS; own TLS, deploy pipeline, and
      process/monitoring (candidates: Coolify / Dokku / plain systemd + Caddy).
- [ ] **Supabase stays managed** either way.
- [ ] Migrate `ANTHROPIC_API_KEY` + Supabase env handling off Vercel's model;
      set up backups as part of this (see D).

### D. Security minimum
- [ ] Security hardening pass; re-audit **RLS** (`user_id = auth.uid()`) on every
      table and every route.
- [ ] **Password reset** flow + Supabase email template (today: locked out if
      forgotten — affects Marko now).
- [ ] Public **signup** flow + **email verification** (currently invite-only by
      design).
- [ ] **Real SMTP** (e.g. Resend) — Supabase built-in SMTP caps ~2–4 emails/hr,
      dead on arrival for public signup.
- [ ] Email change / password change in profile.
- [ ] Login **rate-limit / captcha**.
- [ ] **Error monitoring** (Sentry or similar) + App Router error surfaces
      (`error.tsx`, `not-found.tsx`, global `loading.tsx`).
- [ ] **Backups**: scheduled `pg_dump` or Supabase Pro point-in-time recovery.

### E. Legal minimum
- [ ] **Privacy policy, terms of service, refund policy, cookie notice.** GDPR
      applies to EU customers regardless of where Marko is based.
- [ ] Disclose that **chat messages are sent to Anthropic (a US processor)**.
- [ ] **GDPR data rights plumbing:**
  - Account **deletion** — a server route with the service-role key that deletes
    the auth account itself (the danger zone only wipes app/AI *data* today).
  - Data **export** — download-your-data (right to portability).
- [ ] Note: `avatars` storage bucket is public-read — privacy-policy line item.

---

## Current status snapshot (updated 2026-07-13)
- **Stage 1 is COMPLETE.** All four tasks shipped:
  1. subtasks + progress bar — `3647cba`
  2. timer out of the corner — `ca4357a`
  3. calendar DnD on touch — resolved inside the design pass (date field is the
     touch path; drag copy is pointer-gated)
  4. mobile / design pass — audited at 375px and fixed; see above
- **Next: Phase 7 polish** — theming pass, animations, PWA install. The
  responsive audit that Phase 7 used to carry is done.
- Stage 2 (go public) — not started. Biggest financial risk stands: `/api/ai/*`
  has no per-user quota and the `ANTHROPIC_API_KEY` is shared.
- Everything through Phase 6 + the 2026-07-05 testing-feedback pass is shipped
  and deployed (see AGENTS.md status + git log).
