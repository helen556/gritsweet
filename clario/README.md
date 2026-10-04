# Clario Vision Clinic — website

Next.js 16 (App Router) · Tailwind CSS 4 · Framer Motion. Ukrainian at `/`, English at `/en`.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
npm run lint && npm run typecheck
```

Set `NEXT_PUBLIC_SITE_URL` (e.g. `https://clariovision.com`) for canonical URLs, OG, sitemap and robots.

## Structure

```
src/
  app/
    [lang]/layout.tsx       html/body, fonts, metadata (OG, hreflang), booking panel, cursor
    [lang]/page.tsx         home page: section order + JSON-LD (MedicalClinic)
    [lang]/not-found.tsx    404 (both languages, picked by <html lang>)
    [lang]/[...rest]        unknown paths → 404
    api/booking/route.ts    booking endpoint (validation only — see below)
    sitemap.ts, robots.ts, icon.svg, globals.css (design tokens)
  proxy.ts                  "/" → Ukrainian, "/en" → English, "/uk" → redirect to "/"
  content/dictionaries.ts   all copy (UA final wording + EN translation), contacts, prices
  content/doctor-photos.ts  doctor portrait slots
  components/               Header, Footer, Cursor, ParallaxImage, Reveal, booking/*, sections/*
  assets/                   keyframe images (optimized by next/image)
public/media/               hero video (WebM + MP4, no audio, faststart)
```

## Content

All texts live in `src/content/dictionaries.ts`. The Ukrainian copy is the client's final wording;
English is a direct translation. Doctors, prices, contacts and **reviews are demo data** — replace
the reviews with real ones (with patients' consent) before launch.

**Doctor photos:** until real portraits are supplied, cards show a styled monogram. Add photos in
`src/content/doctor-photos.ts` (instructions in the file).

## Booking

The form (section + side panel opened from every «Записатися» button) validates on the client and
on the server (`src/lib/booking.ts`, zod). `api/booking` currently only validates and logs — connect
it to the clinic's CRM / email / messenger at the `TODO` in `src/app/api/booking/route.ts`.

## Media

- Hero video: re-encoded from the supplied `hero_video.mp4` (6.1 MB → ~0.9 MB MP4 / ~0.6 MB WebM),
  audio removed. The first frame is the poster and LCP image; the video fades in once it plays and is
  skipped for reduced motion / data saver. A slight CSS overscan keeps the generator mark in the
  source's lower-right corner out of frame.
- Keyframes are served through `next/image` (AVIF/WebP, responsive sizes, blur placeholders, lazy).
