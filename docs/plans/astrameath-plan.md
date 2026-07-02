# Astrameath — Architecture & Build Plan

Companion to `astrameath-requirements.md`. Written 2026-07-02, to be reviewed with
Marko **before any code**.

## 0. Where the code lives

**Orphan branch `astrameath`** in this repo (no shared history with V1's `main`, so the
tree is a clean Next.js scaffold and V1 stays untouched on `main`). If it ever feels
cramped we can split it into its own repo later — orphan history makes that trivial.

New infra, created during Phase 1:
- **Supabase project `astrameath`** (separate from V1's "Ascendant" project)
- **Vercel project `astrameath`** (separate deployment; `ANTHROPIC_API_KEY` server-side only)

## 1. Stack (decided)

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router), TypeScript strict |
| Hosting | Vercel; route handlers for the Claude proxy |
| DB / Auth | Supabase Postgres — migrations via Supabase CLI, RLS on every table, generated types |
| Auth mode | **Invite-only**: public signups disabled in Supabase auth settings; Marko's account created manually (beta testers later, also manual). Login page has no register flow. |
| Data fetching | TanStack Query + supabase-js |
| Styling | Tailwind + custom design tokens (game UI); Framer Motion for light animations |
| PWA | manifest + installable, mobile-first, `100dvh` / safe-area lessons carried from V1 |

## 2. Database schema (draft)

All tables have `id uuid pk default gen_random_uuid()`, `user_id uuid references auth.users`,
`created_at timestamptz default now()`, and RLS `user_id = auth.uid()` unless noted.

### Identity & gamification

- **`profiles`** — `id` (= auth.users.id), `display_name`, `avatar_url`, `active_title`,
  `active_theme`, `last_seen_at`.
- **`xp_events`** — append-only XP ledger: `stat` (enum below), `amount int`,
  `source` (`time` | `task_completion` | `milestone` | `goal` | `streak`),
  `ref_id uuid null` (the task/session/milestone that caused it).
  **Levels are never stored** — per-stat level and the general level (composed from the
  six stat levels) are derived in code from summed XP. Index `(user_id, stat)`.
- **`unlocks`** — earned rewards: `kind` (`title` | `item` | `theme`), `key text`,
  `unlocked_at`. The reward *catalog* (what unlocks at which level) lives in code, not DB.
- **`stat` enum:** `strength | vitality | intelligence | discipline | creativity | social`.

### Projects & tasks

- **`projects`** — `name`, `description`, `stat` (the RPG category), `color`, `icon`,
  `position`, `archived_at null`.
- **`goals`** — `project_id`, `title`, `deadline date null`, `completed_at null`, `position`.
- **`milestones`** — `goal_id`, `title`, `deadline date null`, `completed_at null`,
  `position`. *(Modeled as steps toward a goal — veto if you meant project-level milestones.)*
- **`tasks`** — `project_id`, `title`, `notes`, `status` (`todo | in_progress | done`),
  `priority` (`low | medium | high | urgent`), `estimate_minutes int null`,
  `scheduled_date date null`, `scheduled_time time null`, `recurrence jsonb null`,
  `completed_at`, `position`.
  - `recurrence` (e.g. `{freq: "weekly", days: [1,3,5]}`) marks a **recurring task**;
    it acts as a template and is never "done" itself.
- **`task_completions`** — per-occurrence completion of recurring tasks:
  `task_id`, `date date`, `completed_at`. Unique `(task_id, date)`.
  This is what streak queries (and the future habit-filter module) read.
- **`time_sessions`** — `task_id`, `started_at`, `ended_at null`, `source`
  (`timer | manual`), `note`.
  - A running timer **is** a row with `ended_at is null`; a partial unique index enforces
    max one running session per user. Survives reload/tab-switch for free (V1 lesson,
    done properly). 12h cap enforced on stop, as in V1.
  - Project total time and all stats aggregate from this table.

### AI companions

- **`companions`** — `name`, `avatar_url` (Supabase Storage bucket `avatars`),
  `persona jsonb` (joyland-style template: personality, greeting, scenario, example
  dialogs — exact fields researched in Phase 6), `model` (default `claude-haiku-*`).
- **`companion_state`** — 1:1 with companion: `relationship jsonb`
  (`{affection, respect, amusement, annoyance, …}` 0–100 clamped), `mood`,
  `mood_reason`, `last_seen_at` (absence decay as in V1).
