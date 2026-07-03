<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Astrameath

Gamified life-tracker ("level up your life"), V2 rewrite of the habitflow/"Ascendant"
app. **Completely separate entity from V1**: this is an orphan branch (`astrameath`)
of the habitflow repo checked out as a git worktree; V1 lives on `main` at
`../habitflow` and its Supabase project (`ftewcdmoojohaqphhubm`, "Ascendant") and
Vercel project must NEVER be touched from here.

Full specs: `docs/plans/astrameath-requirements.md` (what & why, decisions log) and
`docs/plans/astrameath-plan.md` (schema, structure, phase plan). Read them before
larger changes.

## Commands

```bash
npm run dev                # Next dev server (localhost:3000)
npm run build              # production build (run before every commit)
npm run lint               # ESLint
vercel deploy --prod --yes # deploy → https://astrameath.vercel.app
```

## Infra

- **Supabase project `astrameath`** — ref `wmnqmssdrwtseovjozxm` (eu-west-1).
  Schema changes: write a file in `supabase/migrations/` AND apply via Supabase MCP
  `apply_migration`, then update `src/lib/supabase/types.ts` (regenerate or hand-patch
  in generator shape). RLS (`user_id = auth.uid()`) on every table — keep it that way.
- **Auth is invite-only:** signups disabled in the dashboard; users are created
  manually there. The login page has no register flow. Sole user: Marko.
- **Vercel project `astrameath`** — env vars `NEXT_PUBLIC_SUPABASE_URL` /
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` set for Production (preview env missing;
  CLI v54.0.0 `env add ... preview` is buggy). `ANTHROPIC_API_KEY` comes in Phase 6,
  server-side only — never `NEXT_PUBLIC_`.

## Architecture

- **Next 16 App Router + TypeScript strict + Tailwind v4** (tokens in
  `src/app/globals.css` `@theme`: bg/panel/panel-2/edge/fg/muted/accent/gold/danger).
  Dark game-UI (Hollow Knight / Dark Souls / WuWa mood); full theming pass is Phase 7.
- **`src/proxy.ts`** is the auth gate (Next 16 renamed middleware→proxy). GOTCHA:
  the matcher must be exported as `export const config` — NOT `proxyConfig` (some
  docs claim otherwise; with the wrong name the matcher is ignored and the proxy
  redirects static assets to /login, shipping a styled-less page with dead JS).
- **Supabase clients:** `src/lib/supabase/client.ts` (browser, memoized) and
  `server.ts` (RSC, async cookies). Generated types in `types.ts`.
- **Data layer:** TanStack Query hooks in `src/lib/queries/` (projects, tasks,
  sessions). Pages under `src/app/(app)/` are thin server shells rendering client
  components from `src/components/`.
- **Time tracking:** a running timer IS a `time_sessions` row with `ended_at null`
  (partial unique index → max one per user). Totals come from SQL views
  `task_time_totals` / `project_time_totals` (finished sessions only; the live
  session is rendered by `src/components/timer-bar.tsx`). Sessions >12h are
  discarded on stop.
- **Derive, don't persist** (hard rule from V1): levels, streaks, totals, archetypes
  are always computed at read time. XP is stored only as raw `xp_events` rows.
- Inputs stay ≥16px font below 900px (iOS zoom guard, see globals.css).

## Status (2026-07-03)

- Phase 1 (foundation: schema, auth, shell, deploy) — done, verified.
- Phase 2 (projects, tasks, timer, time tracking) — done, verified by Marko.
- Phase 3 (recurrence + calendar) — done, verified end-to-end in browser,
  reviewed by Marko (incl. drag-and-drop on real mouse). Follow-ups shipped:
  calendar view/date in URL search params (browser back retraces month→day),
  ← Month button, start/stop timer on day-view rows.
  Recurrence lives in `src/lib/recurrence.ts` (daily / weekly-days / monthly-day,
  anchored at scheduled_date or creation date; occurrences derived, never stored).
  Calendar month/week/day in `src/components/calendar/`; undated sidebar with
  HTML5 drag-and-drop + date-input fallback. Local dates via `src/lib/dates.ts`
  ("YYYY-MM-DD" strings, never toISOString). Recurring task checkboxes toggle
  `task_completions` for today (optimistic).
- Phase 4 next: gamification — XP ledger wired to time/completions/milestones,
  stat + general levels, reward catalog, profile page (+ goals/milestones UI).
- Then: 5 stats, 6 AI companions, 7 game-UI polish. Post-MVP: Public Prep
  (Stripe, AI quotas, open signup), community, module system. Details in the
  plan doc.
