import type { SVGProps } from "react";

export function ArrowIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function EyeMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 28" fill="none" aria-hidden="true" {...props}>
      <path d="M2 14C8.5 5.5 15.8 2 24 2s15.5 3.5 22 12c-6.5 8.5-13.8 12-22 12S8.5 22.5 2 14Z" stroke="currentColor" strokeWidth={2.2} strokeLinejoin="round" />
      <circle cx="24" cy="14" r="7.2" stroke="currentColor" strokeWidth={2.2} />
      <circle cx="24" cy="14" r="3" fill="currentColor" />
    </svg>
  );
}

const servicePaths: Record<string, string[]> = {
  consultation: ["M4 20c4.5-6.5 9.8-9.5 16-9.5S31.5 13.5 36 20c-4.5 6.5-9.8 9.5-16 9.5S8.5 26.5 4 20Z", "M20 15a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z"],
  diagnostics: ["M20 6a14 14 0 1 0 0 28 14 14 0 0 0 0-28Z", "M20 13a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z", "M20 6v4M20 30v4M6 20h4M30 20h4"],
  pediatric: ["M20 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z", "M11 33c0-5.5 4-9.5 9-9.5s9 4 9 9.5", "M14 24l-3-3M26 24l3-3"],
  laser: ["M6 27c6-10 22-10 28 0", "M10 19c5-6 15-6 20 0", "M20 5v8", "M20 27a2.5 2.5 0 1 0 0 .01"],
  cataract: ["M20 6a14 14 0 1 0 0 28 14 14 0 0 0 0-28Z", "M13 14c3-2 11-2 14 0M12 20h16M13 26c3 2 11 2 14 0"],
  optics: ["M4 21a6 6 0 1 0 12 0 6 6 0 0 0-12 0ZM24 21a6 6 0 1 0 12 0 6 6 0 0 0-12 0Z", "M16 20c2.5-2 5.5-2 8 0", "M4 19l3-8h4M36 19l-3-8h-4"],
};

export function ServiceIcon({ id, ...props }: { id: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {(servicePaths[id] ?? servicePaths.consultation).map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
