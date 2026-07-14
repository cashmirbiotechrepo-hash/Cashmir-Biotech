/** Shared admin session cookie name — import from here in middleware to avoid pulling Node-only auth code into the Edge bundle. */
export const ADMIN_SESSION_COOKIE = "cb_admin_session";
export const ADMIN_REFRESH_COOKIE = "cb_admin_refresh";

/** Research Portal (customer) session — separate from admin at every layer. */
export const CUSTOMER_SESSION_COOKIE = "cb_customer_session";

/** JWT claims pinned on sign + verify so tokens minted for other apps or contexts are rejected. */
export const JWT_ISSUER = "cashmir-biotech";
export const JWT_AUDIENCE = "cb-admin";
export const CUSTOMER_JWT_AUDIENCE = "cb-customer";
