/**
 * Every user-visible name lives here so the product can be renamed in one edit.
 */
export const BRAND = {
  /** Product name as shown to people. */
  name: "Tokenwell",
  /** npm package + CLI binary name. */
  cli: "tokenwell",
  /** MCP server key written into .mcp.json. */
  mcpServerKey: "tokenwell",
  /** Marker used to fence the agent rules block in CLAUDE.md / AGENTS.md. */
  rulesMarker: "tokenwell",
  /** Local, key-free project config file written by `init`. */
  projectConfigFile: ".tokenwell.json",
  /** Prefix on issued project API keys. */
  keyPrefix: "tw_live_",
} as const;
