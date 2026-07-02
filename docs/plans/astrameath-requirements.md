# Astrameath — V2 Requirements

Captured 2026-07-02 from Marko's paper notes, refined through Q&A the same day.
Astrameath is a **completely new entity**: separate branch, new Supabase project, new
Vercel project. It must never touch V1 ("Ascendant") data or infrastructure.

Numbers in brackets `[n]` reference the original note items.

## 0. Decided: architecture & stack

Marko's direction: *"a professional full-stack app"* — TypeScript + real relational
schema confirmed by him; the rest delegated to Claude. Decisions:

- **TypeScript** everywhere. **Real Postgres schema** with migrations + RLS on a new
  Supabase project (via Supabase CLI; generated TS types). No KV table this time.
- **Next.js (App Router) on Vercel.** Server routes replace V1's lone edge function:
  Claude proxy, and any future server-side needs. The app itself stays highly
  client-interactive (timers, drag-and-drop, chat).
- **Auth (MVP = invite-only):** Supabase email auth with **public signups disabled**.
  Exactly one account at the start — Marko's, created manually. Beta-tester accounts
  can be created manually later. The schema stays multi-user-ready throughout; open
  signup arrives with Public Prep (post-MVP).
- **Responsive PWA, mobile-first, works equally on desktop** (Marko: "should work for
  both"). Installable manifest like V1.
- **UI:** Tailwind + custom design tokens for the game aesthetic; a light animation
  library (e.g. Framer Motion) for the "light animations" requirement.
- **Server state** via TanStack Query; minimal local state for live things (active timer).

## 1. Core domain: Projects & Tasks

- **Projects represent life areas** (Health, Work, …), created freely by the user. [1]
- **Tasks live inside projects.** Each task has: [2]
  - time tracking — **start/stop timer is the primary mode; manual entry also supported**
  - status
  - priority
  - optional estimated time
  - optional date → appears in the calendar [7]
  - filtering across these fields
- **Recurring tasks are core.** Habit tracking is *not* a separate core system — the
  working idea is "everything is a task"; habits emerge as recurring tasks viewed
  through special filters (see deferred module/filter-tab idea, §9). [6-answer]
- **Project total time** is displayed, computed as the sum of its tasks' tracked time. [3]
- **Projects have goals and milestones**, each optionally with a deadline. [4]
- **Each project has an RPG-stat category** (e.g. Health/Strength, …) tying it into the
  gamification layer. [6]

## 2. Stats page

A dedicated tab showing all projects with: [5]
- time distribution across projects
- frequency (how often worked on)
- detailed time stats: avg/day, this week, this month, etc.

## 3. Calendar

A dedicated tab (like Stats). [7]
- Dated tasks appear on the calendar.
- **Undated tasks** appear in a sidebar on the calendar page and can be
  **drag-and-dropped** onto the calendar, or given a date by manual edit. [8]

## 4. Gamification

- **Full XP system** — *everything* meaningful grants XP (task completions, milestones,
  …) but the **main XP curve comes from tracked time**. [10, 7-answer]
- **Per-stat levels:** each RPG stat has its own level; the **general level is composed
  from the stat levels**. (V1 lesson applies: store raw XP only, derive all levels at
  read time — never persist a level number.)
- **Rewards:** titles and items, Habitica-style; also **unlockable page designs/themes**.
- **Profile page.** [10]

## 5. AI companion

- Backed by **paid Claude Haiku** (as in V1's Claude path). [11]
- The AI **oversees the app**: it sees all stats and helps the user stay committed. [11]
- **User-created characters:** user can import a profile picture for the AI and write a
  roleplay prompt; research the joyland.ai character-template format (or similar) as the
  authoring model. [12]
- **Relationship stats** simulating feelings toward the user, e.g. annoyance, amusement,
  respect, affection. [13]
- **Two memory systems:** [14]
  1. chat memory (conversation history)
  2. long-term memory — important facts about the user are compressed and saved permanently
- **Multiple AI chatbots** can be created; **each has its own relationship stats and
  memories — nothing is shared between bots**. [17, 8-answer]
- **AI usage cost is displayed in the UI, as in V1** (session + lifetime USD) — MVP
  requirement, so spending is visible during testing.

## 6. Design & feel

- Simple, **game-like dark UI**: RPG / apocalyptic sci-fi future. [15]
- Light animations.
- Mood references: **Hollow Knight, Dark Souls, Wuthering Waves**.
- The app should *feel like a game UI*, not a productivity SaaS.

## 7. Data management

- A button to **reset app data** and a separate button to **reset AI data**. [16]

---

## Post-MVP / deferred

- **Public Prep** — everything needed to open the app to real users, bundled:
  payments/subscriptions (Stripe), per-user AI quotas & rate limits on the proxy
  (enforced, not just recorded), security hardening pass, enabling public signup.
  Until then the app runs invite-only with Marko as the sole account.
- **Community features** [10] — explicitly deferred. Schema stays multi-user-ready so
  this can land later without a rework.
- **Module system** [9] — deferred; the best shape is unknown. Marko's leading idea:
  an extra tab where the user **creates their own filters/views** (e.g. streak views
  over recurring tasks → a habit tracker; similarly workout tracker, craving timer).
  The "everything is a task + user-defined dynamic views" direction should be kept in
  mind when designing the task schema, so it stays possible.

## Final confirmations (2026-07-02)

- **RPG stat set (fixed, 6):** Strength, Vitality, **Intelligence**, Discipline,
  Creativity, Social. User-customizable stats are post-MVP.
- **Calendar views:** month (default), week, and day. Dated tasks get an optional
  time-of-day.

Next artifact: `astrameath-plan.md` — schema, app structure, MVP phase plan.
