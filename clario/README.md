# Clario Vision Clinic — website

Static, dependency-free site (`index.html`, `styles.css`, `main.js`). Open `index.html`
through any static server, e.g. `python3 -m http.server` from this folder.

## Visual system

Built around the supplied clinic assets — the clinic style is taken as-is, not redesigned.

| Token group | Values | Source in the keyframes |
|---|---|---|
| Graphite | `#1b1e21` `#24282c` `#31363b` `#474d53` | Feature wall, exam chair |
| Cold gray | `#7b838b` → `#f4f6f8` | Floor, cabinetry, metal |
| White | `#ffffff` | Slit lamp, counters |
| Pale blue | `#f1f6fa` `#e3edf5` `#cfdeea` `#9db8ce` `#4a6a84` | Daylight, OCT monitor |
| Restrained green | `#5c7a62` (accents only) | Potted plants |

Typeface: Manrope (Google Fonts). Logo mark: the eye symbol from the clinic wall.

## Asset usage

| Asset | Where |
|---|---|
| `hero_video.mp4` (unmodified) | Hero background, muted loop; `hero_poster.webp` is its first frame |
| `01_blurred_clinic` | Booking section backdrop |
| `02_slit_lamp_closeup` | Technology section |
| `03_eye_exam_macro` | "Your visit" section |
| `04_clear_clinic` | Intro (window/greenery crop) and full clinic view |

Keyframes are served as WebP (full size + 840px) converted from the original PNGs.
The hero video is scaled slightly in CSS (`.hero-video`) so the generator mark in its
lower-right corner and soft edge bars stay out of frame.

## Before launch

- Replace the placeholder address, phone and email in the footer.
- The booking form validates and confirms on the client only — connect it to the
  clinic's booking system or form endpoint in `main.js`.
