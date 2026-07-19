import { getStockStatus, sellingInrFromPaise } from "@/lib/pricing";

type ProductJsonLdProps = {
  product: {
    name: string;
    description: string;
    shortBenefit?: string;
    sku?: string | null;
    imageUrl?: string | null;
    images?: string[];
    mrpInr: number;
    pricePaise?: number | null;
    currency?: string | null;
    lowStockThreshold?: number;
    specs?: unknown;
  };
  available: number;
};

function brandFromSpecs(specs: unknown): string | undefined {
  if (!specs || typeof specs !== "object" || Array.isArray(specs)) return undefined;
  const brand = (specs as Record<string, unknown>).brand;
  return typeof brand === "string" && brand.trim() ? brand.trim() : undefined;
}

export function ProductJsonLd({ product, available }: ProductJsonLdProps) {
  const sellingInr = sellingInrFromPaise(product.pricePaise, product.mrpInr);
  const status = getStockStatus(available, product.lowStockThreshold ?? 5);
  const brand = brandFromSpecs(product.specs);
  const images = [
    ...(product.imageUrl ? [product.imageUrl] : []),
    ...(product.images ?? [])
  ].filter(Boolean);

  const json = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortBenefit || product.description,
    sku: product.sku || undefined,
    image: images.length ? images : undefined,
    brand: brand ? { "@type": "Brand", name: brand } : undefined,
    offers: {
      "@type": "Offer",
      price: sellingInr.toString(),
      priceCurrency: product.currency || "INR",
      availability:
        status === "out_of_stock"
          ? "https://schema.org/OutOfStock"
          : "https://schema.org/InStock"
    }
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
