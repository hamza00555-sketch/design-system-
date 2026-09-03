import type { Firestore } from "firebase-admin/firestore";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { canBootstrap } from "../src/access.js";
import type { Caller } from "../src/auth.js";
import { FakeFirestore } from "./fakeFirestore.js";

const owner: Caller = { uid: "u_owner", email: "me@example.com", name: "Me", picture: null };
const stranger: Caller = { uid: "u_x", email: "someone@else.com", name: "Someone", picture: null };

let fake: FakeFirestore;
let db: Firestore;

beforeEach(() => {
  fake = new FakeFirestore();
  db = fake as unknown as Firestore;
});

afterEach(() => {
  delete process.env.ALLOWED_EMAILS;
  delete process.env.OPEN_SIGNUPS;
});

describe("an unclaimed deployment", () => {
  it("lets the first person in", async () => {
    expect(await canBootstrap(db, owner)).toEqual({ allowed: true });
  });

  it("shuts behind them", async () => {
    fake.seedTeam("t1", "free");
    fake.seedMember("t1", "u_owner", { role: "owner" });
    expect(await canBootstrap(db, stranger)).toMatchObject({
      allowed: false,
      code: "not_allowed",
    });
  });

  it("still lets an existing member back in", async () => {
    fake.seedTeam("t1", "free");
    fake.seedMember("t1", "u_owner", { role: "owner" });
    expect(await canBootstrap(db, owner)).toEqual({ allowed: true });
  });

  it("lets someone who joined by invitation back in", async () => {
    fake.seedTeam("t1", "free");
    fake.seedMember("t1", "u_owner", { role: "owner" });
    fake.seedMember("t1", "u_x", { role: "member" });
    expect(await canBootstrap(db, stranger)).toEqual({ allowed: true });
  });
});

describe("an allowlist", () => {
  beforeEach(() => {
    fake.seedTeam("t1", "free");
    fake.seedMember("t1", "u_owner", { role: "owner" });
  });

  it("admits the addresses on it", async () => {
    process.env.ALLOWED_EMAILS = "someone@else.com";
    expect(await canBootstrap(db, stranger)).toEqual({ allowed: true });
  });

  it("is case- and whitespace-insensitive", async () => {
    process.env.ALLOWED_EMAILS = " Me@Example.com , Someone@Else.com ";
    expect(await canBootstrap(db, { ...stranger, uid: "u_new" })).toEqual({ allowed: true });
  });

  it("refuses everyone else", async () => {
    process.env.ALLOWED_EMAILS = "me@example.com";
    expect(await canBootstrap(db, stranger)).toMatchObject({ allowed: false });
  });

  it("refuses an account with no email", async () => {
    process.env.ALLOWED_EMAILS = "me@example.com";
    expect(await canBootstrap(db, { ...stranger, email: null })).toMatchObject({
      allowed: false,
    });
  });
});

describe("open signups", () => {
  it("let anyone in, for a public deployment", async () => {
    process.env.OPEN_SIGNUPS = "1";
    fake.seedTeam("t1", "free");
    fake.seedMember("t1", "u_owner", { role: "owner" });
    expect(await canBootstrap(db, stranger)).toEqual({ allowed: true });
  });
});
