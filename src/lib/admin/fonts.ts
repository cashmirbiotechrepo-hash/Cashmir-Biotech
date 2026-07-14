import { Geist } from "next/font/google";

/**
 * Dedicated admin console typeface.
 *
 * The public marketing site keeps its own fonts untouched. The admin panel and
 * login page use this crisp, neutral UI font (matching the Admin Panel Template
 * reference) via the `--font-admin` CSS variable + the `font-admin` utility.
 */
export const adminFont = Geist({
  subsets: ["latin"],
  variable: "--font-admin",
  display: "swap",
});
