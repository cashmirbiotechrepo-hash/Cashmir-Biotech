import Image from "next/image";

type ProductVisualProps = {
  name: string;
  category: string;
  imageUrl?: string;
  className?: string;
};

/** Product imagery — uses the real catalog asset when available. */
export function ProductVisual({ name, category, imageUrl, className }: ProductVisualProps) {
  return (
    <div
      className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-pearl to-mist ${className ?? ""}`}
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={name}
          width={600}
          height={600}
          className="h-[88%] w-auto object-contain drop-shadow-[0_24px_40px_rgba(17,17,17,0.18)]"
        />
      ) : (
        <div className="animate-breathe h-28 w-28 rounded-full bg-[radial-gradient(circle_at_34%_30%,rgba(255,255,255,0.95),rgba(209,184,140,0.35)_60%,transparent)]" />
      )}
      <span className="absolute left-4 top-4 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-mute">
        {category}
      </span>
    </div>
  );
}
