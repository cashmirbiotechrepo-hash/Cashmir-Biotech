"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { Magnetic } from "@/components/ui/magnetic";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "light";

type LuxeButtonProps = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: Variant;
  className?: string;
  type?: "button" | "submit";
  ariaLabel?: string;
  /** Magnetic cursor pull. Disable for static buttons. */
  magnetic?: boolean;
};

const base =
  "group relative inline-flex items-center justify-center gap-2.5 overflow-hidden rounded-full px-7 py-3.5 text-[13px] font-medium tracking-[0.02em] transition-colors duration-500";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-paper",
  ghost: "border border-ink/15 text-ink hover:border-ink/40",
  light: "bg-paper text-ink"
};

/**
 * The signature call-to-action: magnetic pull, a champagne-gold fill that
 * sweeps in from the left, and a subtle depth press.
 */
export function LuxeButton({
  children,
  href,
  onClick,
  variant = "primary",
  className,
  type = "button",
  ariaLabel,
  magnetic = true
}: LuxeButtonProps) {
  const showFill = variant !== "ghost";

  const inner = (
    <>
      {showFill ? (
        <span className="absolute inset-0 origin-left scale-x-0 rounded-full bg-gold transition-transform duration-500 ease-expo group-hover:scale-x-100" />
      ) : (
        <span className="absolute inset-0 origin-left scale-x-0 rounded-full bg-ink transition-transform duration-500 ease-expo group-hover:scale-x-100" />
      )}
      <span
        className={cn(
          "relative z-10 flex items-center gap-2 transition-colors duration-500",
          variant === "ghost" && "group-hover:text-paper"
        )}
      >
        {children}
      </span>
    </>
  );

  const classes = cn(base, variants[variant], className);

  const element = href ? (
    <Link href={href} className={classes} aria-label={ariaLabel}>
      {inner}
    </Link>
  ) : (
    <button type={type} onClick={onClick} className={classes} aria-label={ariaLabel}>
      {inner}
    </button>
  );

  if (!magnetic) return element;

  return <Magnetic strength={0.4}>{element}</Magnetic>;
}
