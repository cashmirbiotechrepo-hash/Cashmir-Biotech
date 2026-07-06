import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.siteSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      companyName: "Cashmir Biotech",
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

  await prisma.product.createMany({
    data: [
      {
        slug: "magic-food-taxo-80g",
        name: "Magic Food TaxO",
        shortBenefit: "Promotes prostate health",
        description:
          "Flagship functional food containing TaxO molecule from underutilized Kashmiri plants.",
        mrpInr: 350,
        sizeLabel: "80g",
        category: "Functional Food",
        imageUrl:
          "https://images.unsplash.com/photo-1622484212850-eb596d769edc?auto=format&fit=crop&w=1200&q=80",
        featured: true
      },
      {
        slug: "iron-revive-herbal-200",
        name: "Iron Revive Herbal",
        shortBenefit: "Herbal iron supplement",
        description:
          "Daily iron support formulation engineered for high absorption and gentle digestion.",
        mrpInr: 500,
        sizeLabel: "200 count",
        category: "Supplement",
        imageUrl:
          "https://images.unsplash.com/photo-1610725664285-7c57e6eeac3f?auto=format&fit=crop&w=1200&q=80"
      }
    ],
    skipDuplicates: true
  });

  await prisma.patent.createMany({
    data: [
      {
        patentCode: "IN-CBT-2024-001",
        title: "TaxO Enriched Functional Food Composition",
        summary:
          "Composition and extraction protocol for anti-cancer functional foods from Kashmiri flora.",
        status: "Granted",
        jurisdiction: "India",
        publishedAt: new Date("2024-05-10")
      }
    ],
    skipDuplicates: true
  });

  await prisma.teamMember.createMany({
    data: [
      {
        fullName: "Dr. Khalid Zaffar Masoodi",
        role: "Director and Founder",
        bio: "Associate Professor and Senior Scientist, leading scientific direction and product innovation.",
        avatarUrl:
          "https://images.unsplash.com/photo-1612276529731-4b21494e6d71?auto=format&fit=crop&w=800&q=80",
        sortOrder: 1
      },
      {
        fullName: "Aqib Ahmad Hurra",
        role: "Director",
        bio: "Co-founder driving strategic operations and faculty-student innovation model.",
        avatarUrl:
          "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=800&q=80",
        sortOrder: 2
      }
    ],
    skipDuplicates: true
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
