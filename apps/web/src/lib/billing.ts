/**
 * Whether this deployment sells anything.
 *
 * Off by default, matching the functions' BILLING_ENABLED. When it is off the
 * product is simply open: no plan to choose, no limits to hit, and no upgrade
 * button pointing at a checkout that would refuse anyway.
 */
export const BILLING_ENABLED = process.env.NEXT_PUBLIC_BILLING_ENABLED === "1";
