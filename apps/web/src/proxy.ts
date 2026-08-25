import createMiddleware from "next-intl/middleware";

// Next 16 renamed the middleware convention to "proxy"; next-intl still ships
// the handler under its original name.
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Everything except Next internals and files with an extension.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
