---
name: pending-post-swap-cleanup
description: "Deferred follow-ups after the 2026-07-10 astrameath→main branch swap: fresh npm install + optional folder rename"
metadata:
  type: project
---

Deferred to a future session (Marko had to leave for work on 2026-07-10, right after the astrameath→main branch swap — see [[project-v2-rework]]):

- **Run a fresh `npm install`** in `/home/marko/personal/webdev/projects/habitflow`. The dir still holds V1's Vite `node_modules`, but `main` is now the astrameath Next 16 app, so `npm run dev` will break until deps are reinstalled (`rm -rf node_modules && npm install`).
- **Optional: rename the project folder** `habitflow` → `astrameath` to match the app. Note the tradeoffs before doing it: it changes the cwd and Claude Code's memory-dir path key, so re-run `.claude/link-memory.sh` afterward to re-point the symlink.

Once both are done, delete this memory.
