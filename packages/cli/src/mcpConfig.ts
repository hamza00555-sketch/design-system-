import { BRAND, MCP_URL } from "./config.js";

/**
 * Add our server to an MCP config without disturbing the others.
 *
 * Throws rather than overwriting when the file is not what we expect — a
 * broken .mcp.json is the user's to fix, and silently replacing it would take
 * every other server down with it.
 */
export function mergedMcpConfig(existing: string | null, apiKey: string, label: string): string {
  let config: Record<string, unknown> = {};

  if (existing && existing.trim() !== "") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(existing);
    } catch {
      throw new Error(`${label} exists but is not valid JSON — fix or remove it, then re-run init.`);
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error(`${label} must contain a JSON object — fix or remove it, then re-run init.`);
    }
    config = parsed as Record<string, unknown>;
  }

  const servers = (config.mcpServers as Record<string, unknown> | undefined) ?? {};
  servers[BRAND.mcpServerKey] = {
    type: "http",
    url: MCP_URL,
    headers: { Authorization: `Bearer ${apiKey}` },
  };
  config.mcpServers = servers;

  return `${JSON.stringify(config, null, 2)}\n`;
}
