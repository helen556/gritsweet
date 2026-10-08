"use client";
import { useEffect, useId, useState } from "react";
import type { Dict } from "@/i18n";

type Opt = { ref: string; name: string; area?: string };

/**
 * Вибір міста та відділення/поштомату Нової пошти.
 * mode="api": підказки з API через серверний ендпоінт; mode="manual": ручне введення з підписами полів.
 */
export default function NpPicker({ mode, t, invalid }: { mode: "api" | "manual"; t: Dict["checkout"]; invalid: string[] }) {
  const [city, setCity] = useState(""); const [cityRef, setCityRef] = useState("");
  const [point, setPoint] = useState(""); const [pointRef, setPointRef] = useState("");
  const [cities, setCities] = useState<Opt[]>([]); const [points, setPoints] = useState<Opt[]>([]);
  const cl = useId(), pl = useId();

  useEffect(() => {
    if (mode !== "api" || city.trim().length < 2 || cityRef) return;
    const c = new AbortController();
    const h = setTimeout(() => fetch(`/api/np/cities?q=${encodeURIComponent(city)}`, { signal: c.signal }).then((r) => r.json()).then((d) => setCities(d.items ?? [])).catch(() => {}), 250);
    return () => { clearTimeout(h); c.abort(); };
  }, [city, cityRef, mode]);
  useEffect(() => {
    if (mode !== "api" || !cityRef) return;
    const c = new AbortController();
    const h = setTimeout(() => fetch(`/api/np/points?city=${cityRef}&q=${encodeURIComponent(pointRef ? "" : point)}`, { signal: c.signal }).then((r) => r.json()).then((d) => setPoints(d.items ?? [])).catch(() => {}), 250);
    return () => { clearTimeout(h); c.abort(); };
  }, [point, pointRef, cityRef, mode]);

  const inv = (n: string) => invalid.includes(n) ? { "aria-invalid": true as const, "aria-describedby": `${n}-err` } : {};
  return (
    <>
      <div className="field">
        <label htmlFor="npCity">{t.city}</label>
        <input id="npCity" name="npCity" className="input" autoComplete="address-level2" placeholder={t.cityHint} value={city} list={mode === "api" ? cl : undefined}
          onChange={(e) => { const v = e.target.value; setCity(v); const m = cities.find((c) => c.name === v); setCityRef(m?.ref ?? ""); setPoint(""); setPointRef(""); }} {...inv("npCity")} />
        {mode === "api" && <datalist id={cl}>{cities.map((c) => <option key={c.ref} value={c.name}>{c.area}</option>)}</datalist>}
        <input type="hidden" name="npCityRef" value={cityRef} />
        {invalid.includes("npCity") && <p id="npCity-err" className="err">{t.errors.city}</p>}
      </div>
      <div className="field">
        <label htmlFor="npPoint">{t.point}</label>
        <input id="npPoint" name="npPoint" className="input" placeholder={t.pointHint} value={point} list={mode === "api" ? pl : undefined}
          onChange={(e) => { const v = e.target.value; setPoint(v); setPointRef(points.find((p) => p.name === v)?.ref ?? ""); }} {...inv("npPoint")} />
        {mode === "api" && <datalist id={pl}>{points.map((p) => <option key={p.ref} value={p.name} />)}</datalist>}
        <input type="hidden" name="npPointRef" value={pointRef} />
        {mode === "manual" && <p className="hint">{t.pointHint}</p>}
        {invalid.includes("npPoint") && <p id="npPoint-err" className="err">{t.errors.point}</p>}
      </div>
    </>
  );
}
