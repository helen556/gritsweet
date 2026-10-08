export default function InfoPage({ title, children, draft }: { title: string; children: React.ReactNode; draft?: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-5xl text-moss-900">{title}</h1>
      {draft && <p role="note" className="mt-6 rounded-2xl border border-gold/60 bg-cream/70 p-4 text-ink-soft">{draft}</p>}
      <div className="prose-soft mt-8 text-[1.05rem] text-ink-soft [&_h2]:mt-10 [&_h2]:text-3xl [&_h2]:text-moss-900 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">{children}</div>
    </div>
  );
}
