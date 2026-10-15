import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict, hasLocale } from "@/i18n";
import { breadcrumbLd, pageMeta } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import InfoPage from "@/components/InfoPage";

export async function generateMetadata({ params }: PageProps<"/[lang]/returns">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = getDict(lang);
  return pageMeta(lang, "/returns", t.pages.returns.title, t.seo.returnsDescription);
}
export default async function Returns({ params }: PageProps<"/[lang]/returns">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDict(lang);
  return <InfoPage title={t.pages.returns.title}><JsonLd nodes={[breadcrumbLd(lang, [{ name: t.pages.returns.title, path: "/returns" }])]} />{t.pages.returns.p.map((p, i) => <p key={i}>{p}</p>)}</InfoPage>;
}
