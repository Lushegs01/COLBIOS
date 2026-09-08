import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/**
 * The one button in the application.
 *
 * Sizes are set so every tap target clears 44px on a phone, which is the
 * threshold below which thumbs start missing on small Android screens.
 */

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine-700";

const variants: Record<Variant, string> = {
  primary: "bg-pine-700 text-white shadow-soft hover:bg-pine-800 active:bg-pine-900",
  secondary: "border border-line bg-white text-ink shadow-xs hover:border-ink/30",
  ghost: "text-pine-700 hover:bg-pine-50",
  danger: "bg-red-700 text-white shadow-soft hover:bg-red-800",
};

const sizes: Record<Size, string> = {
  sm: "min-h-[38px] px-3.5 py-2 text-[13px]",
  md: "min-h-[44px] px-5 py-2.5 text-sm",
  lg: "min-h-[52px] w-full px-6 py-3.5 text-[15px] sm:w-auto",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = ""): string {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

export function Button({ variant, size, className = "", children, ...rest }: ButtonProps) {
  return (
    <button className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

export function ButtonLink({ variant, size, className = "", children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}
