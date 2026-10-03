import { forwardRef } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "ghost" | "quiet";
type Size = "md" | "lg";

const base =
  "relative inline-flex select-none items-center justify-center gap-2.5 font-sans font-medium tracking-[0.01em] " +
  "transition-[background-color,border-color,color,opacity,transform] duration-200 ease-[var(--ease-cinema)] " +
  "active:translate-y-px disabled:pointer-events-none disabled:opacity-45 touch-manipulation";

const variants: Record<Variant, string> = {
  // Головна дія: срібне світло на темряві.
  primary: "rounded-[var(--radius-hair)] bg-frost text-abyss hover:bg-white",
  // Вторинна: тонка сталева рамка.
  ghost:
    "rounded-[var(--radius-hair)] border border-mist/45 bg-abyss/25 text-frost backdrop-blur-[2px] hover:border-frost hover:bg-abyss/45",
  // Текстова дія.
  quiet: "text-mist underline-offset-4 hover:text-frost hover:underline",
};

const sizes: Record<Size, string> = {
  md: "min-h-12 px-5 text-[0.95rem]",
  lg: "min-h-14 px-8 text-base sm:min-w-44",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(base, variants[variant], variant !== "quiet" && sizes[size], variant === "quiet" && "min-h-11 px-1", className)}
      {...props}
    />
  );
});
