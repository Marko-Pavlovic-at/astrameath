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

## Stage 1.5 — Second MVP round (captured 2026-07-14)

Marko's second pass of feature requests, from using the app. These land **before
Phase 7 polish** — several of them (the nav, the stats colours) *are* design
decisions Phase 7 would otherwise have to guess at.

Listed in **suggested build order** (shell first, then schema, then AI/stats),
not the order Marko said them in.

### 1. Mobile bottom bar → hamburger menu at the top — DONE (3866e39)
- [x] The bottom nav is gone. Mobile now gets a **`sticky top-0` bar**: hamburger
      (three lines) → level badge, with a slide-in drawer holding the five nav
      links, the level/XP card and Sign out. Desktop sidebar untouched.
- [x] **Resolved the open decision** in favour of sticky, not scroll-away: the
      flicker is a *bottom*-anchored phenomenon (the browser must reposition the
      element every frame as the URL bar collapses), and the top of the viewport
      doesn't move — so a sticky top bar keeps the menu always reachable without
      re-opening the bug.
- [x] **The floating timer bar went with it.** It was the *second* bottom-anchored
      fixed element and would have kept flickering on its own, so it folds into
      the top bar as a compact chip (clock links to the project, ■ stops it);
      `timer-bar.tsx` is deleted. **Nothing on mobile is pinned to the viewport
      bottom any more** — asserted on every route by the verification script.
- [x] Drawer state is keyed to the pathname, not a boolean — otherwise the back
      button restored it open (it did, first try), and closing it from an effect
      is banned by the lint config.
- Verified in Chromium at 375px with `pointer: coarse` forced over CDP (31 checks:
  drawer open/close by hamburger, backdrop, Escape and navigation; body-scroll
  lock; ≥44px targets; inert when closed; desktop unchanged at 1280px).
- **STILL NEEDS MARKO ON A REAL PHONE:** headless Chromium never moves a URL bar,
  so the flicker itself cannot be confirmed dead here (see
  `.claude/memory/open-mobile-nav-flicker.md`). Ask him to scroll around.

### 2. "Add task" available everywhere, in every tab
- [ ] A **global quick-add** reachable from every route (projects, calendar,
      stats, profile, companions) — today a task can only be born inside a
      project detail page.
- [ ] Needs a project picker (default: last used), plus the fields worth having
      at capture time — title, project, date. Everything else is editable later.
- **Open decisions:**
  - Affordance: FAB, a `+` in the nav/top bar, or a command-palette-style modal
    on a keyboard shortcut. Recommend: **`+` in the top bar / sidebar** (one
    affordance that exists at every width) opening the same modal a FAB would.
  - Does it also accept a **project-less** capture (an inbox)? Today a task
    *requires* a `project_id`, so an inbox means schema change. Recommend: no
    inbox — force a project, keep the schema.

### 3. Subtasks sit on top in the task panel
- [ ] In the expanded task panel (`task-row.tsx`, `expanded` state) the subtask
      checklist currently renders **last**, under notes / priority / estimate /
      schedule / recurrence / sessions. Move it to the **top** — it is the part
      you open the task for.
- Pure reorder, no schema or data change.

### 4. Time logic: log and edit time **on the project**, and import time from old apps
Two changes, one schema migration.
- [ ] **Edit time at the project level.** Today a session is always attached to
      a task (`time_sessions.task_id` is `not null`) and can only be reached
      through the task, so correcting a mis-tracked hour means hunting the task
      down. Marko wants project time editable **directly on the project page**:
      list the project's sessions, edit start/end/duration, delete, add.
- [ ] **Add time from old apps** — backfill historical hours (from V1/"Ascendant"
      and whatever else Marko tracked in) so the totals tell the whole story:
      arbitrary past dates, entered against the project.
- **Decided (2026-07-14): imported time awards NO XP.** Totals and stats include
  it; the level stays a record of what was actually tracked inside Astrameath.
  Implementation: a new `session_source` value `import`, and the XP trigger
  (`20260703_xp_triggers.sql`, `after insert or update of ended_at on
  time_sessions`) skips rows whose source is `import`. `manual` keeps awarding.
