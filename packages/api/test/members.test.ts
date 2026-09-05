import type { Firestore } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it } from "vitest";
import { removeMember } from "../src/teams.js";
import { FakeFirestore } from "./fakeFirestore.js";

/**
 * Invitations are gone, so nobody joins a team any more — each person who
 * signs in gets their own. Removal outlives them: teams that gained members
 * while invitations existed still need a way to shed one.
 */
let fake: FakeFirestore;
let db: Firestore;

beforeEach(() => {
  fake = new FakeFirestore();
  db = fake as unknown as Firestore;
  fake.seedTeam("t1", "free");
  fake.data.set("teams/t1", { ...(fake.data.get("teams/t1") ?? {}), ownerUid: "u_owner" });
  fake.data.set("teams/t1/members/u_owner", { uid: "u_owner", role: "owner" });
  fake.data.set("teams/t1/members/u_member", { uid: "u_member", role: "member" });
});

describe("removing a member", () => {
  it("takes them off the team", async () => {
    expect(await removeMember(db, "t1", "u_member")).toMatchObject({ ok: true });
    expect(fake.data.has("teams/t1/members/u_member")).toBe(false);
  });

  it("refuses to remove the owner, who would leave the team unowned", async () => {
    expect(await removeMember(db, "t1", "u_owner")).toMatchObject({
      ok: false,
      status: 403,
    });
    expect(fake.data.has("teams/t1/members/u_owner")).toBe(true);
  });

  it("refuses somebody who was never on it", async () => {
    expect(await removeMember(db, "t1", "u_stranger")).toMatchObject({
      ok: false,
      status: 404,
    });
  });
});
