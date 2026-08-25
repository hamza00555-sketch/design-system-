import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import Stripe from "stripe";
import { planOf, type Plan } from "./plans.js";

/**
 * Billing.
 *
 * Stripe is reached through a narrow gateway rather than called directly, so
 * the parts that decide what a payment *means* — which team becomes paid, when
 * a plan lapses — can be tested without a network or a key.
 */

export interface CheckoutInput {
  teamId: string;
  uid: string;
  email: string | null;
  customerId?: string;
  successUrl: string;
  cancelUrl: string;
}

export interface StripeGateway {
  createCheckoutSession(input: CheckoutInput): Promise<{ url: string }>;
  createPortalSession(input: { customerId: string; returnUrl: string }): Promise<{ url: string }>;
  constructEvent(rawBody: Buffer | string, signature: string): Stripe.Event;
}

export function stripeGateway(
  secretKey: string,
  priceId: string,
  webhookSecret: string,
): StripeGateway {
  const stripe = new Stripe(secretKey);
  return {
    async createCheckoutSession(input) {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        // client_reference_id is how the webhook knows which team just paid.
        client_reference_id: input.teamId,
        ...(input.customerId
          ? { customer: input.customerId }
          : input.email
            ? { customer_email: input.email }
            : {}),
        subscription_data: { metadata: { teamId: input.teamId, uid: input.uid } },
        metadata: { teamId: input.teamId, uid: input.uid },
      });
      if (!session.url) throw new Error("Stripe returned a session with no URL.");
      return { url: session.url };
    },

    async createPortalSession({ customerId, returnUrl }) {
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });
      return { url: session.url };
    },

    constructEvent(rawBody, signature) {
      return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    },
  };
}

/** Subscription statuses that keep the paid features on. */
const PAYING = new Set<Stripe.Subscription.Status>(["active", "trialing", "past_due"]);

export function planForStatus(status: Stripe.Subscription.Status): Plan {
  return PAYING.has(status) ? "pro" : "free";
}

export interface AppliedEvent {
  handled: boolean;
  teamId?: string;
  plan?: Plan;
  reason?: string;
}

/**
 * Turn a Stripe event into a plan change.
 *
 * Stripe retries webhooks, and a retry must not undo a later event — so each
 * event id is recorded and a second delivery is a no-op.
 */
export async function applyStripeEvent(
  db: Firestore,
  event: Stripe.Event,
): Promise<AppliedEvent> {
  const seen = db.collection("stripeEvents").doc(event.id);
  if ((await seen.get()).exists) return { handled: false, reason: "duplicate" };

  const result = await route(db, event);
  await seen.set({
    type: event.type,
    receivedAt: FieldValue.serverTimestamp(),
    teamId: result.teamId ?? null,
    plan: result.plan ?? null,
  });
  return result;
}

async function route(db: Firestore, event: Stripe.Event): Promise<AppliedEvent> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const teamId =
        session.client_reference_id ?? (session.metadata?.teamId as string | undefined);
      if (!teamId) return { handled: false, reason: "no team on session" };
      await setBilling(db, teamId, {
        plan: "pro",
        stripeCustomerId: asId(session.customer),
        stripeSubscriptionId: asId(session.subscription),
      });
      return { handled: true, teamId, plan: "pro" };
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const plan =
        event.type === "customer.subscription.deleted"
          ? "free"
          : planForStatus(subscription.status);
      const teamId =
        (subscription.metadata?.teamId as string | undefined) ??
        (await teamByCustomer(db, asId(subscription.customer)));
      if (!teamId) return { handled: false, reason: "no team for customer" };
      await setBilling(db, teamId, {
        plan,
        stripeCustomerId: asId(subscription.customer),
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      });
      return { handled: true, teamId, plan };
    }

    default:
      return { handled: false, reason: `unhandled type ${event.type}` };
  }
}

function asId(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

async function teamByCustomer(db: Firestore, customerId: string | null): Promise<string | null> {
  if (!customerId) return null;
  const snap = await db
    .collection("teams")
    .where("stripeCustomerId", "==", customerId)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0]!.id;
}

async function setBilling(
  db: Firestore,
  teamId: string,
  fields: {
    plan: Plan;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    subscriptionStatus?: string;
    cancelAtPeriodEnd?: boolean;
  },
): Promise<void> {
  const update: Record<string, unknown> = {
    plan: planOf(fields.plan),
    billingUpdatedAt: FieldValue.serverTimestamp(),
  };
  if (fields.stripeCustomerId) update.stripeCustomerId = fields.stripeCustomerId;
  if (fields.stripeSubscriptionId) update.stripeSubscriptionId = fields.stripeSubscriptionId;
  if (fields.subscriptionStatus) update.subscriptionStatus = fields.subscriptionStatus;
  if (fields.cancelAtPeriodEnd !== undefined) update.cancelAtPeriodEnd = fields.cancelAtPeriodEnd;
  await db.collection("teams").doc(teamId).set(update, { merge: true });
}
