import type { Firestore } from "firebase-admin/firestore";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Caller } from "../src/auth.js";
import { acceptInvite, inviteMember, INVITE_TTL_MS, removeMember, revokeInvite } from "../src/invites.js";
import { countSeats } from "../src/plans.js";
import { FakeFirestore } from "./fakeFirestore.js";

const NOW = 1_800_000_000_000;
const owner: Caller = { uid: "u_owner", email: "owner@acme.com", name: "Owner", picture: null };
const invitee: Caller = { uid: "u_new", email: "new@acme.com", name: "New Person", picture: null };

let fake: FakeFirestore;
let db: Firestore;

beforeEach(() => {
  fake = new FakeFirestore();
  db = fake as unknown as Firestore;
  fake.seedTeam("t1", "pro");
  fake.data.set("teams/t1", { plan: "pro", name: "Acme", ownerUid: "u_owner", defaultSystemId: "sys_t1" });
  fake.seedMember("t1", "u_owner", { role: "owner", email: "owner@acme.com" });
});

const invite = (email: string, role?: "admin" | "member") =>
  inviteMember(db, "t1", owner, { email, role }, NOW);

describe("inviting", () => {
  it("creates a pending invitation with a token", async () => {
    const result = await invite("new@acme.com");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.token).toHaveLength(32);
    expect(result.expiresAt).toBe(NOW + INVITE_TTL_MS);
    expect(fake.data.get(`invites/${result.inviteId}`)).toMatchObject({
      teamId: "t1",
      email: "new@acme.com",
      status: "pending",
      role: "member",
    });
  });

  it("normalises the address it was given", async () => {
    const result = await invite("  New@Acme.COM ");
    if (!result.ok) throw new Error("expected success");
    expect(result.email).toBe("new@acme.com");
  });

  it("refuses an address that is not one", async () => {
    expect(await invite("not-an-email")).toMatchObject({ ok: false, code: "bad_request" });
  });

  it("refuses someone already on the team", async () => {
    expect(await invite("owner@acme.com")).toMatchObject({ ok: false, code: "already_member" });
  });

  it("refuses a second invitation to the same person", async () => {
    await invite("new@acme.com");
    expect(await invite("new@acme.com")).toMatchObject({ ok: false, code: "already_invited" });
  });

  it("can invite an admin", async () => {
    const result = await invite("admin@acme.com", "admin");
    if (!result.ok) throw new Error("expected success");
    expect(result.role).toBe("admin");
  });
});

describe("seats", () => {
  beforeEach(() => {
    process.env.BILLING_ENABLED = "1";
  });
  afterEach(() => {
    delete process.env.BILLING_ENABLED;
  });

  it("counts a pending invitation as a seat", async () => {
    expect(await countSeats(db, "t1")).toBe(1);
    await invite("new@acme.com");
    expect(await countSeats(db, "t1")).toBe(2);
  });

  it("stops a free team at one person", async () => {
    fake.data.set("teams/t1", { plan: "free", name: "Acme", ownerUid: "u_owner" });
    expect(await invite("new@acme.com")).toMatchObject({
      ok: false,
      code: "upgrade_required",
      status: 403,
    });
  });

  it("lets a free team invite anyone while billing is off", async () => {
    delete process.env.BILLING_ENABLED;
    fake.data.set("teams/t1", { plan: "free", name: "Acme", ownerUid: "u_owner" });
    expect((await invite("new@acme.com")).ok).toBe(true);
  });

  it("frees the seat again when an invitation is revoked", async () => {
    const result = await invite("new@acme.com");
    if (!result.ok) throw new Error("expected success");
    expect(await revokeInvite(db, "t1", result.inviteId)).toMatchObject({ ok: true });
    expect(await countSeats(db, "t1")).toBe(1);
  });

  it("will not revoke an invitation belonging to another team", async () => {
    const result = await invite("new@acme.com");
    if (!result.ok) throw new Error("expected success");
    expect(await revokeInvite(db, "other", result.inviteId)).toMatchObject({
      ok: false,
      code: "not_found",
    });
  });
});

describe("accepting", () => {
  it("adds the person to the team with the invited role", async () => {
    const created = await invite("new@acme.com", "admin");
    if (!created.ok) throw new Error("expected success");

    const accepted = await acceptInvite(db, invitee, created.token, NOW);
    expect(accepted).toMatchObject({ ok: true, teamId: "t1", role: "admin", systemId: "sys_t1" });
    expect(fake.data.get("teams/t1/members/u_new")).toMatchObject({
      uid: "u_new",
      role: "admin",
    });
    expect(fake.data.get(`invites/${created.inviteId}`)).toMatchObject({
      status: "accepted",
      acceptedBy: "u_new",
    });
  });

  it("burns the token — a forwarded invitation works once", async () => {
    const created = await invite("new@acme.com");
    if (!created.ok) throw new Error("expected success");
    await acceptInvite(db, invitee, created.token, NOW);
    expect(await acceptInvite(db, { ...invitee, uid: "u_other" }, created.token, NOW)).toMatchObject(
      { ok: false, code: "expired" },
    );
    expect(fake.data.has("teams/t1/members/u_other")).toBe(false);
  });

  it("refuses an expired invitation", async () => {
    const created = await invite("new@acme.com");
    if (!created.ok) throw new Error("expected success");
    expect(
      await acceptInvite(db, invitee, created.token, NOW + INVITE_TTL_MS + 1),
    ).toMatchObject({ ok: false, code: "expired", status: 410 });
  });

  it("refuses a token nobody issued", async () => {
    expect(await acceptInvite(db, invitee, "made-up", NOW)).toMatchObject({
      ok: false,
      code: "invalid_token",
      status: 404,
    });
  });

  it("accepts from an address that differs from the invited one", async () => {
    const created = await invite("new@acme.com");
    if (!created.ok) throw new Error("expected success");
    const accepted = await acceptInvite(
      db,
      { ...invitee, email: "new.person@gmail.com" },
      created.token,
      NOW,
    );
    expect(accepted.ok).toBe(true);
  });
});

describe("removing", () => {
  it("removes a member", async () => {
    fake.seedMember("t1", "u_member");
    expect(await removeMember(db, "t1", "u_member")).toMatchObject({ ok: true });
    expect(fake.data.has("teams/t1/members/u_member")).toBe(false);
  });

  it("never removes the owner — a team with no owner has nobody to pay for it", async () => {
    expect(await removeMember(db, "t1", "u_owner")).toMatchObject({
      ok: false,
      code: "forbidden",
    });
    expect(fake.data.has("teams/t1/members/u_owner")).toBe(true);
  });

  it("reports someone who is not on the team", async () => {
    expect(await removeMember(db, "t1", "u_stranger")).toMatchObject({
      ok: false,
      code: "not_found",
    });
  });
});
