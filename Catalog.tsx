"use client";
import { useMemo, useState } from "react";
import type { PublicCategory } from "@/lib/catalog";
import { formatUnitPrice } from "@/lib/pricing";
import { Picture } from "./Picture";

export function Catalog({ categories }: { categories: PublicCategory[] }) {
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");
  const items = useMemo(() => {
    const list = categories.filter((c) => cat === "all" || c.slug === cat).flatMap((c) => c.products.map((p) => ({ ...p, categoryName: c.name, categorySlug: c.slug })));
    const s = q.trim().toLowerCase();
    return s ? list.filter((p) => p.name.toLowerCase().includes(s)) : list;
  }, [categories, cat, q]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0" role="group" aria-label="Категорії">
          <button type="button" className="chip shrink-0" aria-pressed={cat === "all"} onClick={() => setCat("all")}>Усі</button>
          {categories.map((c) => <button key={c.id} type="button" className="chip shrink-0" aria-pressed={cat === c.slug} onClick={() => setCat(c.slug)}>{c.name}</button>)}
        </div>
        <label className="md:w-64">
          <span className="sr-only">Пошук за назвою</span>
          <input className="field" placeholder="Пошук за назвою" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      {items.length === 0 ? (
        <p className="py-10 text-center text-muted">Нічого не знайдено. Спробуйте іншу назву або категорію.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <li key={p.id} className="card flex flex-col">
              {p.image_path && <Picture src={p.image_path} alt={p.name} className="aspect-[4/3]" />}
              <div className="flex flex-1 flex-col p-5">
                <span className="text-xs font-semibold text-muted">{p.categoryName}{p.size_label ? ` · ${p.size_label}` : ""}</span>
                <h3 className="mt-1 text-2xl">{p.name}</h3>
                {p.description && <p className="mt-2 text-sm text-muted">{p.description}</p>}
                <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                  <span className="font-semibold">{formatUnitPrice({ priceType: p.price_type, priceMin: p.price_min, priceMax: p.price_max, unit: p.unit })}</span>
                  <a href={`#zamovlennia?p=${p.id}`} onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent("gsl:pick", { detail: { productId: p.id } })); document.getElementById("zamovlennia")?.scrollIntoView({ behavior: "smooth" }); }} className="btn btn-outline !min-h-10 !px-4 !py-2 text-sm">Обрати</a>
                </div>
                {p.min_qty != null && <p className="mt-2 text-xs text-muted">{p.unit === "KG" ? `Від ${p.min_qty / 1000} кг` : `Замовлення від ${p.min_qty} ${p.unit === "BOUQUET" ? "букетів" : "шт"}`}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
