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
    const routes = [{ source: "/mcp", destination: "/api/mcp" }];

    // Firebase's sign-in handler normally lives on <project>.firebaseapp.com,
    // a different site from this one. Safari and Chrome now partition storage
    // by top-level site, so the handler cannot read the state it just wrote
    // and sign-in dies with "missing initial state".
    //
    // Firebase's documented fix is to serve the handler from this domain and
    // forward it, transparently — a rewrite, never a redirect, or the browser
    // is back on the other site and nothing has changed. Paired with
    // NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN pointing here rather than at
    // firebaseapp.com.
    const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (project) {
      routes.push({
        source: "/__/auth/:path*",
        destination: `https://${project}.firebaseapp.com/__/auth/:path*`,
      });
    }

    return routes;
  },
};

export default withNextIntl(nextConfig);