- **`companion_messages`** — chat memory: `companion_id`, `role`, `content`.
- **`companion_memories`** — permanent compressed facts: `companion_id`, `content`,
  `importance`. Nothing shared between companions.
- **`ai_usage`** — cost ledger: `companion_id`, `input_tokens`, `output_tokens`,
  `cost_usd`. Replaces V1's single lifetime-USD number with real per-bot accounting.
  **MVP requirement:** cost is displayed in the UI as in V1 (session + lifetime USD)
  so spending stays visible during testing. Post-MVP (Public Prep) this same ledger
  becomes the basis for enforced per-user quotas.

### Reset buttons [req 16]

"Reset app data" = delete rows in domain tables; "Reset AI data" = delete rows in
companion tables. Both are simple, separable deletes because the two worlds share no
tables — the schema is partitioned deliberately for this.

## 3. App structure

```
app/
  (auth)/login
  (app)/                     ← authed shell: sidebar (desktop) / bottom nav (mobile)
    projects/                ← project list (life areas)
    projects/[id]/           ← tasks, goals/milestones, project time, filters
    calendar/                ← month | week | day; undated-task sidebar, drag-drop
    stats/                   ← time distribution, frequency, avg/day, week/month
    profile/                 ← general + stat levels, titles, items, themes
    companions/              ← bot list, create/edit (template form)
    companions/[id]/         ← chat
  api/ai/chat/route.ts       ← streaming Claude proxy (JWT-validated, key server-side)
  api/ai/memorize/route.ts   ← compress chat → long-term facts
lib/
  supabase/ (server + browser clients, generated types)
  xp.ts     (curve, stat levels → general level — pure, derive-only)
  streaks.ts, recurrence.ts, time.ts
  rewards.ts (catalog: titles/items/themes per level)
components/ (game-UI primitives: panels, meters, stat rings…)
```

**Companion turn architecture:** carry over V1's Claude-path design — single streamed
inference per turn with a force-called `update_state` tool (reply text + relationship
deltas/mood/memory in one call), prompt-cached stable prefix + dynamic tail, and the
app snapshot as the AI's window into stats. It worked well; only the storage moves
from KV to real tables.

## 4. Phases

Each phase ends with something usable and reviewed before the next starts.

1. **Foundation** — orphan branch, Next.js + TS + Tailwind scaffold, new Supabase
   project with **signups disabled + Marko's account created manually**, login flow
   (no register), full schema migration + RLS, generated types, deployed shell on new
   Vercel project. *Exit: log in on prod URL, empty app shell on phone + desktop.*
2. **Core domain** — projects CRUD, tasks CRUD with status/priority/estimate/filters,
   start/stop timer + manual sessions, project total time. *Exit: daily-usable tracker.*
3. **Recurrence + calendar** — recurring tasks, per-day completions, month/week/day
   views, undated-task sidebar with drag-and-drop.
4. **Gamification** — XP ledger wired to time/completions/milestones, stat + general
   levels, reward catalog (titles, items, themes), profile page.
5. **Stats page** — time distribution, frequency, avg/day, this week/month.
6. **AI companions** — template research (joyland.ai), character creation with avatar
   upload, chat with relationship state + dual memory, cost tracking **with V1-style
   session + lifetime USD display in the UI**, both reset buttons.
7. **Game-UI polish** — theming pass (Hollow Knight / Dark Souls / WuWa mood),
   animations, PWA install, responsive audit at 375/900/1200px (Playwright MCP).

**Post-MVP: Public Prep** (not a numbered phase — happens only if/when Astrameath goes
public): Stripe payments + subscriptions, enforced per-user AI quotas & rate limits on
`/api/ai/*` (built on the `ai_usage` ledger), security hardening pass, enable public
signup. Until then: invite-only, accounts created manually by Marko.

Design (§ req 15) is not a phase: the token system and game-UI primitives are built in
Phase 1–2 so everything lands styled; Phase 7 is refinement, not restyling.

## 5. Standing decisions (carried from V1 lessons)

- Derive, don't persist: levels, streaks, archetypes, totals.
- Optimistic UI everywhere; server is source of truth on reload.
- `ANTHROPIC_API_KEY` never gets a `VITE_`/`NEXT_PUBLIC_` prefix.
- 16px minimum input font (iOS zoom), safe-area insets, `100dvh`.
