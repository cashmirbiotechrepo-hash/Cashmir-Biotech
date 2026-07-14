import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
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

  // Replace catalog with verified product imagery from Data.
  await prisma.product.deleteMany({});
  await prisma.product.createMany({
    data: [
      {
        slug: "magic-food-taxo-250g",
        name: "Magic Food TaxO",
        shortBenefit: "Nutritional herbal compound for daily vitality",
        description:
          "Flagship functional food containing the patented TaxO molecule — a nutritional herbal compound extract from underutilised Kashmiri flora. Contains nutrients, minerals and vitamins. 100% natural health supplement.",
        mrpInr: 350,
        sizeLabel: "250 g",
        category: "Functional Food",
        imageUrl: "/products/magic-food-taxo.png",
        featured: true,
        active: true
      }
    ]
  });

  await prisma.patent.deleteMany({});
  await prisma.patent.createMany({
    data: [
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
    ]
  });

  await prisma.teamMember.deleteMany({});
  await prisma.teamMember.createMany({
    data: [
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
    ]
  });
}

async function seedAdminUser() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  if (!email || !passwordHash) {
    console.warn("[seed] ADMIN_EMAIL / ADMIN_PASSWORD_HASH not set — skipping AdminUser seed.");
    return;
  }
  await prisma.adminUser.upsert({
    where: { email },
    update: {
      passwordHash,
      active: true
    },
    create: {
      email,
      passwordHash,
      name: "Owner",
      role: "owner",
      isTwoFactorEnabled: false
    }
  });
  console.log(`[seed] Admin user ready: ${email}`);
}

main()
  .then(async () => {
    await seedAdminUser();
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
