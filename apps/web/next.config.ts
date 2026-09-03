import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // This repo keeps its agent rules at the root, written by `miswadah init`.
  agentRules: false,
  transpilePackages: ["@miswadah/core"],
  serverExternalPackages: ["firebase-admin", "stripe"],

  async rewrites() {
    // The CLI writes "<API base>/mcp" into .mcp.json, and agents talk to that
    // exact URL. On Vercel every route lives under /api, so /mcp is mapped
    // rather than the CLI being taught two shapes of the same address.
    return [{ source: "/mcp", destination: "/api/mcp" }];
  },
};

export default withNextIntl(nextConfig);
