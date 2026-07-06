import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Jost } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";

const bodoniModa = Bodoni_Moda({
  subsets: ["latin"],
  variable: "--font-headline",
  weight: ["400", "500", "600", "700"]
});
const jost = Jost({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["300", "400", "500", "600", "700"]
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://cashmirbiotech.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Cashmir Biotech",
    template: "%s"
  },
  description: "Precision biotech innovation and patented supplements.",
  openGraph: {
    title: "Cashmir Biotech",
    description: "Precision biotech innovation and patented supplements.",
    url: siteUrl,
    siteName: "Cashmir Biotech",
    type: "website"
  }
};

export const viewport: Viewport = {
  themeColor: "#0d0d0d",
  colorScheme: "dark"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${bodoniModa.variable} ${jost.variable} font-[family-name:var(--font-body)] antialiased`}>
        {/* The public UI is designed dark-only; system light mode produced unreadable pages. */}
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
