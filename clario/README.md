# Clario Vision Clinic — website

Next.js 16 (App Router) · Tailwind CSS 4 · Framer Motion. Ukrainian at `/`, English at `/en`.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
npm run lint && npm run typecheck
```

Set `NEXT_PUBLIC_SITE_URL` (e.g. `https://clariovision.com`) for canonical URLs, OG, sitemap and robots.

## Deploy to Vercel

The repository root holds another app, so this site is deployed as its own Vercel project:

1. Vercel → **Add New… → Project** → import this GitHub repository.
2. **Root Directory:** `clario` (Framework Preset: Next.js is detected automatically; leave build/install commands empty).
3. **Environment Variables:** `NEXT_PUBLIC_SITE_URL` = the production URL, e.g. `https://clariovision.com`.
4. **Deploy.** Every push to the branch then gets its own preview URL.

CLI alternative: `cd clario && npx vercel link && npx vercel build && npx vercel deploy --prebuilt`.
Node.js 20.9+ is required (`engines` in package.json).

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

- Hero video: from the 4K upscaled master (3836×2010), top soft bar cropped. Versions (no audio, 30 fps,
  WebM + MP4): a native 1080×1920 vertical crop for portrait screens, native 3412×1920 for retina
  desktops, plus 1440p and 1080p. File names carry a version (`hero-v2-*`) because `/media` is cached
  as immutable — use a new name whenever a video changes. Posters are art-directed the same way.
- Keyframes use the original PNGs as the single source; `next/image` encodes them once at quality 92
  (AVIF/WebP, responsive sizes, blur placeholders, lazy). Source resolution is 1672×941 — supply larger
  originals in `src/assets/` for even sharper results on large retina screens.
