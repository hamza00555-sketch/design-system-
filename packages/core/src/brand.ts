/**
 * Every user-visible name lives here so the product can be renamed in one edit.
 */
export const BRAND = {
  /** Product name as shown to people. */
  name: "Miswadah",
  /** npm package + CLI binary name. */
  cli: "miswadah",
  /** MCP server key written into .mcp.json. */
  mcpServerKey: "miswadah",
  /** Marker used to fence the agent rules block in CLAUDE.md / AGENTS.md. */
  rulesMarker: "miswadah",
  /** Local, key-free project config file written by `init`. */
  projectConfigFile: ".miswadah.json",
  /** Prefix on issued project API keys. */
  keyPrefix: "ms_live_",
} as const;
