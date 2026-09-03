import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clearGlass } from "@miswadah/core/fixtures/clearGlass";
import { handleMcpHttp } from "../src/server.js";
import { MemoryStore } from "./memoryStore.js";

const store = new MemoryStore();
let server: Server;
let base: string;

beforeAll(async () => {
  await store.pushVersion(
    { projectId: "p1", teamId: "t1", systemId: "s1", projectName: "acme-web", plan: "free" },
    clearGlass,
    { added: [], removed: [], changed: [], identical: false, summary: "first" },
  );

  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      (req as any).body = raw ? JSON.parse(raw) : undefined;
      void handleMcpHttp(req as any, res as any, store);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

afterAll(() => {
  server.close();
});

async function rpc(method: string, params: unknown, key = "ms_live_test") {
  const res = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(key ? { authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

describe("auth", () => {
  it("refuses a request with no key, in the documented shape", async () => {
    const res = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: "Missing Bearer project key.",
      code: "invalid_token",
    });
  });

  it("refuses an unknown key", async () => {
    const { status, body } = await rpc("tools/list", {}, "ms_live_nope");
    expect(status).toBe(401);
    expect(body.code).toBe("invalid_token");
  });
});

describe("protocol", () => {
  it("initializes", async () => {
    const { body } = await rpc("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test", version: "1.0.0" },
    });
    expect(body.result.serverInfo.name).toBe("miswadah");
  });

  it("lists the tools an agent needs", async () => {
    const { body } = await rpc("tools/list", {});
    const names = body.result.tools.map((t: { name: string }) => t.name).sort();
    expect(names).toEqual([
      "export_design_system",
      "get_design_system",
      "list_versions",
      "push_design_system",
      "restore_version",
      "verify",
    ]);
  });

  it("describes verify's input so the agent can call it unprompted", async () => {
    const { body } = await rpc("tools/list", {});
    const verify = body.result.tools.find((t: { name: string }) => t.name === "verify");
    expect(verify.inputSchema.properties.files).toBeDefined();
    expect(verify.inputSchema.required).toContain("files");
  });

  it("serves the design system", async () => {
    const { body } = await rpc("tools/call", { name: "get_design_system", arguments: {} });
    expect(body.result.content[0].text).toContain("primary=#2f6bff");
  });

  it("verifies a file and reports the off-brand value", async () => {
    const { body } = await rpc("tools/call", {
      name: "verify",
      arguments: { files: [{ path: "a.css", content: ".a { color: #3D7BF2; }" }] },
    });
    expect(body.result.content[0].text).toContain("use color.primary");
  });
});
