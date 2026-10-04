import type { StaticImageData } from "next/image";
import kravchenko from "@/assets/doctors/kravchenko.png";
import melnyk from "@/assets/doctors/melnyk.png";

/**
 * Doctor portraits, in the same order as `doctors.items` in dictionaries.ts.
 * `null` renders a styled monogram until a photo is supplied.
 * To add one: put the file in src/assets/doctors/ and import it here.
 * Recommended: 4:5 portrait, at least 1120×1400, same clinic background as the others.
 */
export const doctorPhotos: (StaticImageData | null)[] = [
  kravchenko, // Олена Кравченко
  melnyk, // Андрій Мельник
  null, // Ірина Соколова
  null, // Максим Гнатюк
];
