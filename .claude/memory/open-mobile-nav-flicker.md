---
name: open-mobile-nav-flicker
description: "Bottom-bar flicker on Marko's real phone — DO NOT debug in isolation: the 2026-07-14 mobile-nav redesign (bottom bar → hamburger top bar, Stage 1.5 task 1) deletes the element that flickers"
metadata: 
  node_type: memory
  type: project
  originSessionId: 8191b2a7-fb08-4661-b9b8-6364dad9a87a
---

**FIX SHIPPED 2026-07-14 (`3866e39`), AWAITING MARKO'S PHONE.** The mobile bottom nav
became a `sticky top-0` hamburger bar, and the floating timer bar folded into it
(`timer-bar.tsx` deleted) — so **no element on mobile is anchored to the viewport bottom
any anymore**, which is the entire mechanism of this bug (the browser repositions
bottom-fixed elements every frame as the URL bar slides; the top edge doesn't move).
A Playwright check now asserts "nothing fixed and flush with the viewport bottom" on
every route.

**The one thing that can't be verified here:** headless Chromium never moves a URL bar,
so only Marko can confirm the flicker is actually gone. **Ask him to scroll around on his
phone; if it's clean, delete this memory.** Do not re-open the old debugging paths below —
they applied to an element that no longer exists.

**Open bug, not fixed.** The fixed mobile bottom bars (`nav.tsx` bottom nav, and
`timer-bar.tsx` when a timer runs) **still flicker / lag behind the scroll on
Marko's real phone**. Verified by him on-device 2026-07-13, after commit
`e25a391`.

What was already tried in `e25a391` — helped ("better") but did NOT fix it:
- `min-h-dvh` → `min-h-svh` on body, app shell, login, and the chat height calc
  (dvh recalculates as the mobile URL bar slides, relaying out the page on
  scroll frames). Desktop sidebars still use dvh, deliberately.
- `transform-gpu` + `will-change-transform` on both fixed bars (own compositing
  layer, so they aren't repainted every frame).

**Why:** Only Marko can see this. Scroll jank does **not** reproduce in headless
Chromium — the URL bar never moves, so the whole class of bug is invisible to
the Playwright harness (see [[browser-verification-setup]]). Do not claim it
fixed without his confirmation.

**Next suspects, untried:**
- `timer-bar.tsx` offset is `bottom-[calc(3.25rem+env(safe-area-inset-bottom))]`
  — `env(safe-area-inset-bottom)` also changes as the toolbar collapses, so the
  bar's *position* is still viewport-dependent. Try a static offset, or move the
  timer bar inside the nav's stacking context so only one element is pinned.
- The nav has `pb-[env(safe-area-inset-bottom)]` — same concern.
- Consider `position: sticky` on a wrapper instead of two independently-fixed
  elements, or promoting the scroll container.

**How to apply:** Next session on Astrameath mobile polish, start here before
Phase 7 theming. Related: [[project_v2_rework]].
