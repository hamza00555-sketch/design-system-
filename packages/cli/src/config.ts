/**
 * Names and endpoints. Duplicated from @miswadah/core rather than imported so
 * the published CLI stays a single dependency-light package — `npx miswadah`
 * should download in a second.
 */
export const BRAND = {
  name: "Miswadah",
  cli: "miswadah",
  mcpServerKey: "miswadah",
  rulesMarker: "miswadah",
  projectConfigFile: ".miswadah.json",
} as const;

export const API_BASE =
  process.env.MISWADAH_API_BASE ?? "https://api.miswadah.design";

export const MCP_URL = `${API_BASE}/mcp`;
