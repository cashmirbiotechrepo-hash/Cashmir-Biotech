import { Header2 } from "@/components/ui/header-2";
import { Footer } from "@/components/ui/footer";
import { PremiumHome } from "@/components/home/premium-home";
import { getPublicHomeContent } from "@/modules/cms/services/content.service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { settings, products, patents } = await getPublicHomeContent();

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
    <div suppressHydrationWarning className="min-h-screen bg-surface text-on-surface">
      <Header2 />
      <PremiumHome settings={preparedSettings} products={products} patents={patents} />
      <Footer />
    </div>
  );
}
