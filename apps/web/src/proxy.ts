import createMiddleware from "next-intl/middleware";

// Next 16 renamed the middleware convention to "proxy"; next-intl still ships
// the handler under its original name.
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Everything except Next internals, files with an extension, and the API —
  // including /mcp, which is the API under another name. Locale-prefixing it
  // would redirect every agent's MCP call to /en/mcp.
  matcher: "/((?!api|mcp|_next|_vercel|.*\\..*).*)",
};
