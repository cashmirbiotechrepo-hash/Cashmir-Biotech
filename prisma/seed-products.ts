import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding SEO products...");

  const magicFood = await prisma.product.upsert({
    where: { slug: "magicfood-250g" },
    update: {},
    create: {
      slug: "magicfood-250g",
      name: "Magic Food Supplement",
      shortBenefit: "Premium functional food powder designed to support overall wellness and energy.",
      description: "A specially formulated 250g functional food powder leveraging Himalayan biodiversity. Incubated at SKUAST-K and backed by extensive research, Magic Food Supplement is designed to naturally enhance vitality and wellness.",
      mrpInr: 1200,
      pricePaise: 99900, // 999 INR
      sizeLabel: "250g Powder",
      category: "Functional Foods",
      imageUrl: "/icon.png", // fallback image
      sku: "MF-250G",
      stockQty: 50,
      hasInventoryTracking: true,
      featured: true,
      specs: {
        brand: "Cashmir Biotech",
        form: "Powder",
        specialIngredients: "Himalayan Herbal Extracts"
      }
    }
  });
  console.log(`Created product: ${magicFood.name}`);

  const ironRevive = await prisma.product.upsert({
    where: { slug: "iron-revive-herbal" },
    update: {},
    create: {
      slug: "iron-revive-herbal",
      name: "IronReviveHerbal Tablets",
      shortBenefit: "Advanced iron supplementation for improved hemoglobin and vitality.",
      description: "IronReviveHerbal is a targeted iron supplement leveraging unique plant-based isolates from the Kashmir valley. Designed for superior absorption and minimal gastrointestinal distress. Developed with insights from SKUAST-K research.",
      mrpInr: 850,
      pricePaise: 75000,
      sizeLabel: "60 Tablets",
      category: "Supplements",
      imageUrl: "/icon.png",
      sku: "IR-60T",
      stockQty: 100,
      hasInventoryTracking: true,
      featured: true,
      specs: {
        brand: "Cashmir Biotech",
        form: "Tablets",
        specialIngredients: "Bioavailable Iron Isolate"
      }
    }
  });
  console.log(`Created product: ${ironRevive.name}`);

  const zincMag = await prisma.product.upsert({
    where: { slug: "zinc-mag-natural" },
    update: {},
    create: {
      slug: "zinc-mag-natural",
      name: "ZincMagNatural",
      shortBenefit: "Targeted support for prostate health and uric acid management.",
      description: "Formulated specifically for proactive prostate health and gout/uric acid management. ZincMagNatural combines essential minerals with patented Himalayan bioactives to support optimal physiological function.",
      mrpInr: 1500,
      pricePaise: 125000,
      sizeLabel: "90 Capsules",
      category: "Targeted Therapeutics",
      imageUrl: "/icon.png",
      sku: "ZMN-90C",
      stockQty: 30,
      hasInventoryTracking: true,
      featured: true,
      specs: {
        brand: "Cashmir Biotech",
        form: "Capsules",
        specialIngredients: "Zinc, Magnesium, Himalayan Botanical Extracts"
      }
    }
  });
  console.log(`Created product: ${zincMag.name}`);

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
