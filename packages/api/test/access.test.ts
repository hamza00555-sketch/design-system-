import type { Firestore } from "firebase-admin/firestore";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { canBootstrap } from "../src/access.js";
import { FakeFirestore } from "./fakeFirestore.js";

let fake: FakeFirestore;
let db: Firestore;

beforeEach(() => {
  fake = new FakeFirestore();
  db = fake as unknown as Firestore;
});

afterEach(() => {
  delete process.env.ALLOWED_EMAILS;
});

const ask = (uid: string, email?: string) => canBootstrap(db, { uid, email } as never);

describe("an open deployment", () => {
  it("lets anyone with the link in", async () => {
    expect(await ask("u1", "someone@example.com")).toEqual({ allowed: true });
  });

  it("does not mind an account with no email", async () => {
    expect(await ask("u2")).toEqual({ allowed: true });
  });

  /**
   * What an arrival gets is their own team: `bootstrapWorkspace` derives the
   * ids from the uid, so an open door never puts somebody inside another
   * person's data.
   */
  it("keeps letting people in once a team already exists", async () => {
    fake.seedTeam("t1", "free");
    expect(await ask("u3", "later@example.com")).toEqual({ allowed: true });
  });
});

describe("ALLOWED_EMAILS closes it again", () => {
  beforeEach(() => {
    process.env.ALLOWED_EMAILS = " Owner@Example.com , second@example.com ";
  });

  it("admits the addresses on it, whatever their case or spacing", async () => {
    expect(await ask("u1", "owner@example.com")).toEqual({ allowed: true });
    expect(await ask("u2", "  SECOND@example.com ")).toEqual({ allowed: true });
  });

  it("refuses everyone else", async () => {
    expect(await ask("u3", "stranger@example.com")).toMatchObject({
      allowed: false,
      code: "not_allowed",
    });
  });

  it("does not throw out someone already on a team", async () => {
    fake.seedTeam("t1", "free");
    fake.data.set("teams/t1/members/u4", { uid: "u4", role: "member" });
    expect(await ask("u4", "stranger@example.com")).toEqual({ allowed: true });
  });
});
