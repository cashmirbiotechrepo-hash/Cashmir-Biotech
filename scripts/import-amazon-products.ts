/**
 * One-shot import: Amazon scrape JSON → Cashmir Product rows.
 * Pricing: sell at Amazon price − ₹40. Images left as placeholder for manual upload.
 *
 * Run: node --env-file=.env --import tsx scripts/import-amazon-products.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const PRICE_DISCOUNT_INR = 40;
const PLACEHOLDER_IMAGE = "/products/placeholder.svg";

type AmazonPrice = { value?: number; currency?: string } | null;
type AmazonAttr = { key: string; value: string };
type AmazonProduct = {
  title?: string;
  asin?: string;
  price?: AmazonPrice;
  listPrice?: AmazonPrice;
  description?: string | null;
  features?: string[] | null;
  breadCrumbs?: string | null;
  attributes?: AmazonAttr[] | null;
  inStock?: boolean;
  importantInformation?: {
    items?: { title?: string; text?: string }[];
  } | null;
};

function attr(p: AmazonProduct, key: string): string {
  return (p.attributes ?? []).find((a) => a.key.toLowerCase() === key.toLowerCase())?.value?.trim() ?? "";
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

/** Clean Amazon SEO titles into storefront product names. */
function cleanName(title: string): string {
  let name = title
    .replace(/\s*\|\s*.*$/u, "")
    .replace(/\s*-\s*\d+\s*(Capsules|Tablets|Count|Grams?|gm|ml|Milliliters?).*$/iu, "")
    .replace(/\bCashmir Biotech\b/gi, "")
    .replace(/\bNatural\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  // Prefer recognizable brand-line names
  const lower = title.toLowerCase();
  if (lower.includes("zincmag") || (lower.includes("zinc") && lower.includes("magnesium"))) {
    name = "ZincMag Zinc & Magnesium";
  } else if (lower.includes("pavitra")) {
    name = "Pavitra+ Hair Loss Control Shampoo";
  } else if (lower.includes("iron revive")) {
    name = "Iron Revive Herbal Supplement";
  } else if (lower.includes("isabghol") || lower.includes("psyllium")) {
    name = "Cashmir Isabghol Psyllium Husk";
  } else if (lower.includes("dandelion root")) {
    name = "Dandelion Root Herbal Iron";
  } else if (lower.includes("dandelion whole")) {
    name = "Dandelion Whole Plant Capsules";
  } else if (lower.includes("men's wellness") || lower.includes("mens wellness")) {
    name = "TaxO Men's Wellness Powder";
  } else if (lower.includes("taxo magic food") && lower.includes("pack of 2")) {
    name = "TaxO Magic Food Pack of 2";
  } else if (lower.includes("taxo magic food")) {
    name = "TaxO Magic Food";
  } else if (lower.includes("taxo") && lower.includes("above 40") && lower.includes("250")) {
    name = "TaxO Health Supplement 250 g";
  } else if (lower.includes("taxo") && lower.includes("80") && /(pack of 2|\(2\))/i.test(title)) {
    name = "TaxO Health Supplement 80 g (Pack of 2)";
  } else if (lower.includes("taxo") && lower.includes("80")) {
    name = "TaxO Health Supplement 80 g";
  }

  return name.replace(/\s{2,}/g, " ").trim() || title.slice(0, 80);
}

function sizeLabel(p: AmazonProduct, title: string): string {
  const unit = attr(p, "Unit Count") || attr(p, "Number of Items");
  const form = attr(p, "Item Form");
  const weight = attr(p, "Item Weight");

  if (/capsules?/i.test(title) || /capsule/i.test(form)) {
    const m = title.match(/(\d+)\s*Capsules?/i) || unit.match(/(\d+)/);
    if (m) return `${m[1]} capsules`;
  }
  if (/tablets?/i.test(title) || /tablet/i.test(form)) {
    const m = title.match(/(\d+)\s*Tablets?/i) || unit.match(/(\d+)/);
    if (m) return `${m[1]} tablets`;
  }
  if (/ml|milliliter/i.test(title + unit + weight)) {
    const m = (title + " " + unit + " " + weight).match(/(\d+(?:\.\d+)?)\s*(?:ml|Milliliters?)/i);
    if (m) return `${m[1]} ml`;
  }
  if (/gram|gm|g\b/i.test(title + unit + weight)) {
    const m = (title + " " + unit + " " + weight).match(/(\d+(?:\.\d+)?)\s*(?:Grams?|gm|g)\b/i);
    if (m) {
      const n = Number(m[1]);
      return Number.isInteger(n) ? `${n} g` : `${m[1]} g`;
    }
  }
  if (unit) return unit.replace(/\.0\b/g, "").replace(/\s+Count/i, " count");
  return "1 pack";
}

function categoryFor(p: AmazonProduct, title: string): string {
  const crumbs = (p.breadCrumbs ?? "").toLowerCase();
  const t = title.toLowerCase();
  if (crumbs.includes("shampoo") || t.includes("shampoo") || t.includes("pavitra")) return "Personal Care";
  if (crumbs.includes("fiber") || t.includes("isabghol") || t.includes("psyllium")) return "Digestive Health";
  if (crumbs.includes("iron") || t.includes("iron revive") || t.includes("dandelion root")) return "Minerals";
  if (crumbs.includes("zinc") || t.includes("zinc") || t.includes("magnesium") || t.includes("dandelion"))
    return "Minerals";
  if (t.includes("taxo") || crumbs.includes("chyawanprash") || crumbs.includes("multivitamin"))
    return "Functional Food";
  return "Supplements";
}

function shortBenefit(p: AmazonProduct, title: string): string {
  const benefit = attr(p, "Product Benefits");
  if (benefit && benefit.length < 120) return benefit;
  const feat = (p.features ?? []).find((f) => f.length > 20 && f.length < 140);
  if (feat) return feat.replace(/^[^:]+:\s*/, "").trim();
  const desc = (p.description ?? "").split(/[.\n]/)[0]?.trim();
  if (desc && desc.length < 140) return desc;
  return `${cleanName(title)} — formulated by Cashmir Biotech for daily wellness.`;
}

function buildDescription(p: AmazonProduct, name: string): string {
  const parts: string[] = [];
  if (p.description?.trim()) parts.push(p.description.trim());

  const features = (p.features ?? []).filter(Boolean);
  if (features.length) {
    parts.push("Key benefits:");
    for (const f of features.slice(0, 6)) parts.push(`• ${f}`);
  }

  const ingredients = p.importantInformation?.items?.find((i) => /ingredient/i.test(i.title ?? ""));
  if (ingredients?.text) {
    parts.push(`Ingredients: ${ingredients.text}`);
  }

  const form = attr(p, "Item Form");
  const primary = attr(p, "Primary Supplement Type");
  if (form || primary) {
    parts.push(
      [form ? `Form: ${form}` : null, primary ? `Supports: ${primary}` : null].filter(Boolean).join(" · ")
    );
  }

  parts.push(
    "Manufactured by Cashmir Biotech Pvt. Ltd., Srinagar, Jammu & Kashmir. For adults. Store in a cool, dry place. This is not a medicinal claim — dietary supplement for nutritional support."
  );

  const text = parts.filter(Boolean).join("\n\n");
  return text || `${name} by Cashmir Biotech — research-backed formulation from Kashmir biodiversity.`;
}

function sellPriceInr(p: AmazonProduct): number {
  const amazon = Math.round(Number(p.price?.value ?? 0));
  if (!Number.isFinite(amazon) || amazon <= 0) {
    throw new Error(`Missing Amazon price for ASIN ${p.asin}`);
  }
  return Math.max(1, amazon - PRICE_DISCOUNT_INR);
}

function skuFromAsin(asin: string): string {
  return `CB-AMZ-${asin}`;
}

async function ensureCategories(names: string[]) {
  let sort = 10;
  for (const name of names) {
    const slug = slugify(name);
    await prisma.category.upsert({
      where: { slug },
      update: { name, active: true },
      create: { slug, name, sortOrder: sort, active: true }
    });
    sort += 10;
  }
}

async function main() {
  const path = resolve(process.cwd(), "dataset_free-amazon-product-scraper_2026-07-14_06-44-27-863.json");
  const raw = JSON.parse(readFileSync(path, "utf8")) as AmazonProduct[];
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("Amazon dataset is empty or invalid.");
  }

  const usedSlugs = new Set<string>();
  const mapped = raw.map((item, index) => {
    const asin = (item.asin || `UNKNOWN${index}`).trim();
    const title = (item.title || `Product ${asin}`).trim();
    const name = cleanName(title);
    let slug = slugify(`${name}-${sizeLabel(item, title)}`);
    if (usedSlugs.has(slug)) slug = `${slug}-${asin.slice(-4).toLowerCase()}`;
    usedSlugs.add(slug);

    const mrpInr = sellPriceInr(item);
    const category = categoryFor(item, title);
    const size = sizeLabel(item, title);
    const featured = /taxo|zincmag|pavitra/i.test(name);

    return {
      asin,
      amazonPrice: Math.round(Number(item.price?.value ?? 0)),
      listPrice: item.listPrice?.value ?? null,
      data: {
        slug,
        name,
        shortBenefit: shortBenefit(item, title),
        description: buildDescription(item, name),
        mrpInr,
        pricePaise: mrpInr * 100,
        sizeLabel: size,
        category,
        imageUrl: PLACEHOLDER_IMAGE,
        images: [] as string[],
        sku: skuFromAsin(asin),
        stockQty: item.inStock === false ? 0 : 25,
        lowStockThreshold: 10,
        leadTimeDays: 5,
        hasInventoryTracking: true,
        featured,
        active: true
      }
    };
  });

  await ensureCategories([...new Set(mapped.map((m) => m.data.category))]);

  console.log(`Importing ${mapped.length} products (Amazon price − ₹${PRICE_DISCOUNT_INR})…\n`);

  for (const row of mapped) {
    const existingBySku = await prisma.product.findUnique({ where: { sku: row.data.sku } });
    const existingBySlug = existingBySku
      ? null
      : await prisma.product.findUnique({ where: { slug: row.data.slug } });

    const existing = existingBySku ?? existingBySlug;

    let product;
    if (existing) {
      product = await prisma.product.update({
        where: { id: existing.id },
        data: {
          ...row.data,
          // Never overwrite images the merchant already uploaded
          imageUrl:
            existing.imageUrl && !existing.imageUrl.includes("placeholder") && existing.imageUrl !== ""
              ? existing.imageUrl
              : PLACEHOLDER_IMAGE,
          images: existing.images?.length ? existing.images : []
        }
      });
      console.log(`↻ ${product.sku}  ${product.name}  ₹${row.amazonPrice} → ₹${product.mrpInr}`);
    } else {
      product = await prisma.product.create({ data: row.data });
      console.log(`+ ${product.sku}  ${product.name}  ₹${row.amazonPrice} → ₹${product.mrpInr}`);
    }

    await prisma.inventory.upsert({
      where: { productId: product.id },
      update: {
        sku: product.sku,
        quantityOnHand: product.stockQty,
        lowStockThreshold: product.lowStockThreshold
      },
      create: {
        productId: product.id,
        sku: product.sku,
        quantityOnHand: product.stockQty,
        quantityReserved: 0,
        lowStockThreshold: product.lowStockThreshold
      }
    });
  }

  console.log("\nDone. Placeholder image set — replace in Admin → Products when ready.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
