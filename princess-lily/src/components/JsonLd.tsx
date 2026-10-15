import { ldJson } from "@/lib/seo";

/** Структуровані дані schema.org одним @graph; рендериться на сервері, тож потрапляє в початковий HTML. */
export default function JsonLd({ nodes }: { nodes: (object | null | undefined)[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(...nodes) }} />;
}
