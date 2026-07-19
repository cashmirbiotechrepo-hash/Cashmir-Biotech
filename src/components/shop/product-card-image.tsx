"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
};

/** Product image with a skeleton shimmer and fade-in, so cards never pop blank → image. */
export function ProductCardImage({ src, alt, sizes, priority = false, className }: Props) {
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 animate-pulse bg-black/[0.04] transition-opacity duration-300",
          loaded ? "pointer-events-none opacity-0" : "opacity-100"
        )}
      />
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        onLoad={() => setLoaded(true)}
        className={cn(
          "transition-[opacity,transform] duration-500 ease-out",
          loaded ? "opacity-100" : "opacity-0",
          className
        )}
      />
    </>
  );
}
