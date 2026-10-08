/** <picture> з AVIF/WebP та srcset. Для обкладинок — object-fit: contain (назву не обрізаємо). */
export default function Picture({
  base, widths, width, height, alt, sizes, priority = false, className = "", imgClassName = "",
}: {
  base: string; widths: number[]; width: number; height: number; alt: string; sizes: string;
  priority?: boolean; className?: string; imgClassName?: string;
}) {
  const set = (ext: string) => widths.map((w) => `${base}-${w}.${ext} ${w}w`).join(", ");
  const fallback = `${base}-${widths[Math.min(1, widths.length - 1)]}.webp`;
  return (
    <picture className={className}>
      <source type="image/avif" srcSet={set("avif")} sizes={sizes} />
      <source type="image/webp" srcSet={set("webp")} sizes={sizes} />
      <img
        src={fallback} alt={alt} width={width} height={height} sizes={sizes}
        loading={priority ? "eager" : "lazy"} decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : "auto"} className={imgClassName}
      />
    </picture>
  );
}
