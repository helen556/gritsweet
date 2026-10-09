import { Sprig } from "./Leaves";

/**
 * Атмосферний фон головної: великі м'які молочні/перламутрові/шавлієві плями світла,
 * кілька напівпрозорих гілочок по краях (передній план — більші й розмиті, дальній — дрібніші),
 * поодинокі світлові точки й зірочки. Усе статичне (лише одна-дві зірочки ледь мерехтять),
 * aria-hidden, pointer-events:none, не заходить під дрібний текст і CTA. На мобільному декору менше.
 */
export default function Ambient() {
  return (
    <div aria-hidden="true" className="ambient pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="ambient-glow" />
      {/* дальній план */}
      <Sprig className="ambient-sprig far hidden md:block" style={{ top: "9%", left: "-1.5rem", width: 90, height: 165 }} />
      <Sprig className="ambient-sprig far hidden lg:block" flip style={{ top: "41%", right: "-1rem", width: 80, height: 150 }} />
      <Sprig className="ambient-sprig far hidden md:block" style={{ top: "78%", left: "-1rem", width: 70, height: 130 }} />
      {/* передній план: більші, м'яко розмиті */}
      <Sprig className="ambient-sprig near hidden lg:block" flip style={{ top: "22%", right: "-3.5rem", width: 170, height: 310 }} parallax={0.025} />
      <Sprig className="ambient-sprig near hidden lg:block" style={{ top: "60%", left: "-4rem", width: 160, height: 290 }} parallax={-0.02} />
      <Sprig className="ambient-sprig near-mobile md:hidden" flip style={{ top: "36%", right: "-2.2rem", width: 80, height: 150 }} />
      {/* світлові точки й зірочки між секціями */}
      {[
        [6, 18, "dot"], [93, 14, "star"], [12, 33, "dot"], [88, 37, "dot"], [50, 46.5, "star twinkle"], [8, 55, "star"],
        [95, 63, "dot"], [30, 71, "dot"], [91, 82, "star twinkle"], [4, 90, "dot"],
      ].map(([x, y, k], i) => (
        <span key={i} className={`ambient-${k}`} style={{ left: `${x}%`, top: `${y}%` }} />
      ))}
    </div>
  );
}
