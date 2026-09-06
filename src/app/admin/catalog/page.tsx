import { requireAdmin } from "@/lib/auth";
import { getAdminCatalog } from "@/lib/catalog";
import { db } from "@/db";
import { CatalogAdmin } from "./CatalogAdmin";

export default async function CatalogPage() {
  await requireAdmin();
  const cats = await getAdminCatalog();
  const photos = await db.selectFrom("photos").select(["path", "alt"]).orderBy("created_at", "desc").execute();
  const staticPhotos = ["/images/cherry-cake.jpg", "/images/cherry-slice.jpg", "/images/small-box.jpg", "/images/pink-box.jpg", "/images/sphere-butterflies.jpg", "/images/autumn-bowl.jpg"].map((p) => ({ path: p, alt: "" }));
  return (
    <div>
      <h1 className="text-3xl">Каталог і ціни</h1>
      <p className="mt-1 text-sm text-muted">Ціни в гривнях за одиницю. Зміна ціни не перераховує старі заявки — у них збережено прайс на момент подання.</p>
      <CatalogAdmin categories={cats} photos={[...photos, ...staticPhotos]} />
    </div>
  );
}
