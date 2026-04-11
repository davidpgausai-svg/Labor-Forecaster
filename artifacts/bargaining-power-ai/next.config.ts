import type { NextConfig } from "next";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "/bpai";

const nextConfig: NextConfig = {
  basePath: BASE_PATH,
  experimental: {
    serverActions: { bodySizeLimit: "25mb" },
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: BASE_PATH,
  },
};

export default nextConfig;
