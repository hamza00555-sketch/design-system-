#!/usr/bin/env node
/**
 * A local stand-in for the Cloud Function, backed by memory.
 *
 * Firestore's emulator needs Java and a project id; for working on the CLI or
 * an agent integration you only need the two endpoints to answer honestly.
 * Same handlers, same wire contract — just a Map instead of a database.
 *
 *   node scripts/dev-server.mjs [port]
 */
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { countTokens, diffSystems } from "../packages/core/dist/index.js";
import { clearGlass } from "../packages/core/dist/fixtures/clearGlass.js";
import { handleMcpHttp } from "../packages/mcp/dist/index.js";

const PORT = Number(process.argv[2] ?? 8787);
const SEED_CODE = process.env.SEED_CODE ?? "DEV1-2345";

const teams = new Map([["t1", { plan: process.env.PLAN === "pro" ? "pro" : "free", name: "Dev team" }]]);
const projects = new Map();
const keys = new Map();
const codes = new Map([[SEED_CODE.replace(/[^A-Z0-9]/gi, "").toUpperCase(), { teamId: "t1", systemId: "s1" }]]);
const versions = [];
let currentVersionId = null;

const hash = (key) => createHash("sha256").update(key.trim()).digest("hex");

const store = {
  async resolveKey(key) {
    const projectId = keys.get(hash(key));
    if (!projectId) return null;
    const project = projects.get(projectId);
    return {
      projectId,
      teamId: project.teamId,
      systemId: project.systemId,
      projectName: project.name,
      plan: teams.get(project.teamId).plan,
    };
  },
  async getCurrent() {
    return versions.find((v) => v.versionId === currentVersionId) ?? null;
  },
  async listVersions(_ctx, limit) {
    return [...versions].reverse().slice(0, limit).map(({ system, ...ref }) => ref);
  },
  async getVersion(_ctx, versionId) {
    return versions.find((v) => v.versionId === versionId) ?? null;
  },
  async pushVersion(_ctx, system, diff) {
    const n = versions.length + 1;
    const stored = {
      versionId: `v${n}`,
      n,
      createdAt: new Date().toISOString(),
      source: system.meta.source,
      summary: diff.summary,
      tokenCount: countTokens(system),
      system,
    };
    versions.push(stored);
    currentVersionId = stored.versionId;
    return stored;
  },
  async restoreVersion(ctx, versionId) {
    const target = versions.find((v) => v.versionId === versionId);
    const current = await store.getCurrent();
    return store.pushVersion(ctx, target.system, diffSystems(current?.system ?? null, target.system));
  },
  async recordVerification(_ctx, result) {
    console.log(`  ${result.receipt}`);
  },
  async touchProject() {},
};

if (process.env.SEED_SYSTEM !== "0") {
  await store.pushVersion(null, clearGlass, diffSystems(null, clearGlass));
}

const json = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

createServer((req, res) => {
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", async () => {
    const raw = Buffer.concat(chunks).toString("utf8");
    req.body = raw ? JSON.parse(raw) : undefined;
    const path = new URL(req.url, "http://localhost").pathname.replace(/\/+$/, "") || "/";
    console.log(`${req.method} ${path}`);

    if (path === "/mcp") return void handleMcpHttp(req, res, store);

    if (path === "/api/cli/connect") {
      const code = String(req.body?.code ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
      const entry = codes.get(code);
      if (!entry) {
        return json(res, 401, {
          error: "Unknown connect code. Mint a fresh one from the dashboard.",
          code: "invalid_token",
        });
      }
      if (entry.usedAt) {
        return json(res, 401, { error: "That connect code has already been used.", code: "expired" });
      }
      const team = teams.get(entry.teamId);
      const owned = [...projects.values()].filter((p) => p.teamId === entry.teamId);
      if (team.plan === "free" && owned.length >= 1) {
        return json(res, 403, {
          error: "The free plan covers one project. Upgrade to connect this repo as well.",
          code: "upgrade_required",
        });
      }
      const apiKey = `tw_live_${randomBytes(32).toString("base64url")}`;
      const projectId = `p${projects.size + 1}`;
      projects.set(projectId, {
        teamId: entry.teamId,
        systemId: entry.systemId,
        name: req.body?.projectName ?? "project",
        repoName: req.body?.repoName ?? null,
      });
      keys.set(hash(apiKey), projectId);
      entry.usedAt = Date.now();
      return json(res, 201, { projectId, apiKey });
    }

    if (path === "/api/health") return json(res, 200, { ok: true, service: "tokenwell" });
    return json(res, 404, { error: "Not found.", code: "bad_request" });
  });
}).listen(PORT, () => {
  console.log(`tokenwell dev server → http://localhost:${PORT}`);
  console.log(`connect code: ${SEED_CODE}`);
  console.log(`seeded system: ${versions.at(-1)?.system.meta.name ?? "none"}\n`);
});
