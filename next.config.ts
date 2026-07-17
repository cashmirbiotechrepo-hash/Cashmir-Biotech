import type { NextConfig } from "next";
import path from "node:path";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /** Pino / thread-stream must not be bundled into vendor-chunks with broken worker paths */
  serverExternalPackages: ["pino", "thread-stream"],
  outputFileTracingRoot: path.join(process.cwd(), "./"),
  experimental: {
    // Avoid Next 15.5.x minify plugin crash on some Linux CI hosts.
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

// Amplify Hosting sets these. Skip Sentry's webpack injection there — it pulls a
// separate webpack copy that clashes with Next's bundled webpack
// ("WebpackError is not a constructor" / FlightClientEntryPlugin crashes).
const isAmplifyBuild = Boolean(
  process.env.AMPLIFY_NEXT_PLAIN_CONFIG ||
    process.env.AWS_APP_ID ||
    process.env.AWS_BRANCH ||
    process.env.AWS_EXECUTION_ENV
);

const hasSentryAuth = Boolean(process.env.SENTRY_AUTH_TOKEN);

const config = isAmplifyBuild
  ? nextConfig
  : withSentryConfig(nextConfig, {
      silent: true,
      telemetry: false,
      webpack: {
        disableSentryConfig: !hasSentryAuth
      },
      sourcemaps: {
        disable: !hasSentryAuth
      },
      widenClientFileUpload: false
    });

export default config;
