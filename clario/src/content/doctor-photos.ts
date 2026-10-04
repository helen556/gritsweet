import type { StaticImageData } from "next/image";

/**
 * Doctor portraits, in the same order as `doctors.items` in dictionaries.ts.
 * Until real photos are supplied the site renders a styled monogram portrait.
 * To add one: put the file in src/assets/doctors/ and import it here, e.g.
 *   import kravchenko from "@/assets/doctors/kravchenko.jpg";
 * Recommended: 4:5 portrait, at least 1200×1500, neutral cold-gray or clinic background.
 */
export const doctorPhotos: (StaticImageData | null)[] = [null, null, null, null];
