import type { Firestore } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeFirestore } from "./fakeFirestore.js";

// The router authenticates with Firebase; the question here is what happens
// *after* a real, ordinary sign-in, so the token check is stubbed and
// everything past it is the real code.
vi.mock("../src/auth.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/auth.js")>();
  return {
    ...actual,
    verifyCaller: async (authorization: string | undefined) => {
      const uid = authorization?.replace(/^Bearer\s+/i, "").trim();
      return uid ? { uid, email: `${uid}@example.com`, name: uid, picture: null } : null;
    },
  };
});

const { handleApiRequest } = await import("../src/router.js");

let fake: FakeFirestore;
let db: Firestore;

beforeEach(() => {
  fake = new FakeFirestore();
  db = fake as unknown as Firestore;

  // Two strangers who each signed up on their own.
  fake.seedTeam("t_owner", "free");
  fake.data.set("teams/t_owner/members/u_owner", { uid: "u_owner", role: "owner" });
  fake.data.set("systems/s_private", { teamId: "t_owner", name: "Private system" });

  fake.seedTeam("t_stranger", "free");
  fake.data.set("teams/t_stranger/members/u_stranger", { uid: "u_stranger", role: "owner" });
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
  };
  return { res, sent };
}

const post = async (path: string, uid: string, body: unknown) => {
  const { res, sent } = response();
  await handleApiRequest(
    db,
    path,
    { method: "POST", headers: { authorization: `Bearer ${uid}` }, body, on() {} } as never,
    res as never,
  );
  return sent;
};

describe("one person's systems stay their own", () => {
  it("refuses a team the caller does not belong to", async () => {
    const sent = await post("/api/systems/create", "u_stranger", {
      teamId: "t_owner",
      name: "sneaky",
    });
    expect(sent.status).toBe(403);
  });

  /**
   * The dangerous shape: a real team the caller *does* belong to, paired with
   * somebody else's systemId. Membership passes; the system is not theirs. A
   * read key minted here would read another person's tokens and every one of
   * their screenshots.
   */
  it("refuses to mint a read key for a system belonging to someone else", async () => {
    const sent = await post("/api/systems/read-key", "u_stranger", {
      teamId: "t_stranger",
      systemId: "s_private",
    });
    expect(sent.status).not.toBe(201);
  });

  it("refuses to attach a project to someone else's system", async () => {
    const sent = await post("/api/projects/create", "u_stranger", {
      teamId: "t_stranger",
      systemId: "s_private",
      name: "sneaky",
    });
    expect(sent.status).not.toBe(201);
  });

  it("refuses to mint a connect code for someone else's system", async () => {
    const sent = await post("/api/connect-codes", "u_stranger", {
      teamId: "t_stranger",
      systemId: "s_private",
    });
    expect(sent.status).not.toBe(201);
  });

  it("refuses to restore a version into someone else's system", async () => {
    const sent = await post("/api/versions/restore", "u_stranger", {
      teamId: "t_stranger",
      systemId: "s_private",
      versionId: "v1",
    });
    expect(sent.status).not.toBe(200);
  });

  it("still lets the owner work on their own system", async () => {
    const sent = await post("/api/systems/read-key", "u_owner", {
      teamId: "t_owner",
      systemId: "s_private",
    });
    expect(sent.status).toBe(201);
  });
});
