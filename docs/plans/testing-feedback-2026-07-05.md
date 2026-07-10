# Testing feedback — 2026-07-05 (Marko's first full test pass)

> **Status: items 1–5, 7, 8 SHIPPED 2026-07-05** (commits 6ba8b54, a2419d4, 131ef12;
> verified in browser 13/13, deployed to prod). Item 6 (Vercel vs VPS hosting cost)
> is a business decision — **decided 2026-07-10: VPS** (see
[mvp-to-launch.md](mvp-to-launch.md) → Stage 2C).

Raw feedback from testing the deployed app after Phase 6. Documented only — no fixes
applied yet. Code-check notes added where I verified the current behaviour.

## 1. Milestones not discoverable

Marko couldn't find where to add milestones — only goals were visible.

**Code check:** an add-milestone form *does* exist inside each goal card
(`goals-section.tsx` — "Milestone…" input with "+ Add" button, rendered per goal).
So this is a discoverability/UX problem, not a missing feature. Verify when/why the
form isn't visible (collapsed state? styling? below the fold?) and make it obvious.

## 2. AI can't see projects and tasks

Marko created projects and tasks but the AI couldn't see them.

**Code check — confirmed.** `src/lib/ai/snapshot.ts` (the AI's only window into app
data) currently includes only:

- General level + lifetime XP total
- Time tracked today
- Currently running timer (+ task title)
- Today's task occurrences: done/open counts, max 3 open titles

**Not** in the snapshot: projects, goals, milestones, tasks not scheduled today,
per-stat levels, streaks. So anything the user just created is invisible to the AI
unless it's a task due today.

→ Expand the snapshot (projects with their goals/milestone progress, upcoming
tasks) while keeping it compact for prompt-cache friendliness.

## 3. AI should be available everywhere (right sidebar)

The companion should be reachable from every view — e.g. a persistent right sidebar
on desktop — not confined to its own tab/page. (Mirrors V1's ≥1200px side-panel
layout.)

## 4. Character template needs a backstory section

The AI character template should have a dedicated **backstory** section (separate
from personality/persona examples).

## 5. No visibility of progress toward next level

Nowhere in the UI shows how far you are from the next level (XP remaining /
progress bar). `levelFromXp` already returns level info, so the data exists —
it's a display gap.

## 6. Hosting cost worry — Vercel vs VPS

To monetize (accept payments / commercial use), Vercel requires the Pro plan at
~€20/month, which feels too expensive at this stage. Considering self-hosting on a
VPS instead. Needs a proper cost/effort comparison before MVP launch:

- Vercel Pro: zero-ops, but €20/mo fixed + usage
- VPS (e.g. Hetzner ~€4–6/mo): Next.js self-hosted (standalone build / coolify /
  dokku), own TLS + deploys + monitoring; Supabase stays managed either way

No decision yet — document options, decide later.

## 7. Non-XP tag for casual projects

Need a way to mark certain projects (hobbies that aren't "serious", e.g. gaming) as
**no-XP** so tracked time / completions there don't award XP. Equivalent of V1's
"No XP" toggle (commit `4ab27f5` in V1), but at the project level.

## 8. AI should have a sense of time

Marko felt the AI lacks time awareness.

**Code check:** `src/lib/ai/prompt.ts` already injects current local date + time,
period of day, and minutes since the last user message. So the plumbing exists but
apparently doesn't come through in conversation. Investigate: is the dynamic tail
actually reaching the model, and/or does the persona need explicit instruction to
use it (referencing time of day, gaps between chats, "yesterday you…")?
