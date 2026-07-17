import type { NextConfig } from "next";
import path from "node:path";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /** Pino / thread-stream must not be bundled into vendor-chunks with broken worker paths */
  serverExternalPackages: ["pino", "thread-stream"],
  outputFileTracingRoot: path.join(process.cwd(), "./"),
  experimental: {
    // Workaround for Next 15.5.x Amplify/Linux crash:
    // HookWebpackError: WebpackError is not a constructor (minify-webpack-plugin)
    serverMinification: false,
    optimizePackageImports: ["lucide-react", "framer-motion", "@radix-ui/react-icons", "@radix-ui/react-popover"]
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" }
    ]
  }
};

const hasSentryAuth = Boolean(process.env.SENTRY_AUTH_TOKEN);

export default withSentryConfig(nextConfig, {
  silent: true,
  telemetry: false,
  // Avoid injecting a second webpack toolchain on Amplify builds without Sentry upload auth.
  webpack: {
    disableSentryConfig: !hasSentryAuth
  },
  sourcemaps: {
    disable: !hasSentryAuth
  },
  widenClientFileUpload: false
});
