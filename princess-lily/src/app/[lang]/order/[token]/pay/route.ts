import { orderByToken, startProviderPayment } from "@/lib/orders";
import { rateLimit } from "@/lib/rate-limit";
import { appUrl } from "@/lib/config";

/**
 * «Перейти до оплати» зі сторінки замовлення (режим провайдера): новий рахунок для неоплаченого замовлення —
 * коли рахунок не вдалося створити під час оформлення, він сплив або попередня оплата не пройшла.
 * Лише POST (форма), щоб попереднє завантаження посилань чи боти не створювали рахунки.
 */
export async function POST(_: Request, ctx: RouteContext<"/[lang]/order/[token]/pay">) {
  const { lang, token } = await ctx.params;
  const back = `/${lang === "en" ? "en" : "uk"}/order/${token}`;
  const o = await orderByToken(token);
  if (!o) return new Response("Not found", { status: 404 });
  const url = (await rateLimit("pay", 10, 600)) ? await startProviderPayment(o.id, back) : null;
  return Response.redirect(url ?? `${appUrl()}${back}?pay=error`, 303);
}
