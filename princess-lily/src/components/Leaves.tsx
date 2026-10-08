/** Делікатні декоративні гілочки (inline SVG, без запитів). Лише декор: aria-hidden. */
export function Sprig({ className = "", flip = false, parallax }: { className?: string; flip?: boolean; parallax?: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 120 220" className={className} data-parallax={parallax} style={flip ? { scale: "-1 1" } : undefined}>
      <path d="M60 218 C 58 170, 62 120, 56 70 S 50 20, 64 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".55" />
      {[
        [57, 180, -38], [59, 150, 32], [57, 120, -34], [58, 92, 30], [55, 64, -30], [58, 38, 26],
      ].map(([x, y, r], i) => (
        <ellipse key={i} cx={x + (r < 0 ? -14 : 14)} cy={y} rx="15" ry="6.5" transform={`rotate(${r} ${x} ${y})`} fill="currentColor" opacity={0.28 + (i % 3) * 0.08} />
      ))}
    </svg>
  );
}
