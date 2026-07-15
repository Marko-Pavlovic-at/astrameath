/**
 * A template (not a layout) re-mounts on every navigation, so this fade-up plays
 * on each route change — the app-wide page transition for the Phase 7 pass.
 * Honours prefers-reduced-motion via the guard in globals.css.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-up">{children}</div>;
}
