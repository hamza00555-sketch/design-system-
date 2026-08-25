import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // This repo keeps its agent rules at the root, written by `tokenwell init`.
  agentRules: false,
  transpilePackages: ["@tokenwell/core"],
};

export default withNextIntl(nextConfig);
