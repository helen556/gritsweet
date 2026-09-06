"use client";
import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PublicCategory, PublicProduct } from "@/lib/catalog";
import { estimate, formatEstimate, formatUnitPrice } from "@/lib/pricing";
import { normalizeUaPhone } from "@/lib/phone";
import { submitOrder, type SubmitResult } from "@/app/actions/submit-order";
import { Calendar, type CalendarInfo } from "./Calendar";

const STEPS = ["Категорія", "Позиція", "Деталі", "Побажання", "Дата", "Контакти"];
const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now());

export function Constructor({ categories, cupcakeMinBatch }: { categories: PublicCategory[]; cupcakeMinBatch: string }) {
  const [step, setStep] = useState(0);
  const [catId, setCatId] = useState<string>("");
  const [product, setProduct] = useState<PublicProduct | null>(null);
  const [qtyText, setQtyText] = useState("");
  const [filling, setFilling] = useState("");
  const [sel, setSel] = useState<Record<string, string>>({});
  const [wishes, setWishes] = useState("");
  const [date, setDate] = useState("");
  const [calInfo, setCalInfo] = useState<CalendarInfo | null>(null);
  const [delivery, setDelivery] = useState<"TAXI" | "AGREE">("AGREE");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [key, setKey] = useState(newKey);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [state, action, pending] = useActionState<SubmitResult | null, FormData>(submitOrder, null);
  const rootRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const cat = categories.find((c) => c.id === catId) ?? null;
  useEffect(() => {
    const onPick = (e: Event) => {
      const id = (e as CustomEvent<{ productId: string }>).detail.productId;
      const c = categories.find((c) => c.products.some((p) => p.id === id));
      const p = c?.products.find((p) => p.id === id);
      if (c && p) { setCatId(c.id); setProduct(p); setStep(2); setQtyText(""); setFilling(""); setSel({}); }
    };
    window.addEventListener("gsl:pick", onPick);
    return () => window.removeEventListener("gsl:pick", onPick);
  }, [categories]);

  // Ховаємо нижню кнопку «Замовити», коли конструктор у полі зору
  useEffect(() => {
    const el = rootRef.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => document.body.toggleAttribute("data-hide-cta", e.isIntersecting), { threshold: 0.05 });
    io.observe(el); return () => { io.disconnect(); document.body.removeAttribute("data-hide-cta"); };
  }, []);

  const qty = useMemo(() => {
    if (!product) return NaN;
    const n = Number(qtyText.replace(",", "."));
    return product.unit === "KG" ? Math.round(n * 1000) : n;
  }, [product, qtyText]);
  const qtyValid = product ? (product.unit === "KG" ? Number.isFinite(qty) && qty >= (product.min_qty ?? 100) && qty % 100 === 0 : Number.isInteger(qty) && qty >= (product.min_qty ?? 1)) : false;
  const est = product && qtyValid ? estimate({ priceType: product.price_type, priceMin: product.price_min, priceMax: product.price_max, unit: product.unit }, qty) : null;
  const urgent = date && calInfo ? Math.round((Date.parse(date) - Date.parse(calInfo.today)) / 86_400_000) < calInfo.leadDays : false;
  const phoneNorm = normalizeUaPhone(phone);
  const onInfo = useCallback((i: CalendarInfo) => setCalInfo(i), []);


  function next() {
    setLocalErr(null);
    if (step === 0 && !cat) return setLocalErr("Оберіть категорію.");
    if (step === 1 && !product) return setLocalErr("Оберіть позицію.");
    if (step === 2 && product?.price_type !== "ASK" && !qtyValid) return setLocalErr(product?.unit === "KG" ? "Вкажіть вагу з кроком 0,1 кг." : "Вкажіть цілу кількість.");
    if (step === 2 && product?.price_type === "ASK" && !qtyValid) setQtyText(product.unit === "KG" ? "0.5" : "1");
    if (step === 2 && product) { const miss = product.options.find((g) => g.required && !sel[g.key]); if (miss) return setLocalErr(`Оберіть: ${miss.label}.`); }
    if (step === 4 && !date) return setLocalErr("Оберіть бажану дату.");
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (state?.ok) {
    return (
      <div ref={rootRef} className="card mx-auto max-w-xl p-8 text-center" role="status" aria-live="polite">
        <h3 className="text-3xl">Дякую! Вашу заявку отримано.</h3>
        <p className="mt-4 text-muted">Дар’я зв’яжеться з вами, щоб узгодити деталі, дату й остаточну вартість.</p>
        <button type="button" className="btn btn-outline mt-6" onClick={() => { setKey(newKey()); window.location.reload(); }}>Нова заявка</button>
      </div>
    );
  }

  const fieldErr = (state && !state.ok && state.fields) || {};
  const serverFieldStep: Record<string, number> = { productId: 1, qty: 2, filling: 2, reference: 3, desiredDate: 4, name: 5, phone: 5, consent: 5 };
  const firstErrStep = Object.keys(fieldErr).map((k) => serverFieldStep[k]).filter((v) => v != null).sort()[0];

  return (
    <div ref={rootRef} className="card mx-auto max-w-2xl">
      <ol className="no-scrollbar flex gap-1 overflow-x-auto border-b border-ink/10 px-4 py-3 text-xs" aria-label="Кроки">
        {STEPS.map((s, i) => (
          <li key={s} className="shrink-0">
            <button type="button" onClick={() => i < step && setStep(i)} disabled={i > step} aria-current={i === step ? "step" : undefined}
              className={`rounded-full px-3 py-1.5 font-semibold ${i === step ? "bg-choco text-cream" : i < step ? "text-ink" : "text-ink/40"}`}>{i + 1}. {s}</button>
          </li>
        ))}
      </ol>

      <form action={action} className="p-5 md:p-7" noValidate onSubmit={(e) => {
        setLocalErr(null);
        if (!consent) { e.preventDefault(); setLocalErr("Підтвердьте ознайомлення з політикою."); }
        if (!phoneNorm) { e.preventDefault(); setLocalErr("Перевірте номер телефону."); }
        if (name.trim().length < 2) { e.preventDefault(); setLocalErr("Вкажіть ім’я."); }
      }}>
        {/* приховані значення для сервера */}
        <input type="hidden" name="productId" value={product?.id ?? ""} />
        <input type="hidden" name="qty" value={Number.isFinite(qty) ? qty : ""} />
        <input type="hidden" name="filling" value={filling} />
        <input type="hidden" name="selections" value={JSON.stringify(sel)} />
        <input type="hidden" name="wishes" value={wishes} />
        <input type="hidden" name="desiredDate" value={date} />
        <input type="hidden" name="deliveryType" value={delivery} />
        <input type="hidden" name="name" value={name} />
        <input type="hidden" name="phone" value={phone} />
        <input type="hidden" name="idempotencyKey" value={key} />
        {consent && <input type="hidden" name="consent" value="on" />}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" defaultValue="" />

        {step === 0 && (
          <fieldset>
            <legend className="text-2xl">Що замовляємо?</legend>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {categories.map((c) => (
                <button key={c.id} type="button" aria-pressed={catId === c.id} onClick={() => { setCatId(c.id); setProduct(null); }}
                  className={`rounded-2xl border p-4 text-left transition-colors ${catId === c.id ? "border-choco bg-choco text-cream" : "border-ink/15 hover:bg-milk"}`}>
                  <span className="text-xl font-medium">{c.name}</span>
                  <span className="mt-1 block text-xs opacity-75">{c.products.length} {c.products.length === 1 ? "позиція" : "позицій"}</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {step === 1 && cat && (
          <fieldset>
            <legend className="text-2xl">{cat.name}: оберіть позицію</legend>
            {cat.description && <p className="mt-1 text-sm text-muted">{cat.description}</p>}
            <ul className="mt-4 grid gap-2">
              {cat.products.map((p) => (
                <li key={p.id}>
                  <button type="button" aria-pressed={product?.id === p.id} onClick={() => { setProduct(p); setQtyText(""); setFilling(""); setSel({}); }}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-colors ${product?.id === p.id ? "border-choco bg-choco text-cream" : "border-ink/15 hover:bg-milk"}`}>
                    <span><span className="block font-medium">{p.name}</span>{p.description && <span className="block text-xs opacity-75">{p.description}</span>}</span>
                    <span className="shrink-0 text-sm font-semibold">{formatUnitPrice({ priceType: p.price_type, priceMin: p.price_min, priceMax: p.price_max, unit: p.unit })}</span>
                  </button>
                </li>
              ))}
            </ul>
            {fieldErr.productId && <p className="error">{fieldErr.productId}</p>}
          </fieldset>
        )}

        {step === 2 && product && (
          <fieldset>
            <legend className="text-2xl">{product.name}</legend>
            {product.price_type === "ASK" ? (
              <p className="mt-3 text-muted">{product.description || "Вартість уточнюйте."} Вагу та ціну узгодимо з вами особисто.</p>
            ) : (
              <div className="mt-4">
                <label className="label" htmlFor="qty">{product.unit === "KG" ? "Бажана вага, кг" : product.unit === "PIECE" ? "Кількість, шт" : product.unit === "BOX" ? "Кількість коробочок" : "Кількість букетів"}</label>
                <input id="qty" className="field" inputMode="decimal" placeholder={product.unit === "KG" ? "напр. 1.5" : "напр. 6"} value={qtyText} onChange={(e) => setQtyText(e.target.value)} aria-invalid={!!fieldErr.qty || (qtyText !== "" && !qtyValid)} aria-describedby="qty-hint" />
                <p id="qty-hint" className="mt-1 text-xs text-muted">
                  {product.unit === "KG" && `Крок 0,1 кг. Мінімум ${(product.min_qty ?? 1000) / 1000} кг.`}
                  {product.unit !== "KG" && product.min_qty != null && `Замовлення від ${product.min_qty} ${product.unit === "BOUQUET" ? "букетів" : "шт"}.`}
                  {product.unit === "PIECE" && cat?.slug === "kapkeiky" && (cupcakeMinBatch ? ` Мінімальна партія: ${cupcakeMinBatch} шт.` : " Кількість — побажання; можливість партії Дар’я підтвердить окремо.")}
                </p>
                {fieldErr.qty && <p className="error">{fieldErr.qty}</p>}
              </div>
            )}
            {product.fillings.length > 0 && (
              <div className="mt-5">
                <span className="label">Начинка</span>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Начинка">
                  {product.fillings.map((f) => <button key={f} type="button" role="radio" aria-checked={filling === f} className="chip" onClick={() => setFilling(f)}>{f}</button>)}
                </div>
                {fieldErr.filling && <p className="error">{fieldErr.filling}</p>}
              </div>
            )}
            {product.options.length > 0 && (
              <div className="mt-5 grid gap-4">
                <p className="text-sm text-muted">Склад можна зібрати самостійно. Необов’язкові групи можна пропустити — Дар’я підкаже поєднання.</p>
                {product.options.map((g) => (
                  <div key={g.key}>
                    <span className="label">{g.label}{g.required ? "" : <span className="font-normal text-muted"> · необов’язково</span>}</span>
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={g.label}>
                      {g.choices.map((c) => <button key={c} type="button" role="radio" aria-checked={sel[g.key] === c} className="chip !min-h-9 !text-sm" onClick={() => setSel((s) => ({ ...s, [g.key]: s[g.key] === c ? "" : c }))}>{c}</button>)}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {est && (
              <div className="mt-6 rounded-2xl bg-milk p-4">
                <p className="text-sm text-muted">Орієнтовна вартість без декору та доставки</p>
                <p className="text-2xl font-semibold">{formatEstimate(est)}</p>
                <p className="mt-1 text-xs text-muted">Декор розраховується індивідуально. Точну суму підтверджує Дар’я після обговорення.</p>
              </div>
            )}
          </fieldset>
        )}

        {step === 3 && (
          <fieldset>
            <legend className="text-2xl">Побажання до оформлення</legend>
            <label className="label mt-4" htmlFor="wishes">Оформлення, напис, для кого торт</label>
            <textarea id="wishes" className="field min-h-32" maxLength={2000} value={wishes} onChange={(e) => setWishes(e.target.value)} placeholder="Напр.: «З днем народження, Олю!», ніжні кольори, без мастики" />
            <label className="label mt-5" htmlFor="reference">Референс декору (необов’язково)</label>
          </fieldset>
        )}

        {step === 4 && (
          <fieldset>
            <legend className="text-2xl">Бажана дата та отримання</legend>
            <div className="mt-4"><Calendar value={date} onChange={setDate} onInfo={onInfo} /></div>
            {fieldErr.desiredDate && <p className="error">{fieldErr.desiredDate}</p>}
            {urgent && <p className="mt-3 rounded-xl bg-cherry/10 p-3 text-sm text-cherry">До обраної дати менше {calInfo?.leadDays} днів. Термінове замовлення потребує окремого погодження з Дар’єю.</p>}
            <span className="label mt-5">Отримання</span>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Отримання">
              <button type="button" role="radio" aria-checked={delivery === "AGREE"} className="chip" onClick={() => setDelivery("AGREE")}>Узгодити спосіб отримання</button>
              <button type="button" role="radio" aria-checked={delivery === "TAXI"} className="chip" onClick={() => setDelivery("TAXI")}>Доставка таксі</button>
            </div>
            {delivery === "TAXI" && <p className="mt-2 text-xs text-muted">Вартість таксі узгоджується окремо.</p>}
          </fieldset>
        )}

        {step === 5 && product && (
          <fieldset>
            <legend className="text-2xl">Контакти та перевірка</legend>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="name">Ім’я</label>
                <input id="name" className="field" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!fieldErr.name} />
                {fieldErr.name && <p className="error">{fieldErr.name}</p>}
              </div>
              <div>
                <label className="label" htmlFor="phone">Телефон</label>
                <input id="phone" className="field" type="tel" inputMode="tel" autoComplete="tel" placeholder="095 029 12 14" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={!!fieldErr.phone || (phone !== "" && !phoneNorm)} aria-describedby="phone-hint" />
                <p id="phone-hint" className="mt-1 text-xs text-muted">{phoneNorm ? `Збережемо як ${phoneNorm}` : "Український номер: 095…, 380… або +380…"}</p>
                {fieldErr.phone && <p className="error">{fieldErr.phone}</p>}
              </div>
            </div>
            <dl className="mt-5 grid gap-1 rounded-2xl bg-milk p-4 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted">Позиція</dt><dd className="text-right font-medium">{cat?.name}: {product.name}</dd></div>
              {product.price_type !== "ASK" && <div className="flex justify-between gap-3"><dt className="text-muted">{product.unit === "KG" ? "Вага" : "Кількість"}</dt><dd>{product.unit === "KG" ? `${qty / 1000} кг` : `${qty} шт`}</dd></div>}
              {filling && <div className="flex justify-between gap-3"><dt className="text-muted">Начинка</dt><dd>{filling}</dd></div>}
              {product.options.filter((g) => sel[g.key]).map((g) => <div key={g.key} className="flex justify-between gap-3"><dt className="text-muted">{g.label}</dt><dd className="text-right">{sel[g.key]}</dd></div>)}
              <div className="flex justify-between gap-3"><dt className="text-muted">Дата</dt><dd>{date}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Отримання</dt><dd>{delivery === "TAXI" ? "Доставка таксі" : "Узгодимо"}</dd></div>
              <div className="flex justify-between gap-3 border-t border-ink/10 pt-2"><dt className="text-muted">Орієнтовна вартість без декору та доставки</dt><dd className="font-semibold">{est ? formatEstimate(est) : "Вартість уточнюйте"}</dd></div>
            </dl>
            <label className="mt-5 flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 h-5 w-5 accent-cherry" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>Ім’я та номер телефону використовуються лише для зв’язку щодо цієї заявки. Я ознайомлений(-а) з <a href="/pryvatnist" className="underline" target="_blank">інформацією про обробку персональних даних</a>.</span>
            </label>
            {fieldErr.consent && <p className="error">{fieldErr.consent}</p>}
            <p className="mt-3 text-xs text-muted">Заявка не є підтвердженим замовленням і не бронює дату автоматично.</p>
          </fieldset>
        )}

        {/* файл лишається у формі між кроками (не розмонтовується) */}
        <div hidden={step !== 3}>
          <input ref={fileRef} id="reference" name="reference" type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="field" aria-describedby="ref-hint" />
          <p id="ref-hint" className="mt-1 text-xs text-muted">Одне зображення до 5 МБ. Референс бачить лише Дар’я.</p>
          {fieldErr.reference && <p className="error">{fieldErr.reference}</p>}
        </div>

        {(localErr || (state && !state.ok)) && (
          <p className="mt-4 rounded-xl bg-cherry/10 p-3 text-sm text-cherry" role="alert">
            {localErr ?? (state && !state.ok ? state.message : "")}
            {!localErr && firstErrStep != null && firstErrStep !== step && <button type="button" className="ml-2 underline" onClick={() => setStep(firstErrStep)}>Перейти до кроку {firstErrStep + 1}</button>}
          </p>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button type="button" className="btn btn-outline" disabled={step === 0 || pending} onClick={() => setStep((s) => s - 1)}>Назад</button>
          {step < STEPS.length - 1
            ? <button type="button" className="btn btn-cherry" onClick={next}>Далі</button>
            : <button type="submit" className="btn btn-cherry" disabled={pending} aria-busy={pending}>{pending ? "Надсилаю…" : "Надіслати заявку"}</button>}
        </div>
      </form>
    </div>
  );
}
