/**
 * Names and endpoints. Duplicated from @tokenwell/core rather than imported so
 * the published CLI stays a single dependency-light package — `npx tokenwell`
 * should download in a second.
 */
export const BRAND = {
  name: "Tokenwell",
  cli: "tokenwell",
  mcpServerKey: "tokenwell",
  rulesMarker: "tokenwell",
  projectConfigFile: ".tokenwell.json",
} as const;

export const API_BASE =
  process.env.TOKENWELL_API_BASE ?? "https://api.tokenwell.design";

export const MCP_URL = `${API_BASE}/mcp`;
