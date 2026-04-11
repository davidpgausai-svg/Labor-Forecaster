import type { NextConfig } from "next";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "/bpai";

const devOrigins: string[] = [];
if (process.env.REPLIT_DEV_DOMAIN) devOrigins.push(process.env.REPLIT_DEV_DOMAIN);
devOrigins.push("*.replit.dev", "*.picard.replit.dev", "*.repl.co");

const nextConfig: NextConfig = {
  basePath: BASE_PATH,
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  experimental: {
    serverActions: { bodySizeLimit: "25mb" },
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: BASE_PATH,
  },
  allowedDevOrigins: devOrigins,
};

export default nextConfig;
