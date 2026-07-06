import { Header2 } from "@/components/ui/header-2";
import { Footer } from "@/components/ui/footer";
import { PremiumHome } from "@/components/home/premium-home";
import { getPublicHomeContent, type PublicHomeData } from "@/modules/cms/services/content.service";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Render the homepage with sensible defaults even if the database is unreachable.
  let data: PublicHomeData = { settings: null, products: [], patents: [] };
  try {
    data = await getPublicHomeContent();
  } catch (error) {
    logger.error({ event: "home_content_fetch_failed", err: error }, "falling back to default homepage content");
  }
  const { settings, products, patents } = data;

  const preparedSettings = {
    heroTitle: settings?.heroTitle ?? "The architecture of daily vitality",
    heroDescription:
      settings?.heroDescription ??
      "Premium supplements with scientific discipline, patent-backed innovation, and research-grade manufacturing standards.",
    heroSubtitle: settings?.heroSubtitle ?? "Proven biotech innovation from Kashmir biodiversity",
    ctaPrimaryText: settings?.ctaPrimaryText ?? "Explore Catalog",
    ctaPrimaryHref: settings?.ctaPrimaryHref ?? "/products",
    ctaSecondaryText: settings?.ctaSecondaryText ?? "View Patents",
    ctaSecondaryHref: settings?.ctaSecondaryHref ?? "/patents"
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <Header2 />
      <div id="main-content">
        <PremiumHome settings={preparedSettings} products={products} patents={patents} />
      </div>
      <Footer />
    </div>
  );
}
