import "server-only";
import { db } from "@/db";
import type { Category, Product } from "@/db/types";
import { cache } from "react";
import { parseOptions, type OptionGroup } from "./options";

export type PublicProduct = Omit<Product, "fillings" | "options"> & { fillings: string[]; options: OptionGroup[] };
export type PublicCategory = Category & { products: PublicProduct[] };

const parse = (p: Product): PublicProduct => ({ ...p, fillings: safeJson(p.fillings), options: parseOptions(p.options) });
function safeJson(s: string): string[] { try { const v = JSON.parse(s); return Array.isArray(v) ? v.map(String) : []; } catch { return []; } }

/** Лише опубліковані категорії та позиції — для відвідувачів. */
export const getPublicCatalog = cache(async (): Promise<PublicCategory[]> => {
  const cats = await db.selectFrom("categories").selectAll().where("is_visible", "=", 1).where("is_archived", "=", 0).orderBy("sort_order").orderBy("name").execute();
  const prods = await db.selectFrom("products").selectAll().where("is_visible", "=", 1).where("is_archived", "=", 0).orderBy("sort_order").orderBy("name").execute();
  return cats.map((c) => ({ ...c, products: prods.filter((p) => p.category_id === c.id).map(parse) })).filter((c) => c.products.length > 0);
});

export async function getPublicProduct(id: string): Promise<(PublicProduct & { category: Category }) | null> {
  const p = await db.selectFrom("products").selectAll().where("id", "=", id).where("is_visible", "=", 1).where("is_archived", "=", 0).executeTakeFirst();
  if (!p) return null;
  const category = await db.selectFrom("categories").selectAll().where("id", "=", p.category_id).where("is_visible", "=", 1).where("is_archived", "=", 0).executeTakeFirst();
  if (!category) return null;
  return { ...parse(p), category };
}

/** Повний каталог для адмінки (включно з прихованими й архівними). */
export async function getAdminCatalog() {
  const cats = await db.selectFrom("categories").selectAll().orderBy("is_archived").orderBy("sort_order").execute();
  const prods = await db.selectFrom("products").selectAll().orderBy("is_archived").orderBy("sort_order").orderBy("name").execute();
  return cats.map((c) => ({ ...c, products: prods.filter((p) => p.category_id === c.id).map(parse) }));
}
