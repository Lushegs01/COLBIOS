import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { siteConfig } from "@/lib/site";

type Props = {
  children?: ReactNode;
  variant?: "primary" | "secondary" | "onDark";
  size?: "sm" | "md" | "lg";
  className?: string;
  withArrow?: boolean;
};

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-all duration-200";

const variants = {
  primary:
    "bg-pine-700 text-white shadow-soft hover:bg-pine-800 hover:shadow-lift hover:-translate-y-px active:translate-y-0",
  secondary:
    "border border-line bg-white text-ink shadow-xs hover:border-ink/30",
  onDark:
    "bg-white text-pine-800 shadow-lift hover:bg-pine-50 hover:-translate-y-px active:translate-y-0",
};

const sizes = {
  sm: "px-4 py-2 text-[13px]",
  md: "px-6 py-3 text-sm",
  lg: "px-7 py-3.5 text-[15px]",
};

/**
 * Every "pay" action on the page routes through this single component,
 * so the destination can be swapped from one place in lib/site.ts.
 */
export default function PayDuesButton({
  children = "Pay dues now",
  variant = "primary",
  size = "md",
  className = "",
  withArrow = true,
}: Props) {
  return (
    <a
      href={siteConfig.paymentUrl}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
      {withArrow && (
        <ArrowRight
          size={size === "sm" ? 14 : 16}
          strokeWidth={2.25}
          aria-hidden="true"
        />
      )}
    </a>
  );
}
