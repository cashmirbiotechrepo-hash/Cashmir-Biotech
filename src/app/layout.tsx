import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Inter, Space_Mono } from "next/font/google";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme";
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
    "Cashmir Biotech Private Limited — an innovative biotechnology startup based in Srinagar, Jammu & Kashmir. Incubated at SKUAST-K and funded by IIT Kanpur. Specializing in high-quality nutraceuticals, functional foods, prostate health, gout management, and iron supplementation.",
  keywords: [
    "biotech",
    "Cashmir Biotech",
    "Srinagar",
    "Jammu and Kashmir",
    "SKUAST-K",
    "IIT Kanpur",
    "nutraceuticals",
    "functional foods",
    "prostate health",
    "gout management",
    "iron supplementation",
    "MagicFood",
    "ZincMagNatural",
    "IronReviveHerbal",
    "precision medicine"
  ],
  applicationName: "Cashmir Biotech",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" }
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "Cashmir Biotech — Precision Biology from the Himalaya",
    description:
      "Innovative biotechnology startup from Srinagar, Jammu & Kashmir. Developing high-quality nutraceuticals and functional foods backed by SKUAST-K and IIT Kanpur.",
    url: siteUrl,
    siteName: "Cashmir Biotech",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Cashmir Biotech — Precision Biology from the Himalaya",
    description: "Innovative biotechnology startup developing high-quality nutraceuticals and functional foods."
  }
};

const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "MedicalOrganization",
  "name": "Cashmir Biotech Private Limited",
  "url": siteUrl,
  "logo": `${siteUrl}/logo.png`,
  "foundingDate": "2022-09-19",
  "description": "An innovative biotechnology startup based in Srinagar, Jammu and Kashmir, specializing in nutraceuticals and functional foods.",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Srinagar",
    "addressRegion": "Jammu and Kashmir",
    "addressCountry": "IN"
  },
  "parentOrganization": {
    "@type": "Organization",
    "name": "Sher-e-Kashmir University of Agricultural Sciences and Technology of Kashmir (SKUAST-K)"
  },
  "funder": {
    "@type": "Organization",
    "name": "IIT Kanpur"
  }
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0d" }
  ],
  colorScheme: "light dark"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Browsers strip `nonce` from the DOM after CSP applies, so React
          always sees a client/server attribute mismatch here — suppress it.
        */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }}
        />
        <script
          type="application/ld+json"
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
      </head>
      <body className={`${inter.variable} ${spaceMono.variable} font-sans antialiased`} data-nonce={nonce}>
        {children}
      </body>
    </html>
  );
}
