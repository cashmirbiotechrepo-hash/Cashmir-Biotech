import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-headline" });
const inter = Inter({ subsets: ["latin"], variable: "--font-body" });

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
      <body className={`${spaceGrotesk.variable} ${inter.variable} font-sans`}>
        {/* The public UI is designed dark-only; system light mode produced unreadable pages. */}
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
