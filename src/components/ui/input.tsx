"use client";

import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";

function Input({ className, type, defaultValue, value, ...props }: React.ComponentProps<"input">) {
  // Base UI warns if an uncontrolled FieldControl's defaultValue prop changes after mount
  // (e.g. after router.refresh updates admin forms). Lock the initial default for
  // uncontrolled usage; controlled usage (value prop) still works normally.
  const initialDefault = React.useRef(defaultValue);
  const isControlled = value !== undefined;

  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "flex h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors outline-none",
        "placeholder:text-muted-foreground",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
      {...(isControlled
        ? { value }
        : { defaultValue: initialDefault.current ?? "" })}
    />
  );
}

export { Input };
