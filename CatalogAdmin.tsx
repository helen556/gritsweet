"use client";
import { useState } from "react";
import type { Category } from "@/db/types";
import type { PublicProduct } from "@/lib/catalog";
import { ActionForm } from "@/components/admin/ActionForm";
import { saveCategory, saveProduct, toggleProduct } from "../actions";
import { formatUnitPrice } from "@/lib/pricing";
import { optionsToText } from "@/lib/options";

type Cat = Category & { products: PublicProduct[] };
type Photo = { path: string; alt: string };
const UNIT_LABEL = { KG: "кг", PIECE: "штука", BOX: "коробочка", BOUQUET: "букет" } as const;
const PT_LABEL = { FIXED: "Фіксована", RANGE: "Діапазон", FROM: "«Від»", ASK: "«Уточнюйте»" } as const;

function PhotoSelect({ name, value, photos }: { name: string; value: string; photos: Photo[] }) {
  return (
    <label className="block">Фото<select name={name} defaultValue={value} className="field mt-1"><option value="">Без фото</option>{photos.map((p) => <option key={p.path} value={p.path}>{p.alt || p.path.replace(/^\/(uploads|images)\//, "")}</option>)}</select></label>
  );
}

function ProductForm({ p, cats, categoryId, photos, onDone }: { p?: PublicProduct; cats: Cat[]; categoryId: string; photos: Photo[]; onDone?: () => void }) {
  const [pt, setPt] = useState(p?.price_type ?? "FIXED");
  const [unit, setUnit] = useState(p?.unit ?? cats.find((c) => c.id === categoryId)?.unit ?? "KG");
  return (
    <ActionForm action={saveProduct} hiddens={p ? { id: p.id } : {}} submitLabel={p ? "Зберегти позицію" : "Додати позицію"} className="rounded-2xl bg-cream p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2">Назва<input name="name" defaultValue={p?.name} required className="field mt-1" /></label>
        <label>Категорія<select name="category_id" defaultValue={p?.category_id ?? categoryId} className="field mt-1">{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>Одиниця продажу<select name="unit" value={unit} onChange={(e) => setUnit(e.target.value as typeof unit)} className="field mt-1">{Object.entries(UNIT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>Тип ціни<select name="price_type" value={pt} onChange={(e) => setPt(e.target.value as typeof pt)} className="field mt-1">{Object.entries(PT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        {pt !== "ASK" && <label>{pt === "RANGE" ? "Ціна від, грн" : "Ціна, грн"}<input name="price_min" inputMode="decimal" defaultValue={p?.price_min != null ? p.price_min / 100 : ""} className="field mt-1" /></label>}
        {pt === "RANGE" && <label>Ціна до, грн<input name="price_max" inputMode="decimal" defaultValue={p?.price_max != null ? p.price_max / 100 : ""} className="field mt-1" /></label>}
        <label>Мінімум ({unit === "KG" ? "кг" : "шт"})<input name="min_qty" inputMode="decimal" defaultValue={p?.min_qty != null ? (unit === "KG" ? p.min_qty / 1000 : p.min_qty) : ""} className="field mt-1" placeholder="порожньо = без мінімуму" /></label>
        <label>Розмір / варіант (текст)<input name="size_label" defaultValue={p?.size_label ?? ""} className="field mt-1" placeholder="напр. 15 × 15 см" /></label>
        <label>Порядок показу<input name="sort_order" inputMode="numeric" defaultValue={p?.sort_order ?? 0} className="field mt-1" /></label>
        <PhotoSelect name="image_path" value={p?.image_path ?? ""} photos={photos} />
        <label className="sm:col-span-2">Опис (можна лишити порожнім)<textarea name="description" defaultValue={p?.description} className="field mt-1 min-h-16" /></label>
        <label className="sm:col-span-2">Доступні начинки — по одній у рядку (порожньо = без вибору)<textarea name="fillings" defaultValue={p?.fillings.join("\n")} className="field mt-1 min-h-16" /></label>
        <label className="sm:col-span-2">Склад на вибір — по одній групі в рядку у форматі «Назва: варіант, варіант». Зірочка на початку = обов’язково (напр. «*Бісквіт: ванільний, шоколадний»)<textarea name="options" defaultValue={p ? optionsToText(p.options) : ""} className="field mt-1 min-h-24 text-sm" /></label>
      </div>
      {onDone && <button type="button" onClick={onDone} className="mt-2 text-sm underline">Закрити</button>}
    </ActionForm>
  );
}

export function CatalogAdmin({ categories, photos }: { categories: Cat[]; photos: Photo[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [newCat, setNewCat] = useState(false);
  const [editCat, setEditCat] = useState<string | null>(null);
  return (
    <div className="mt-5 grid gap-6">
      {categories.map((c) => (
        <section key={c.id} className={`card p-4 ${c.is_archived ? "opacity-60" : ""}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-2xl">{c.name} <span className="text-sm text-muted">· {UNIT_LABEL[c.unit]}{!c.is_visible && " · приховано"}{c.is_archived ? " · архів" : ""}</span></h2>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="chip" onClick={() => setEditCat(editCat === c.id ? null : c.id)}>Редагувати</button>
              <ActionForm action={toggleProduct} hiddens={{ id: c.id, table: "categories", field: "is_visible", value: c.is_visible ? "0" : "1" }} submitLabel={c.is_visible ? "Приховати" : "Показати"} submitClass="chip" inline />
              <ActionForm action={toggleProduct} hiddens={{ id: c.id, table: "categories", field: "is_archived", value: c.is_archived ? "0" : "1" }} submitLabel={c.is_archived ? "З архіву" : "В архів"} submitClass="chip" inline confirm={c.is_archived ? undefined : "Архівувати категорію? Вона зникне з сайту, старі заявки залишаться."} />
            </div>
          </div>
          {editCat === c.id && (
            <ActionForm action={saveCategory} hiddens={{ id: c.id }} submitLabel="Зберегти категорію" className="mt-3 rounded-2xl bg-cream p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label>Назва<input name="name" defaultValue={c.name} required className="field mt-1" /></label>
                <label>Одиниця за замовчуванням<select name="unit" defaultValue={c.unit} className="field mt-1">{Object.entries(UNIT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                <label>Порядок<input name="sort_order" defaultValue={c.sort_order} className="field mt-1" /></label>
                <PhotoSelect name="image_path" value={c.image_path ?? ""} photos={photos} />
                <label className="sm:col-span-2">Опис<textarea name="description" defaultValue={c.description} className="field mt-1" /></label>
              </div>
            </ActionForm>
          )}
          <ul className="mt-3 divide-y divide-ink/10">
            {c.products.map((p) => (
              <li key={p.id} className={`py-3 ${p.is_archived ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold">{p.name}</span> <span className="text-sm text-muted">· {formatUnitPrice({ priceType: p.price_type, priceMin: p.price_min, priceMax: p.price_max, unit: p.unit })}{!p.is_visible && " · приховано"}{p.is_archived ? " · архів" : ""}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="chip !min-h-9" onClick={() => setEditing(editing === p.id ? null : p.id)}>{editing === p.id ? "Закрити" : "Змінити"}</button>
                    <ActionForm action={toggleProduct} hiddens={{ id: p.id, table: "products", field: "is_visible", value: p.is_visible ? "0" : "1" }} submitLabel={p.is_visible ? "Приховати" : "Показати"} submitClass="chip !min-h-9" inline />
                    {!p.is_archived
                      ? <ActionForm action={toggleProduct} hiddens={{ id: p.id, table: "products", field: "is_archived", value: "1" }} submitLabel="В архів" submitClass="chip !min-h-9" inline confirm={`Архівувати «${p.name}»? Старі заявки не зміняться.`} />
                      : <ActionForm action={toggleProduct} hiddens={{ id: p.id, table: "products", field: "is_archived", value: "0" }} submitLabel="Відновити" submitClass="chip !min-h-9" inline />}
                  </div>
                </div>
                {editing === p.id && <div className="mt-3"><ProductForm p={p} cats={categories} categoryId={c.id} photos={photos} onDone={() => setEditing(null)} /></div>}
              </li>
            ))}
          </ul>
          {adding === c.id ? <div className="mt-3"><ProductForm cats={categories} categoryId={c.id} photos={photos} onDone={() => setAdding(null)} /></div>
            : <button type="button" className="btn btn-outline mt-3 !min-h-11" onClick={() => setAdding(c.id)}>+ Додати позицію</button>}
        </section>
      ))}
      {newCat ? (
        <ActionForm action={saveCategory} submitLabel="Створити категорію" className="card p-4">
          <h2 className="text-2xl">Нова категорія</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label>Назва<input name="name" required className="field mt-1" /></label>
            <label>Одиниця<select name="unit" className="field mt-1">{Object.entries(UNIT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className="sm:col-span-2">Опис<textarea name="description" className="field mt-1" /></label>
          </div>
        </ActionForm>
      ) : <button type="button" className="btn btn-cherry" onClick={() => setNewCat(true)}>+ Нова категорія</button>}
    </div>
  );
}
