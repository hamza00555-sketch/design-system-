import type { ReactNode } from "react";
import "./globals.css";

/**
 * The real <html> lives in [locale]/layout, which knows the language and
 * direction. This root exists only because Next requires one.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
