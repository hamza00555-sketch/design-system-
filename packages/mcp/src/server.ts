import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { BRAND, DesignSystemSchema } from "@miswadah/core";
import { z } from "zod";
import type { ProjectContext, Store } from "./store.js";
import {
  addScreen,
  exportSystem,
  getDesignSystem,
  getScreen,
  listVersions,
  pushDesignSystem,
  restoreVersion,
  screenContent,
  verifyFiles,
} from "./tools.js";

const text = (body: string) => ({ content: [{ type: "text" as const, text: body }] });

/** Build a server instance bound to one project. Stateless: one per request. */
export function createMcpServer(store: Store, ctx: ProjectContext): McpServer {
  const server = new McpServer(
    { name: BRAND.cli, version: "0.1.0" },
    {
      instructions:
        `Design system for ${ctx.projectName}. Call get_design_system before any ` +
        `visual work, and verify after every UI edit.`,
    },
  );

  server.registerTool(
    "get_design_system",
    {
      title: "Get design system",
      description:
        "The canonical design system for this project — tokens, components, and " +
        "rules, rendered for generation. Call this before writing or editing any " +
        "UI: components, pages, styles, or markup with classes.",
      inputSchema: {},
    },
    async () => {
      // Words and pictures in one answer: the agent should not have to ask
      // twice to know both what the values are and what they look like.
      const body = await getDesignSystem(store, ctx);
      const images = await screenContent(store, ctx);
      return { content: [{ type: "text" as const, text: body }, ...images] };
    },
  );

  server.registerTool(
    "verify",
    {
      title: "Verify against the design system",
      description:
        "Check written files against the design system. Colours must be within " +
        "ΔE 2 of a token; spacing, type, and radii must land exactly on their " +
        "scales. Returns every off-brand value with the token to use instead. " +
        "Call this immediately after writing or editing any UI file.",
      inputSchema: {
        files: z
          .array(
            z.object({
              path: z.string().describe("Path of the file, as written on disk."),
              content: z.string().describe("Full content of the file after your edit."),
            }),
          )
          .min(1)
          .describe("Every file you touched in this edit."),
      },
    },
    async ({ files }) => text(await verifyFiles(store, ctx, files)),
  );

  server.registerTool(
    "push_design_system",
    {
      title: "Push a new design-system version",
      description:
        "Replace the canonical design system with a newly extracted one. Every " +
        "push is a new version with full history — nothing is overwritten. Use " +
        "this after reading the project's shipped styling, or when the brand moves.",
      inputSchema: { system: DesignSystemSchema },
    },
    async ({ system }) => text(await pushDesignSystem(store, ctx, system)),
  );

  server.registerTool(
    "add_screen",
    {
      title: "Attach a screenshot of the product",
      description:
        "Store a screenshot of the real product so future generations can see " +
        "it, not only read its token values. Run the app and capture every " +
        "page it has — one call per page, named after its route — not just the " +
        "prettiest few. PNG, JPEG, or WebP, up to 250 KB each and 40 in all; " +
        "around 1200px wide is plenty.",
      inputSchema: {
        name: z
          .string()
          .describe(
            'The route this shows: "dashboard", "settings-members". Reusing a ' +
              "name replaces that screen rather than adding another.",
          ),
        description: z.string().optional().describe("One line on what it shows."),
        data: z.string().describe("The image, base64 encoded."),
        mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
      },
    },
    async ({ name, description, data, mimeType }) =>
      text(await addScreen(store, ctx, { name, description, data, mimeType })),
  );

  server.registerTool(
    "get_screen",
    {
      title: "Look at one screen of the product",
      description:
        "Fetch a single screenshot by name. get_design_system attaches only the " +
        "first few; use this to see any of the others it listed.",
      inputSchema: {
        name: z.string().describe('The screen name, as listed: "settings-members".'),
      },
    },
    async ({ name }) => {
      const result = await getScreen(store, ctx, name);
      return {
        content: [
          { type: "text" as const, text: result.text },
          ...(result.image
            ? [
                {
                  type: "image" as const,
                  data: result.image.data,
                  mimeType: result.image.mimeType,
                },
              ]
            : []),
        ],
      };
    },
  );

  server.registerTool(
    "list_versions",
    {
      title: "List design-system versions",
      description: "Version history for this project's design system, newest first.",
      inputSchema: {},
    },
    async () => text(await listVersions(store, ctx)),
  );

  server.registerTool(
    "restore_version",
    {
      title: "Restore a design-system version",
      description:
        "Restore an earlier version as the current one. Appends a new version " +
        "rather than deleting anything.",
      inputSchema: { versionId: z.string().describe("Version id from list_versions.") },
    },
    async ({ versionId }) => text(await restoreVersion(store, ctx, versionId)),
  );

  server.registerTool(
    "export_design_system",
    {
      title: "Export the design system",
      description:
        "Export the current system as a DESIGN.md file, W3C design-tokens " +
        "JSON, or a style prompt — one self-contained block of text that " +
        "reproduces this style in any agent, with nothing else attached. " +
        "Available on every plan, always.",
      inputSchema: {
        format: z.enum(["design-md", "tokens-json", "style-prompt"]).default("design-md"),
      },
    },
    async ({ format }) => text(await exportSystem(store, ctx, format ?? "design-md")),
  );

  return server;
}

/** Minimal shape of the request/response pair, so this works on any Node host. */
export interface HttpRequestLike {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  on(event: string, listener: (...args: any[]) => void): unknown;
}

export interface HttpResponseLike {
  writeHead(status: number, headers?: Record<string, string>): unknown;
  end(body?: string): unknown;
  on(event: string, listener: (...args: any[]) => void): unknown;
}

export function bearerFrom(headers: HttpRequestLike["headers"]): string | null {
  const raw = headers["authorization"] ?? headers["Authorization"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  return match?.[1]?.trim() || null;
}

function deny(res: HttpResponseLike, status: number, error: string, code: string): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error, code }));
}

/**
 * Handle one MCP request over Streamable HTTP.
 *
 * Stateless by design: a fresh server and transport per request, which is what
 * a serverless function can actually guarantee.
 */
export async function handleMcpHttp(
  req: HttpRequestLike,
  res: HttpResponseLike,
  store: Store,
): Promise<void> {
  const key = bearerFrom(req.headers);
  if (!key) {
    deny(res, 401, "Missing Bearer project key.", "invalid_token");
    return;
  }

  const ctx = await store.resolveKey(key);
  if (!ctx) {
    deny(
      res,
      401,
      "Unknown project key. Re-run init in this repo to reconnect it.",
      "invalid_token",
    );
    return;
  }

  const server = createMcpServer(store, ctx);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    // One JSON response per request — a serverless function has nowhere to keep
    // an open SSE stream between invocations.
    enableJsonResponse: true,
  });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req as never, res as never, req.body);
}
