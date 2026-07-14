import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Section eyebrow — plain monospace label.
 * No border box, no status dot (those read as generic AI UI).
 */
export function TechChip({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
  /** @deprecated Dot removed site-wide; kept so callers don’t break. */
  dot?: boolean;
}) {
  return <span className={cn("technical inline-block", className)}>{children}</span>;
}
