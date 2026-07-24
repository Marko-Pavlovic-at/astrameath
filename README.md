# Astrameath

**Level up your life.** Astrameath is a gamified life-tracker: a personal
productivity app that turns real-world effort — time tracked, tasks finished,
goals reached — into XP, levels, and unlockable rewards, wrapped in a dark
game-UI (think Hollow Knight / Dark Souls / Wuthering Waves). It's the V2 rewrite
of an earlier app ("Ascendant"), built as a private, invite-only tool.

> Status: active development. Private repo, single user. Not open for signups.

## What it does

- **Projects & tasks** — organize what you're working on into projects, each
  tied to a life "stat". Break work into tasks and subtasks.
- **Time tracking** — a live, one-timer-at-a-time stopwatch. Starting a timer
  is literally an open time-session; totals roll up per task and per project.
  You can also log or import time directly on a project.
- **Recurrence & calendar** — daily / weekly / monthly recurring tasks, shown
  across month, week, and day calendar views with drag-and-drop scheduling.
  Recurring occurrences are derived, never stored.
- **Gamification** — earn XP for tracked time, completed tasks, milestones, and
  goals. Levels, streaks, and stat archetypes are all computed at read time from
  raw XP events. Hitting general-level thresholds unlocks titles, items, and
  color themes.
- **Stats** — a filterable dashboard of tracked time: KPI tiles, per-day and
  per-week charts, and per-project distribution.
- **AI companions** — user-authored AI characters you can chat with. Each has a
  persona and an evolving relationship (affection / trust / respect / amusement /
  annoyance) that shifts with your real progress in the app. They remember past
  conversations via automatic memory compression.

## Design principles

- **Derive, don't persist.** Levels, streaks, totals, and archetypes are always
  computed on read. Only raw XP events are stored — the numbers can never drift.
- **The database is the source of truth.** XP is awarded and revoked by Postgres
  triggers, and every table is protected by row-level security.
- **Dark, game-flavored UI** with theming and motion as first-class concerns.

## Tech stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript** (strict)
- **Tailwind CSS v4** for styling and design tokens
- **Supabase** (Postgres + Auth + RLS) for data and authentication
- **TanStack Query** for the client data layer
- **Anthropic Claude** (Haiku, streamed) for AI companions
- **Framer Motion** for animations; installable as a **PWA**
- Deployed on **Vercel**

## Getting started

Requires Node.js and a Supabase project with the schema from
`supabase/migrations/` applied.

```bash
npm install
npm run dev      # dev server → http://localhost:3000
```

Create a `.env.local` with:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
ANTHROPIC_API_KEY=your-key        # server-side only, for AI companions
```

Auth is **invite-only**: there is no sign-up flow. Users are created manually in
the Supabase dashboard.

## Scripts

```bash
npm run dev      # start the dev server
npm run build    # production build (run before every commit)
npm run lint     # ESLint
```

There is no automated test suite; changes are verified manually in the browser.

## Project structure

```
src/
  app/            # App Router — (app) routes, /login, /api/ai/* handlers
  components/     # client components (projects, calendar, companions, stats…)
  lib/
    queries/      # TanStack Query hooks
    supabase/     # browser + server clients, generated types
    ai/           # persona, prompt, state, snapshot, pricing (mostly pure)
    xp.ts, recurrence.ts, dates.ts, time-stats.ts   # pure domain logic
  proxy.ts        # auth gate (Next 16's renamed middleware)
supabase/migrations/   # SQL schema + triggers + views
docs/plans/            # requirements, schema plan, roadmap
```

Contributor notes and architecture gotchas live in `AGENTS.md`.
