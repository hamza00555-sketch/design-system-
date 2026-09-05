import type { Firestore } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it } from "vitest";
import { createProject } from "../src/connect.js";
import { FirestoreStore } from "../src/firestoreStore.js";
import { handleApiRequest } from "../src/router.js";
import { FakeFirestore } from "./fakeFirestore.js";

/**
 * A read key is meant to be committed inside an exported DESIGN.md. Everything
 * about that idea depends on it being unable to change anything, so the gate
 * is exercised through the router rather than by asserting on a list of paths.
 */
let fake: FakeFirestore;
let db: Firestore;

beforeEach(() => {
  fake = new FakeFirestore();
  db = fake as unknown as Firestore;
  fake.seedTeam("t1", "free");
});

function response() {
  const sent: { status: number; body: unknown } = { status: 0, body: null };
  const res = {
    status(code: number) {
      sent.status = code;
      return res;
    },
    json(body: unknown) {
      sent.body = body;
    },
    writeHead() {},
    end() {},
    setHeader() {},
  };
  return { res, sent };
}

const call = async (path: string, key: string, method: string, body: unknown = {}) => {
  const { res, sent } = response();
  await handleApiRequest(
    db,
    path,
    { method, headers: { authorization: `Bearer ${key}` }, body, on() {} } as never,
    res as never,
  );
  return sent;
};

async function keys() {
  const write = await createProject(db, { teamId: "t1", systemId: "s1", name: "w" });
  const read = await createProject(db, {
    teamId: "t1",
    systemId: "s1",
    name: "r",
    scope: "read",
  });
  return { write: write.apiKey, read: read.apiKey };
}

describe("what a read key may do", () => {
  it("resolves with a read scope, while an ordinary key stays a write key", async () => {
    const { write, read } = await keys();
    const store = new FirestoreStore(db);
    expect((await store.resolveKey(read))?.scope).toBe("read");
    expect((await store.resolveKey(write))?.scope).toBe("write");
  });

  it("refuses to push a design system", async () => {
    const { read } = await keys();
    const sent = await call("/api/systems/push", read, "POST", { system: {} });
    expect(sent.status).toBe(403);
    expect(sent.body).toMatchObject({ code: "read_only" });
  });

  it("refuses to upload or delete a picture", async () => {
    const { read } = await keys();
    for (const method of ["POST", "DELETE"]) {
      const sent = await call("/api/systems/screens", read, method, { name: "dashboard" });
      expect(sent.status).toBe(403);
    }
  });

  it("still lists the pictures, which is the whole point of it", async () => {
    const { read } = await keys();
    const sent = await call("/api/systems/screens", read, "GET");
    expect(sent.status).toBe(200);
    expect(sent.body).toMatchObject({ systemId: "s1", total: 0 });
  });

  it("leaves a write key able to write", async () => {
    const { write } = await keys();
    const sent = await call("/api/systems/screens", write, "POST", {
      name: "dashboard",
      data: Buffer.from("x").toString("base64"),
      mimeType: "image/webp",
    });
    expect(sent.status).toBe(200);
  });
});
