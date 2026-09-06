/** Фото з /images (є .webp + .jpg) або з /uploads (webp). Без зламаних зображень: якщо шляху немає — м'який фон. */
export function Picture({ src, alt, className = "", imgClassName = "", priority = false }: { src: string | null | undefined; alt: string; className?: string; imgClassName?: string; priority?: boolean }) {
  if (!src) return <div className={`bg-gradient-to-br from-milk to-caramel/40 ${className}`} role="img" aria-label={alt} />;
  const isStatic = src.startsWith("/images/") && src.endsWith(".jpg");
  return (
    <picture className={`block ${className}`}>
      {isStatic && <source srcSet={src.replace(/\.jpg$/, ".webp")} type="image/webp" />}
      <img src={src} alt={alt} loading={priority ? "eager" : "lazy"} decoding="async" className={`h-full w-full object-cover ${imgClassName}`} />
    </picture>
  );
}
