import type { Firestore } from "firebase-admin/firestore";
import type Stripe from "stripe";
import { beforeEach, describe, expect, it } from "vitest";
import { applyStripeEvent, planForStatus } from "../src/billing.js";
import { FakeFirestore } from "./fakeFirestore.js";

let fake: FakeFirestore;
let db: Firestore;

beforeEach(() => {
  fake = new FakeFirestore();
  db = fake as unknown as Firestore;
  fake.data.set("teams/t1", { plan: "free", name: "Acme", ownerUid: "u_owner" });
});

const event = (id: string, type: string, object: unknown): Stripe.Event =>
  ({ id, type, data: { object } }) as Stripe.Event;

const checkout = (id = "evt_1", teamId = "t1") =>
  event(id, "checkout.session.completed", {
    client_reference_id: teamId,
    customer: "cus_123",
    subscription: "sub_123",
  });

const subscription = (id: string, status: string, extra: Record<string, unknown> = {}) =>
  event(id, "customer.subscription.updated", {
    id: "sub_123",
    status,
    customer: "cus_123",
    metadata: { teamId: "t1" },
    ...extra,
  });

describe("a completed checkout", () => {
  it("puts the team on the paid plan and records the customer", async () => {
    expect(await applyStripeEvent(db, checkout())).toMatchObject({
      handled: true,
      teamId: "t1",
      plan: "pro",
    });
    expect(fake.data.get("teams/t1")).toMatchObject({
      plan: "pro",
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_123",
    });
  });

  it("ignores a session with no team on it", async () => {
    const orphan = event("evt_x", "checkout.session.completed", { customer: "cus_9" });
    expect(await applyStripeEvent(db, orphan)).toMatchObject({ handled: false });
  });
});

describe("retries", () => {
  it("does not act on the same event twice", async () => {
    await applyStripeEvent(db, checkout("evt_dup"));
    await applyStripeEvent(db, subscription("evt_cancel", "canceled"));
    expect(fake.data.get("teams/t1")).toMatchObject({ plan: "free" });

    // Stripe redelivers the older event; it must not undo the newer one.
    expect(await applyStripeEvent(db, checkout("evt_dup"))).toMatchObject({
      handled: false,
      reason: "duplicate",
    });
    expect(fake.data.get("teams/t1")).toMatchObject({ plan: "free" });
  });
});

describe("subscription status", () => {
  it("keeps a past-due team paid — a failed card is not a downgrade", () => {
    expect(planForStatus("past_due")).toBe("pro");
    expect(planForStatus("active")).toBe("pro");
    expect(planForStatus("trialing")).toBe("pro");
  });

  it("drops a team that has actually stopped paying", () => {
    expect(planForStatus("canceled")).toBe("free");
    expect(planForStatus("unpaid")).toBe("free");
    expect(planForStatus("incomplete_expired")).toBe("free");
  });

  it("records a pending cancellation without removing access", async () => {
    await applyStripeEvent(db, checkout("evt_a"));
    await applyStripeEvent(db, subscription("evt_b", "active", { cancel_at_period_end: true }));
    expect(fake.data.get("teams/t1")).toMatchObject({ plan: "pro", cancelAtPeriodEnd: true });
  });

  it("downgrades on deletion", async () => {
    await applyStripeEvent(db, checkout("evt_c"));
    const deleted = event("evt_d", "customer.subscription.deleted", {
      id: "sub_123",
      status: "canceled",
      customer: "cus_123",
      metadata: { teamId: "t1" },
    });
    expect(await applyStripeEvent(db, deleted)).toMatchObject({ plan: "free" });
    expect(fake.data.get("teams/t1")).toMatchObject({ plan: "free" });
  });

  it("finds the team by customer when the subscription carries no metadata", async () => {
    await applyStripeEvent(db, checkout("evt_e"));
    const orphan = event("evt_f", "customer.subscription.updated", {
      id: "sub_123",
      status: "canceled",
      customer: "cus_123",
      metadata: {},
    });
    expect(await applyStripeEvent(db, orphan)).toMatchObject({ teamId: "t1", plan: "free" });
  });
});

describe("events we do not act on", () => {
  it("are recorded and shrugged off", async () => {
    expect(await applyStripeEvent(db, event("evt_z", "invoice.created", {}))).toMatchObject({
      handled: false,
    });
    expect(fake.data.get("teams/t1")).toMatchObject({ plan: "free" });
  });
});