- **Open decisions:**
  - Schema shape for project-level time. Recommend: **`time_sessions.task_id`
    becomes nullable + add `project_id not null`** (backfill `project_id` from
    the task, keep it in sync). A session then always has a project and
    *optionally* a task. Alternative — a per-project hidden "General" task —
    keeps the schema but pollutes the task list; rejected unless the migration
    proves ugly. Note `task_time_totals` / `project_time_totals`
    (`20260702_time_total_views.sql`) both join through `task_id` and must be
    rewritten either way.
  - Which **stat** does task-less project time award XP to? The project's stat —
    already how it works, and the project is exactly what we now hang the
    session on. (Only relevant for `timer`/`manual`, not `import`.)
  - Import UX: one row at a time, or a bulk/lump-sum entry ("120h on Health
    before 2026-07-01")? A lump sum needs a synthetic date range and would
    distort the per-day chart — recommend **one session per entry**, with a
    quick repeat-entry form.

### 5. More data in the profile; the AI can see it
- [ ] Profile gains an optional **user description**: age, weight, height, and a
      free-text "about me". **All optional**, all editable, none required.
- [ ] These feed the **companion prompt** — the AI should know who it is talking
      to (it already gets an app snapshot; this is the person snapshot). Build it
      server-side into `src/lib/ai/snapshot.ts`, like everything else the AI sees.
- **Open decisions:**
  - Fixed columns on `profiles` (`age`/`birthdate`, `height_cm`, `weight_kg`) vs.
    a single `about jsonb`. Recommend: **a few typed columns + one free-text
    `bio`** — the typed ones are the ones a future feature (Vitality goals,
    workout module) would actually compute with.
  - Weight is a *changing* number. Storing one value is fine for the AI; a
    weight **history** is a different feature (belongs with the deferred workout
    module) — don't build it here.
  - Privacy: this is real personal data going to Anthropic in every turn. Fine
    while Marko is the sole user; it becomes a **privacy-policy line item** in
    Stage 2 (§E) and should be listed there.

### 6. Bind the companions' affection & respect to XP
- **Decided (2026-07-14): the link runs XP → bond.** The companion's affection
  and respect are driven by Marko's **actual progress** — XP gained, levels,
  streaks — so the AI's regard is *earned* by the grind, and drifts when he
  slacks. (The reverse direction — bonding for XP — was considered and rejected:
  it turns chatting into an XP farm.)
- [ ] Feed progress deltas since the companion's `last_seen_at` into the turn
      (XP gained, levels crossed, tasks/sessions completed) and let them move
      `companion_state.relationship.affection` / `.respect` — the existing
      `update_state` tool already writes these axes.
- **Open decisions:**
  - **Deterministic or model-driven?** Two options: (a) the DB/server computes a
    respect delta from XP and applies it, the model only narrates it; (b) the
    progress numbers go in the prompt and the model decides the delta via
    `update_state`. Recommend **(a) for respect** (it should be objective and
    un-flatterable) and **(b) for affection** (it's a feeling — how he *talks* to
    her should still matter more than his level).
  - Interaction with the existing **absence decay** — decay on absence already
    exists; "slacking while present" is new. Keep one decay path, not two.
  - Per-companion or shared? State is per-companion by design (nothing is shared
    between bots) — the *input* (his XP) is global, the *reaction* stays private
    to each bot.

### 7. Stats page: colour-coded per category + more insight
- [ ] **Colour-code by stat category.** This **reverses a Phase 5 decision** — the
      chart is single-hue (accent) today *on purpose*, because the six stat
      colours in `src/lib/stats.ts` fail contrast/CVD checks as a categorical
      palette (see AGENTS.md, Phase 5). Marko wants the colour anyway, so the
      work is **not** "apply `STATS[stat].color`" — it is **design a categorical
      palette for the six stats that actually passes CVD**, then apply it in the
      chart, the distribution rows, and (for free) the project glyphs. Use the
      `dataviz` skill for the palette + validator; the stat colours may need to
      change everywhere, which is a Phase-7 theming question too.
- [ ] **More insightful info.** Today: tracked total, avg/day, per-active-day,
      active days, best day, per-day column chart, per-project distribution.
      Candidates to add (pick with Marko — a couple, not all):
  - **Per-stat breakdown** — time and XP per RPG stat, i.e. where the character
    is actually being levelled vs. neglected. This is the one the colour-coding
    is really asking for.
  - **Trend vs. the previous period** ("+18% vs. last month") on the KPI tiles.
  - **Streaks / consistency** — current and longest active-day streak; the
    recurring-task completion rate (`task_completions` is already the data).
  - **Time of day / day of week heatmap** — when Marko actually works.
  - **Estimate vs. actual** — `tasks.estimate_minutes` is captured and never used.
- **Open decision:** does the stats range filter also scope the new per-stat/XP
  panels (recommend yes — one range control for the page, as today).

---

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

## Current status snapshot (updated 2026-07-14)
- **Stage 1.5 (second MVP round) is the current work** — seven tasks captured
  2026-07-14 from Marko's use of the app, ordered above. Nothing started yet.
  Two decisions are already made and must not be re-litigated: imported time
  awards **no XP**, and the bond link runs **XP → affection/respect**, not the
  other way.
- Phase 7 polish now comes **after** Stage 1.5 (the nav and the stat palette are
  design decisions Stage 1.5 settles).
- **Stage 1 is COMPLETE.** All four tasks shipped:
  1. subtasks + progress bar — `3647cba`
  2. timer out of the corner — `ca4357a`
  3. calendar DnD on touch — resolved inside the design pass (date field is the
     touch path; drag copy is pointer-gated)
  4. mobile / design pass — audited at 375px and fixed; see above
- **After Stage 1.5: Phase 7 polish** — theming pass, animations, PWA install.
  The responsive audit that Phase 7 used to carry is done.
- Stage 2 (go public) — not started. Biggest financial risk stands: `/api/ai/*`
  has no per-user quota and the `ANTHROPIC_API_KEY` is shared.
- Everything through Phase 6 + the 2026-07-05 testing-feedback pass is shipped
  and deployed (see AGENTS.md status + git log).
