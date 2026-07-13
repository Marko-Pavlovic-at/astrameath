---
name: browser-verification-setup
description: "How to do browser verification on Marko's machine — Playwright MCP broken (needs Chrome + sudo), use playwright-core + /usr/bin/chromium; GoTrue test-user SQL recipe"
metadata: 
  node_type: memory
  type: reference
  originSessionId: e34e94c5-346d-415c-bf0b-b893601898c6
---

Browser-verifying [[project-v2-rework]] (or anything) on this machine (2026-07-03):

- **Playwright MCP is unusable:** it demands Google Chrome at `/opt/google/chrome/chrome`; only `/usr/bin/chromium` is installed and `npx playwright install chrome` needs sudo (no non-interactive password). Instead: `npm i playwright-core` in the scratchpad and `chromium.launch({ executablePath: "/usr/bin/chromium" })` — works fine.
- **Playwright can't trigger native HTML5 drag-and-drop** in Chromium via mouse events (`dragTo` moves the mouse but no drag events fire). Dispatch `DragEvent`s with a constructed `DataTransfer` via `page.evaluate` instead — still exercises the app's real React handlers.
- **Temp test users for invite-only Supabase apps:** insert into `auth.users` + `auth.identities` via SQL (MCP `execute_sql`), then **set all token/change varchar columns to `''`** (confirmation_token, recovery_token, email_change*, phone_change*, reauthentication_token) — GoTrue errors with an empty `{}` message on NULLs. Delete the auth.users row afterwards; FK cascades clean up everything. Marko's real password is unknown by design — never reset it.
- **Touch/pointer CSS can't be verified with `isMobile`/`hasTouch` alone** (learned 2026-07-13, mobile design pass): Chromium under Playwright still reports `pointer: fine`, so any `pointer-coarse:` / `pointer-fine:` styling silently takes the *desktop* branch and your test measures the wrong thing. Force it via CDP: `ctx.newCDPSession(page)` → `Emulation.setEmulatedMedia({features:[{name:"pointer",value:"coarse"}]})`. **The override resets on navigation** — re-apply it on the final page. It also bleeds across contexts in one browser, so use a fresh `chromium.launch()` per pointer type or the two runs contaminate each other (this produced a convincing-looking inverted result).
- Full-page screenshots paint `position: fixed` elements at their *first-viewport* position, so a bottom bar appears floating mid-page and looks like it's occluding content. Don't diagnose overlap from a fullPage shot — scroll to the bottom and take a viewport-only screenshot, or probe with `elementFromPoint`.
- Controlled React checkboxes fail Playwright's strict `.check()` (state lands a frame later even with optimistic updates) — use `.click()` + poll `isChecked()`.
- `page.waitForFunction(fn, arg, options)` — options are the THIRD argument; passing `{timeout}` second silently becomes `arg` and the default 30s applies.
- Supabase `storage.objects` rows can't be deleted via SQL (protect_delete trigger) — use the Storage REST API with the temp user's own JWT (`POST /auth/v1/token?grant_type=password` → `DELETE /storage/v1/object/{bucket}/{path}`).
