import { getPublicHomeContent } from "@/modules/cms/services/content.service";
import { buildHomeContent } from "@/components/home/content";
import { HomeExperience } from "@/components/home/home-experience";
import { logger } from "@/lib/logger";

// Statically rendered and revalidated hourly; CMS edits appear within the window.
export const revalidate = 60;

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
