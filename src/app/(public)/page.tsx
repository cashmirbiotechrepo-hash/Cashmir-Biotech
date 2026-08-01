import { getPublicHomeContent } from "@/modules/cms/services/content.service";
import { buildHomeContent } from "@/components/home/content";
import { HomeExperience } from "@/components/home/home-experience";
import { logger } from "@/lib/logger";

// Statically rendered and revalidated hourly; CMS edits appear within the window.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata() {
  return {
    title: "Cashmir Biotech — Innovative Nutraceuticals & Precision Biology",
    description: "Discover Cashmir Biotech's high-quality nutraceuticals and functional foods developed from Himalayan biodiversity. Specializing in prostate health, gout, and iron supplementation.",
    alternates: {
      canonical: process.env.NEXT_PUBLIC_SITE_URL ?? "https://cashmirbiotech.com",
    }
  };
}

export default async function HomePage() {
  let data = null;
  try {
    data = await getPublicHomeContent();
  } catch (error) {
    logger.error({ err: error }, "Failed to load homepage content; using fallback");
  }

  const content = buildHomeContent(data);
  return <HomeExperience content={content} />;
}
