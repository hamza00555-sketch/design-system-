/**
 * Whether this deployment is a public product or a private instance.
 *
 * Private is the default: the root goes straight to the dashboard, and the
 * marketing pages stay reachable by URL but stop being the front door. Set
 * NEXT_PUBLIC_PUBLIC_SITE=1 to put the landing page back in front.
 */
export const PUBLIC_SITE = process.env.NEXT_PUBLIC_PUBLIC_SITE === "1";
