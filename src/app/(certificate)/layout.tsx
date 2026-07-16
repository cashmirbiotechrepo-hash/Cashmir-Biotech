import type { Metadata } from "next";
import { IBM_Plex_Sans, Newsreader } from "next/font/google";
import "./certificate.css";

const display = Newsreader({
  subsets: ["latin"],
  variable: "--cert-display",
  display: "swap",
  weight: ["400", "500", "600", "700"]
});

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--cert-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"]
});

export const metadata: Metadata = {
  title: "Computational Biology Short Courses · SKUAST-K",
  description: "SKUAST-K Continuing Education Cell — Computational Biology short-course enrolment.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } }
};

export default function CertificateLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${display.variable} ${sans.variable} cert-root min-h-screen`}>
      {children}
    </div>
  );
}
