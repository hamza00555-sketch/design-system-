import createMiddleware from "next-intl/middleware";

// Next 16 renamed the middleware convention to "proxy"; next-intl still ships
// the handler under its original name.
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Everything except Next internals, files with an extension, and the API —
  // including /mcp, which is the API under another name. Locale-prefixing it
  // would redirect every agent's MCP call to /en/mcp.
  //
  // /__/auth is Firebase's sign-in handler, proxied here so it shares this
  // origin. Prefixing it to /en/__/auth would break the very redirect that
  // proxy exists to keep working.
  matcher: "/((?!api|mcp|__|_next|_vercel|.*\\..*).*)",
};
