import type { Metadata, Viewport } from "next";
import { Inter, Space_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"]
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "700"]
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://cashmirbiotech.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Cashmir Biotech — Precision Biology from the Himalaya",
    template: "%s · Cashmir Biotech"
  },
  description:
    "Clinical-precision biotech formulations engineered from Himalayan biodiversity. Molecular research, patented actives, and evidence-led therapeutics.",
  keywords: [
    "biotech",
    "Himalayan biodiversity",
    "molecular research",
    "precision medicine",
    "Cashmir Biotech"
  ],
  openGraph: {
    title: "Cashmir Biotech — Precision Biology from the Himalaya",
    description:
      "Clinical-precision biotech formulations engineered from Himalayan biodiversity.",
    url: siteUrl,
    siteName: "Cashmir Biotech",
    type: "website"
  }
};

export const viewport: Viewport = {
  themeColor: "#fbfbf9",
  colorScheme: "light"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${spaceMono.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
