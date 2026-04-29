/**
 * Page-wide ambient effects: scanlines, ambient circuit lines, corner brackets.
 * Place once near the root of a route's main element; pointer-events disabled.
 */
export function BackgroundFX() {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-0 scanline-bg opacity-20" />
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-20">
        <div className="absolute top-1/4 left-0 h-px w-full bg-gradient-to-r from-transparent via-cyan-900/40 to-transparent" />
        <div className="absolute bottom-1/3 left-10 h-64 w-px bg-gradient-to-b from-transparent via-cyan-900/40 to-transparent" />
      </div>
      <div className="pointer-events-none fixed top-20 left-4 z-0 h-10 w-10 border-t border-l border-cyan-900/40" />
      <div className="pointer-events-none fixed top-20 right-4 z-0 h-10 w-10 border-t border-r border-cyan-900/40" />
    </>
  );
}
