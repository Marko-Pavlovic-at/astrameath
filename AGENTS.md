<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Astrameath

Gamified life-tracker ("level up your life"), V2 rewrite of the "Ascendant" app
(V1). Astrameath **is this repo's `main` branch** and lives in
`~/personal/webdev/projects/astrameath` (renamed from `habitflow` on 2026-07-14;
V1's branch, code and worktree are gone). Remote:
`github.com/Marko-Pavlovic-at/astrameath` (private). V1 was a **completely
separate entity** and its infra still exists: the Supabase project
`ftewcdmoojohaqphhubm` ("Ascendant") and its Vercel project must NEVER be touched
from here.

Full specs: `docs/plans/astrameath-requirements.md` (what & why, decisions log) and
`docs/plans/astrameath-plan.md` (schema, structure, phase plan). The **live roadmap
is `docs/plans/mvp-to-launch.md`** — it sets the order (Stage 1.5 → Phase 7 →
go-public). Read them before larger changes.

## Commands

```bash
npm run dev                # Next dev server (localhost:3000)
npm run build              # production build (run before every commit)
npm run lint               # ESLint
vercel deploy --prod --yes # deploy → https://astrameath.vercel.app
```

No automated test suite (no test runner in `package.json`). Verification is
manual, end-to-end in a real browser — recipe and gotchas in
`.claude/memory/browser_verification_setup.md`. Run `npm run build` before every
commit; a green build is the baseline gate.

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
  session's clock is rendered in `src/components/nav.tsx`, ticking once a second).
  Sessions >12h are discarded on stop.
- **Derive, don't persist** (hard rule from V1): levels, streaks, totals, archetypes
  are always computed at read time. XP is stored only as raw `xp_events` rows.
- Inputs stay ≥16px font below 900px (iOS zoom guard, see globals.css).

## Live status — read these, don't trust a date here

Phase/task state goes stale in a doc. The current source of truth is, in order:
`docs/plans/mvp-to-launch.md` (the roadmap: Stage 1.5 → Phase 7 → go-public),
`.claude/memory/` (what's built/committed/awaiting-test right now), and `git log`.
Check them before assuming any feature is or isn't done. Phases 1–6 (foundation,
projects+timer, recurrence+calendar, gamification, stats, AI companions) shipped
and deployed; Stage 1.5 and Phase 7 are the active fronts.

Two product decisions are **settled**: imported time awards **no XP**, and the
companion bond link runs **XP → affection/respect, never the reverse** (no
chat-farming).

## Subsystems (how each one works — evergreen)

- **Recurrence + calendar** (`src/lib/recurrence.ts`, `src/components/calendar/`):
  daily / weekly-days / monthly-day, anchored at `scheduled_date` or creation date;
  occurrences are **derived, never stored**. Undated sidebar uses HTML5
  drag-and-drop + a date-input fallback. Calendar view/date live in URL search
  params (browser back retraces month→day). Local dates via `src/lib/dates.ts`
  ("YYYY-MM-DD" strings, **never** `toISOString`). Recurring checkboxes toggle
  `task_completions` for today (optimistic).
- **Gamification / XP** — awarded and revoked by **DB triggers**
  (`supabase/migrations/20260703_xp_triggers.sql`): 1 XP/min tracked, 10 task
  completion (one-off or per-day), 25 milestone, 50 goal. Every award carries a
  `ref_id` so un-doing revokes exactly; hard-deleting a project revokes its XP,
  archiving keeps it. `xp_totals` view aggregates. Levels derive in `src/lib/xp.ts`
  (level-up cost 100 + 50/level; general level = Σ stat levels − 5). Reward catalog
  in `src/lib/rewards.ts` (titles/items/themes by general level; the `unlocks`
  table is intentionally unused — all rewards are level-derived). Themes swap
  `--accent` via `<html data-theme>` (ThemeApplier in the app layout, palette
  overrides in globals.css).
- **Stats** (`src/components/stats/stats-view.tsx`, `src/lib/time-stats.ts`):
  `["stats-sessions"]` fetches all finished sessions **once**, then pure client-side
  aggregation; a session is attributed to its **local start date**. The key lives
  in `sessions.ts` `TIME_KEYS` so timer mutations refresh it. A range filter scopes
  everything; the per-day column chart falls back to weekly buckets past 42 days;
  hover/focus sets a readout line (no floating tooltips, to avoid clipping).
  DESIGN CONSTRAINT: the six stat colors fail CVD checks as a categorical palette —
  any per-stat coloring must use a CVD-safe redesigned palette (Stage 1.5 work),
  not the raw stat hues.
- **AI companions** (`src/lib/ai/`, `src/components/companions/`,
  `/api/ai/chat` + `/api/ai/memorize`, Node route handlers, cookie-auth via the
  Supabase server client): one **streamed Haiku** inference per turn returns
  in-character text **and** an `update_state` tool call in the same response.
  GOTCHA (V1 lesson): `tool_choice` must stay `auto` — forcing `{type:"tool"}`
  makes Anthropic skip the text reply. System prompt = cached stable prefix
  (persona) + dynamic tail (temporal, relationship-as-language, mood, app snapshot,
  recent events, memories); the snapshot is built **server-side** from the DB
  (`src/lib/ai/snapshot.ts` — the only impure file in `src/lib/ai/`), the client
  only sends `tzOffsetMinutes`. Personas are user-authored joyland-style templates
  (`{{char}}`/`{{user}}` placeholders) in `companions.persona`. Relationship axes:
  affection/trust/respect/amusement/annoyance (0–100, archetype derived, absence
  decay on load). Chat memory = `companion_messages` rows; past ~80 messages the
  client fires `/api/ai/memorize`, which compresses the oldest chunk into
  `companion_memories` (structured output) and **deletes** those rows. Cost is
  logged per call in `ai_usage` (session/companion/lifetime USD shown in the chat
  "Bond" panel). ENV: `ANTHROPIC_API_KEY` is set on all three Vercel envs +
  `.env.local`; verify a pulled value is non-empty — `vercel env pull` writes empty
  values for `sensitive`-type vars without erroring.
