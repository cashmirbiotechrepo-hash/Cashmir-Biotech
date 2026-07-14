/**
 * Seed Amplify/RDS catalog data (patents, team, settings, products) + bootstrap admin.
 * Does NOT create orders.
 *
 * Usage:
 *   $env:ALLOW_PROD_SEED="yes"
 *   $env:DATABASE_URL="postgresql://..."
 *   $env:PASSWORD_PEPPER="<amplify pepper>"
 *   $env:ADMIN_EMAIL="cashmirbiotech@gmail.com"
 *   $env:ADMIN_RESET_PASSWORD="Khalid@345"
 *   node --import tsx scripts/seed-amplify-catalog.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHmac } from "node:crypto";
import { hashSync } from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function looksLikeProductionDatabase(url: string): boolean {
  const lower = (url || "").toLowerCase();
  if (!lower) return false;
  if (lower.includes("localhost") || lower.includes("127.0.0.1")) return false;
  return true;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

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

function cleanName(title: string): string {
  let name = title
    .replace(/\s*\|\s*.*$/u, "")
    .replace(/\s*-\s*\d+\s*(Capsules|Tablets|Count|Grams?|gm|ml|Milliliters?).*$/iu, "")
    .replace(/\bCashmir Biotech\b/gi, "")
    .replace(/\bNatural\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

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

async function seedSiteSettings() {
  await prisma.siteSettings.upsert({
    where: { id: 1 },
    update: {
      companyName: "Cashmir Biotech Pvt Ltd",
      heroTitle: "The architecture of daily vitality",
      heroSubtitle: "Proven biotech innovation from Kashmir biodiversity",
      heroDescription:
        "Premium supplements with scientific discipline, patent-backed innovation, and research-grade manufacturing standards.",
      ctaPrimaryText: "Explore Catalog",
      ctaPrimaryHref: "/products",
      ctaSecondaryText: "View Patents",
      ctaSecondaryHref: "/patents",
      missionStatement:
        "A mission to treat disorders with healthy, non-toxic, safe and accessible designer foods powered by biotechnology."
    },
    create: {
      id: 1,
      companyName: "Cashmir Biotech Pvt Ltd",
      heroTitle: "The architecture of daily vitality",
      heroSubtitle: "Proven biotech innovation from Kashmir biodiversity",
      heroDescription:
        "Premium supplements with scientific discipline, patent-backed innovation, and research-grade manufacturing standards.",
      ctaPrimaryText: "Explore Catalog",
      ctaPrimaryHref: "/products",
      ctaSecondaryText: "View Patents",
      ctaSecondaryHref: "/patents",
      missionStatement:
        "A mission to treat disorders with healthy, non-toxic, safe and accessible designer foods powered by biotechnology."
    }
  });
  console.log("[seed] Site settings ready");
}

async function seedPatents() {
  const patents = [
    {
      patentCode: "IN-582752",
      title: "Novel Method for Formulation by Isolation (+) Syringaresinol and Application Thereof",
      summary:
        "A novel formulation process involving the isolation of (+)-Syringaresinol, a bioactive natural lignan with pharmaceutical, antioxidant, and anti-inflammatory applications.",
      status: "Granted",
      jurisdiction: "India",
      imageUrl: "/patents/syringaresinol.png",
      publishedAt: new Date("2026-03-10")
    },
    {
      patentCode: "IN-579246",
      title: "Benzothiazole Derived Schiff's Bases for Targeting C4-2 Castration-Resistant Prostate Cancer Cells",
      summary:
        "Benzothiazole-derived Schiff's base compounds developed as targeted therapeutics against castration-resistant prostate cancer.",
      status: "Granted",
      jurisdiction: "India",
      imageUrl: "/patents/benzothiazole-schiff-bases.png",
      publishedAt: new Date("2026-01-29")
    },
    {
      patentCode: "IN-563922",
      title: "Benzothiazole–Piperazine Hybrids to Target C4-2 Castration Resistant Prostate Cancer Cells",
      summary:
        "Pharmaceutical innovation involving benzothiazole-piperazine hybrid molecules for targeted treatment of castration-resistant prostate cancer.",
      status: "Granted",
      jurisdiction: "India",
      imageUrl: "/patents/benzothiazole-piperazine.png",
      publishedAt: new Date("2025-03-27")
    },
    {
      patentCode: "DESIGN-473811",
      title: "Plant-Based Drug Preparation Device for Cancer Treatment",
      summary:
        "Registered industrial design protecting the structural configuration of a plant-based drug preparation device for cancer treatment applications.",
      status: "Registered Design",
      jurisdiction: "India",
      imageUrl: "/patents/muskaan-design.png",
      publishedAt: new Date("2025-09-17")
    },
    {
      patentCode: "IN-545929",
      title: "PH Indicator and Method Thereof",
      summary:
        "Innovative pH indicator system for rapid, accurate acidity/alkalinity detection in laboratories, agriculture, food analysis, and biotechnology.",
      status: "Granted",
      jurisdiction: "India",
      imageUrl: "/patents/ph-indicator.png",
      publishedAt: new Date("2024-07-25")
    },
    {
      patentCode: "IN-499495",
      title: "Nutritional Herbal Compound Extract and Its Method of Preparation",
      summary:
        "Novel herbal nutritional formulation and extraction methodology for nutraceutical compounds with improved nutritional value and therapeutic benefits.",
      status: "Granted",
      jurisdiction: "India",
      imageUrl: "/patents/magic-food-extract.png",
      publishedAt: new Date("2024-01-15")
    },
    {
      patentCode: "IN-484202",
      title: "Nucleotide Sequences for Improving Tolerance of Plants to Environmental Stress",
      summary:
        "Nucleotide sequences that enhance plant tolerance against cold, drought, salinity, and other abiotic environmental stresses.",
      status: "Granted",
      jurisdiction: "India",
      imageUrl: "/patents/nucleotide-cold-tolerance.png",
      publishedAt: new Date("2023-12-18")
    },
    {
      patentCode: "IN-551144",
      title: "Composition of Natural Herbal Capsule Using Carrots, Fenugreek and Bitter Gourd for Diabetes Care",
      summary:
        "Herbal anti-diabetic formulation combining carrot, fenugreek, and bitter gourd to support blood glucose management and metabolic health.",
      status: "Inventorship Certificate",
      jurisdiction: "India",
      imageUrl: "/patents/daucus-diabetes-capsule.png",
      publishedAt: new Date("2023-12-05")
    },
    {
      patentCode: "IN-557247",
      title: "Efficient and Quick RNA Extraction Method",
      summary:
        "Rapid RNA extraction protocol improving isolation efficiency while reducing processing time for molecular biology and diagnostics.",
      status: "Inventorship Certificate",
      jurisdiction: "India",
      imageUrl: "/patents/rna-extraction-kit.png",
      publishedAt: new Date("2019-06-25")
    },
    {
      patentCode: "IN-435971",
      title: "A Smart Farming Unit for Saffron Flower and Corm Production",
      summary:
        "Integrated smart farming system for scientific saffron cultivation — improving flower production, corm multiplication, and environmental control.",
      status: "Inventorship Certificate",
      jurisdiction: "India",
      imageUrl: "/patents/saffron-smart-farming.png",
      publishedAt: new Date("2022-07-31")
    },
    {
      patentCode: "TM-6062832",
      title: "Cashmir Biotech Private Limited Trademark",
      summary:
        "Registered trademark protecting the Cashmir Biotech brand for pharmaceutical, nutraceutical, dietary supplement, and healthcare products (Class 5).",
      status: "Registered Trademark",
      jurisdiction: "India",
      imageUrl: "/patents/cashmir-trademark.png",
      publishedAt: new Date("2023-08-11")
    },
    {
      patentCode: "DE-20-2022-104-500",
      title: "System for Detection and Prevention of Cydia pomonella Granulovirus (CPGV) as a Biopesticide",
      summary:
        "German utility model for detecting and preventing Codling Moth Granulovirus using environmentally friendly biopesticide technology.",
      status: "Utility Model",
      jurisdiction: "Germany",
      imageUrl: "/patents/german-utility-model.jpg",
      publishedAt: new Date("2022-01-01")
    }
  ];

  for (const pat of patents) {
    await prisma.patent.upsert({
      where: { patentCode: pat.patentCode },
      update: pat,
      create: pat
    });
  }
  console.log(`[seed] Patents upserted: ${patents.length}`);
}

async function seedTeam() {
  const teamMembers = [
    {
      fullName: "Dr. Khalid Zaffar Masoodi",
      role: "Director and Founder",
      bio: "Associate Professor and Senior Scientist at the Division of Plant Biotechnology, Faculty of Horticulture, SKUAST-K. A pivotal figure in founding Cashmir Biotech, he leads R&D of anticancer functional foods — including the flagship Magic Food, which contains TaxO, an anticancer molecule derived from underutilised plants native to Kashmir. His leadership commercialised Magic Food and earned national and international recognition, and he founded the startup under India's Make in India, Innovate India, and Self-Reliant India initiatives. Promoter and director since incorporation on September 19, 2022.",
      avatarUrl: "/team/dr-khalid-zaffar-masoodi.jpg",
      sortOrder: 1
    },
    {
      fullName: "Aqib Ahmad Hurra",
      role: "Director",
      bio: "A young entrepreneur and researcher who joined the startup as one of Dr. Masoodi's MSc students at SKUAST-K. His work on the research and development of functional foods has been critical to the company's success. As co-founder he drives the operational and strategic aspects of Cashmir Biotech, embodying the startup's faculty–student collaboration model. Promoter and director since incorporation on September 19, 2022.",
      avatarUrl: "/team/aqib-ahmad-hurra.png",
      sortOrder: 2
    },
    {
      fullName: "Dr. Hilal Ahmad Rather",
      role: "Product Manager (Scientific)",
      bio: "A biotechnologist with expertise in product development and scientific research. As Product Manager (Scientific), he oversees the development, testing, and commercialisation of Cashmir Biotech's portfolio, including functional foods and health supplements like Magic Food. He ensures products meet scientific standards, regulatory requirements, and market needs — bridging research and practical application to enhance product efficacy and customer satisfaction.",
      avatarUrl: "/team/dr-hilal-ahmad-rather.png",
      sortOrder: 3
    },
    {
      fullName: "Azmaan Shafi",
      role: "Marketing Manager",
      bio: "A skilled marketing professional with expertise in promoting biotech products and building brand presence in competitive markets. As Marketing Manager, he leads marketing strategy — developing campaigns, managing customer engagement, and expanding market reach across digital and traditional channels to bring products like Magic Food to national and international audiences, supporting the company's growth and visibility.",
      avatarUrl: "",
      sortOrder: 4
    }
  ];

  for (const member of teamMembers) {
    const existing = await prisma.teamMember.findFirst({ where: { fullName: member.fullName } });
    if (existing) {
      await prisma.teamMember.update({ where: { id: existing.id }, data: member });
    } else {
      await prisma.teamMember.create({ data: member });
    }
  }
  console.log(`[seed] Team members upserted: ${teamMembers.length}`);
}

async function seedAmazonProducts() {
  const magicPatent = await prisma.patent.findUnique({ where: { patentCode: "IN-499495" } });
  const path = resolve(process.cwd(), "dataset_free-amazon-product-scraper_2026-07-14_06-44-27-863.json");
  const raw = JSON.parse(readFileSync(path, "utf8")) as AmazonProduct[];
  const PRICE_DISCOUNT_INR = 40;

  const usedSlugs = new Set<string>();
  let sortCats = 10;
  const categories = new Set<string>();

  for (let index = 0; index < raw.length; index++) {
    const item = raw[index]!;
    const asin = (item.asin || `UNKNOWN${index}`).trim();
    const title = (item.title || `Product ${asin}`).trim();
    const name = cleanName(title);
    let slug = slugify(`${name}-${sizeLabel(item, title)}`);
    if (usedSlugs.has(slug)) slug = `${slug}-${asin.slice(-4).toLowerCase()}`;
    usedSlugs.add(slug);

    const amazon = Math.round(Number(item.price?.value ?? 0));
    if (!Number.isFinite(amazon) || amazon <= 0) {
      throw new Error(`Missing Amazon price for ASIN ${asin}`);
    }
    const mrpInr = Math.max(1, amazon - PRICE_DISCOUNT_INR);
    const category = categoryFor(item, title);
    categories.add(category);
    const size = sizeLabel(item, title);
    const featured = /taxo|zincmag|pavitra/i.test(name);
    // Map scrape order → numbered product photos in /public/products/{1..11}.png
    const imageUrl = `/products/${Math.min(index + 1, 11)}.png`;
    const sku = `CB-AMZ-${asin}`;
    const isTaxo = /taxo|magic food|wellness powder/i.test(name + title);

    const data = {
      slug,
      name,
      shortBenefit: shortBenefit(item, title),
      description: buildDescription(item, name),
      mrpInr,
      pricePaise: mrpInr * 100,
      sizeLabel: size,
      category,
      imageUrl,
      images: [imageUrl],
      sku,
      stockQty: item.inStock === false ? 0 : 25,
      lowStockThreshold: 10,
      leadTimeDays: 5,
      hasInventoryTracking: true,
      featured,
      active: true,
      patentId: isTaxo && magicPatent ? magicPatent.id : null
    };

    const existingBySku = await prisma.product.findUnique({ where: { sku } });
    const existingBySlug = existingBySku
      ? null
      : await prisma.product.findUnique({ where: { slug } });
    const existing = existingBySku ?? existingBySlug;

    const product = existing
      ? await prisma.product.update({ where: { id: existing.id }, data })
      : await prisma.product.create({ data });

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

    console.log(`  ${existing ? "↻" : "+"} ${product.sku}  ${product.name}  ₹${amazon} → ₹${mrpInr}  ${imageUrl}`);
  }

  for (const name of categories) {
    const slug = slugify(name);
    await prisma.category.upsert({
      where: { slug },
      update: { name, active: true },
      create: { slug, name, sortOrder: sortCats, active: true }
    });
    sortCats += 10;
  }

  // Flagship seed product (also keeps legacy slug alive)
  await prisma.product.upsert({
    where: { slug: "magic-food-taxo-250g" },
    update: {
      name: "Magic Food TaxO",
      shortBenefit: "Nutritional herbal compound for daily vitality",
      description:
        "Flagship functional food containing the patented TaxO molecule — a nutritional herbal compound extract from underutilised Kashmiri flora. Contains nutrients, minerals and vitamins. 100% natural health supplement.",
      mrpInr: 350,
      pricePaise: 35000,
      sizeLabel: "250 g",
      category: "Functional Food",
      imageUrl: "/products/magic-food-taxo.png",
      images: ["/products/magic-food-taxo.png"],
      sku: "CB-FLAGSHIP-TAXO-250G",
      stockQty: 50,
      featured: true,
      active: true,
      patentId: magicPatent?.id ?? null
    },
    create: {
      slug: "magic-food-taxo-250g",
      name: "Magic Food TaxO",
      shortBenefit: "Nutritional herbal compound for daily vitality",
      description:
        "Flagship functional food containing the patented TaxO molecule — a nutritional herbal compound extract from underutilised Kashmiri flora. Contains nutrients, minerals and vitamins. 100% natural health supplement.",
      mrpInr: 350,
      pricePaise: 35000,
      sizeLabel: "250 g",
      category: "Functional Food",
      imageUrl: "/products/magic-food-taxo.png",
      images: ["/products/magic-food-taxo.png"],
      sku: "CB-FLAGSHIP-TAXO-250G",
      stockQty: 50,
      featured: true,
      active: true,
      patentId: magicPatent?.id ?? null
    }
  });

  console.log(`[seed] Amazon + flagship products ready (${raw.length + 1} catalog rows)`);
}

async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || "cashmirbiotech@gmail.com").toLowerCase().trim();
  const password = process.env.ADMIN_RESET_PASSWORD;
  const pepper = process.env.PASSWORD_PEPPER;
  if (!password || password.length < 10) {
    throw new Error("ADMIN_RESET_PASSWORD is required (min 10 characters).");
  }
  if (!pepper || pepper.length < 32) {
    throw new Error("PASSWORD_PEPPER must match Amplify env (≥32 chars).");
  }

  const peppered = createHmac("sha256", pepper).update(password).digest("hex");
  const passwordHash = hashSync(peppered, 12);

  const user = await prisma.adminUser.upsert({
    where: { email },
    update: {
      passwordHash,
      active: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      isTwoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorExpires: null,
      role: "owner",
      name: "Owner"
    },
    create: {
      email,
      passwordHash,
      name: "Owner",
      role: "owner",
      isTwoFactorEnabled: false
    }
  });

  // Retire old bootstrap admin if still present under a different address
  if (email !== "admin@cashmirbiotech.com") {
    await prisma.adminUser.updateMany({
      where: { email: "admin@cashmirbiotech.com" },
      data: { active: false }
    });
  }

  console.log(`[seed] Admin ready: ${user.email} (role: ${user.role})`);
}

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!dbUrl) throw new Error("DATABASE_URL is required");
  if (looksLikeProductionDatabase(dbUrl) && process.env.ALLOW_PROD_SEED !== "yes") {
    throw new Error("Refusing production-like DB. Set ALLOW_PROD_SEED=yes to continue.");
  }

  console.log("[seed] Starting Amplify catalog seed (no orders)…");
  await seedSiteSettings();
  await seedPatents();
  await seedTeam();
  await seedAmazonProducts();
  await seedAdmin();

  const counts = {
    patents: await prisma.patent.count(),
    products: await prisma.product.count(),
    team: await prisma.teamMember.count(),
    admins: await prisma.adminUser.count({ where: { active: true } }),
    orders: await prisma.order.count()
  };
  console.log("[seed] Done.", counts);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
