/** Символічна купюра без номіналу. Форма залежить від `bend` (вигин від руху). */
export const BILL_W = 156;
export const BILL_H = 74;
const PAD = 26;

export function billPath(bend: number, twist = 0) {
  const W = BILL_W;
  const H = BILL_H;
  // Верхній і нижній край прогинаються разом — аркуш «провисає» від руху; twist піднімає один кут.
  return `M0 ${twist} Q${W / 2} ${bend} ${W} ${-twist} L${W} ${H - twist} Q${W / 2} ${H + bend} 0 ${H + twist} Z`;
}

export function BillSvg({ id, stack = false, pathRef, sheenRef }: { id: string; stack?: boolean; pathRef?: React.Ref<SVGPathElement>; sheenRef?: React.Ref<SVGLinearGradientElement> }) {
  const d = billPath(0);
  const W = BILL_W;
  const H = BILL_H;
  const layers = stack ? 6 : 0;
  return (
    <svg
      width={W + PAD * 2}
      height={H + PAD * 2 + layers * 2.2}
      viewBox={`${-PAD} ${-PAD} ${W + PAD * 2} ${H + PAD * 2 + layers * 2.2}`}
      aria-hidden
      className="block overflow-visible"
    >
      <defs>
        <linearGradient id={`${id}-paper`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c9d6d3" />
          <stop offset="0.55" stopColor="#a9bcba" />
          <stop offset="1" stopColor="#8aa09f" />
        </linearGradient>
        <linearGradient id={`${id}-sheen`} ref={sheenRef} x1="0" y1="0" x2="1" y2="0" gradientTransform="translate(0 0)">
          <stop offset="0.25" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.32" />
          <stop offset="0.75" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <pattern id={`${id}-guilloche`} width="12" height="8" patternUnits="userSpaceOnUse">
          <path d="M0 4 Q3 0 6 4 T12 4" fill="none" stroke="#5f7b7a" strokeOpacity="0.35" strokeWidth="0.6" />
        </pattern>
        <clipPath id={`${id}-clip`}>
          <path d={d} />
        </clipPath>
      </defs>

      {/* Товщина пачки: краї аркушів знизу */}
      {Array.from({ length: layers }, (_, i) => (
        <path key={i} d={d} transform={`translate(${(layers - i) * 0.5} ${(layers - i) * 2.2})`} fill={i % 2 ? "#9fb2b0" : "#b7c7c4"} stroke="#6e8584" strokeWidth="0.5" />
      ))}

      <path ref={pathRef} d={d} fill={`url(#${id}-paper)`} stroke="#5d7473" strokeWidth="0.8" />
      <g clipPath={`url(#${id}-clip)`}>
        <rect x="8" y="8" width={W - 16} height={H - 16} rx="4" fill={`url(#${id}-guilloche)`} stroke="#4d6564" strokeOpacity="0.55" strokeWidth="0.8" />
        <ellipse cx={W * 0.72} cy={H / 2} rx="19" ry="21" fill="#dfe8e6" fillOpacity="0.55" stroke="#4d6564" strokeOpacity="0.5" strokeWidth="0.8" />
        <path d={`M${W * 0.72 - 8} ${H / 2 + 8} L${W * 0.72} ${H / 2 - 9} L${W * 0.72 + 8} ${H / 2 + 8}`} fill="none" stroke="#4d6564" strokeOpacity="0.55" strokeWidth="1.2" />
        <rect x="16" y={H / 2 - 9} width="44" height="4" rx="2" fill="#4d6564" fillOpacity="0.35" />
        <rect x="16" y={H / 2 + 2} width="30" height="4" rx="2" fill="#4d6564" fillOpacity="0.25" />
        <rect x="-20" y="-20" width={W + 40} height={H + 40} fill={`url(#${id}-sheen)`} />
      </g>
      {stack && <rect x={W * 0.38} y="-3" width="20" height={H + 6} rx="1.5" fill="#d8c0a5" stroke="#9c8468" strokeWidth="0.6" opacity="0.95" />}
    </svg>
  );
}

export const BILL_PAD = PAD;
