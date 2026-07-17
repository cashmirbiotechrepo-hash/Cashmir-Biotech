import type { NextConfig } from "next";
import path from "node:path";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /** Pino / thread-stream must not be bundled into vendor-chunks with broken worker paths */
  serverExternalPackages: ["pino", "thread-stream"],
  outputFileTracingRoot: path.join(process.cwd(), "./"),
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "@radix-ui/react-icons", "@radix-ui/react-popover"]
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" }
    ]
  }
};

export default withSentryConfig(nextConfig, {
  silent: true,
  telemetry: false,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN
  },
  widenClientFileUpload: false
});
