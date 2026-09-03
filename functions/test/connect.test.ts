import type { Firestore } from "firebase-admin/firestore";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CONNECT_CODE_TTL_MS, redeemConnectCode } from "../src/connect.js";
import { generateConnectCode, generateProjectKey, hashKey, normalizeConnectCode } from "../src/keys.js";
import { FakeFirestore } from "./fakeFirestore.js";

const NOW = 1_800_000_000_000;
let fake: FakeFirestore;
let db: Firestore;

beforeEach(() => {
  fake = new FakeFirestore();
  db = fake as unknown as Firestore;
  fake.seedTeam("t1", "free");
  fake.seedCode("ABCD2345", { teamId: "t1", systemId: "s1", expiresAt: NOW + CONNECT_CODE_TTL_MS });
});

const connect = (code: string, now = NOW) =>
  redeemConnectCode(db, { code, projectName: "acme-web", repoName: "acme/web" }, now);

describe("redeeming a connect code", () => {
  it("registers the project and returns a key once", async () => {
    const result = await connect("ABCD2345");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.apiKey.startsWith("ms_live_")).toBe(true);
    expect(fake.data.get(`projects/${result.projectId}`)).toMatchObject({
      teamId: "t1",
      systemId: "s1",
      name: "acme-web",
      repoName: "acme/web",
    });
  });

  it("stores only the hash of the key", async () => {
    const result = await connect("ABCD2345");
    if (!result.ok) throw new Error("expected success");
    const stored = JSON.stringify([...fake.data.entries()]);
    expect(stored).not.toContain(result.apiKey);
    expect(fake.data.get(`projectKeys/${hashKey(result.apiKey)}`)).toMatchObject({
      projectId: result.projectId,
    });
  });

  it("accepts the code as it is printed, dashes and case included", async () => {
    const result = await connect("abcd-2345");
    expect(result.ok).toBe(true);
  });

  it("burns the code after one use", async () => {
    expect((await connect("ABCD2345")).ok).toBe(true);
    const second = await connect("ABCD2345");
    expect(second).toMatchObject({ ok: false, code: "expired" });
  });

  it("rejects an expired code", async () => {
    const late = await connect("ABCD2345", NOW + CONNECT_CODE_TTL_MS + 1);
    expect(late).toMatchObject({ ok: false, code: "expired", status: 401 });
  });

  it("rejects an unknown code", async () => {
    expect(await connect("ZZZZ9999")).toMatchObject({
      ok: false,
      code: "invalid_token",
      status: 401,
    });
  });

  it("rejects an empty code", async () => {
    expect(await connect("")).toMatchObject({ ok: false, code: "bad_request", status: 400 });
  });
});

describe("plan limits", () => {
  // Limits only exist when billing is on; the deployment default is open.
  beforeEach(() => {
    process.env.BILLING_ENABLED = "1";
  });
  afterEach(() => {
    delete process.env.BILLING_ENABLED;
  });

  it("stops a free team at its second project", async () => {
    fake.seedProject("p1", "t1");
    expect(await connect("ABCD2345")).toMatchObject({
      ok: false,
      code: "upgrade_required",
      status: 403,
    });
  });

  it("lets a free team connect as many repos as it likes while billing is off", async () => {
    delete process.env.BILLING_ENABLED;
    fake.seedProject("p1", "t1");
    fake.seedProject("p2", "t1");
    expect((await connect("ABCD2345")).ok).toBe(true);
  });

  it("lets a paid team connect as many repos as it likes", async () => {
    fake.seedTeam("t1", "pro");
    fake.seedProject("p1", "t1");
    fake.seedProject("p2", "t1");
    expect((await connect("ABCD2345")).ok).toBe(true);
  });
});

describe("codes and keys", () => {
  it("prints codes people can read off a screen", () => {
    const code = generateConnectCode();
    expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(code).not.toMatch(/[ILO01]/);
    expect(normalizeConnectCode(code)).toHaveLength(8);
  });

  it("mints keys that do not collide", () => {
    const keys = new Set(Array.from({ length: 200 }, () => generateProjectKey()));
    expect(keys.size).toBe(200);
  });
});
