const isProd = process.env.NODE_ENV === "production";

/** Shared admin session cookie name — import from here in middleware to avoid pulling Node-only auth code into the Edge bundle. */
export const ADMIN_SESSION_COOKIE = isProd ? "__Host-cb_admin_session" : "cb_admin_session";
export const ADMIN_REFRESH_COOKIE = isProd ? "__Host-cb_admin_refresh" : "cb_admin_refresh";

/** Customer Portal session — separate from admin at every layer. */
export const CUSTOMER_SESSION_COOKIE = isProd ? "__Host-cb_customer_session" : "cb_customer_session";
export const CUSTOMER_REFRESH_COOKIE = isProd ? "__Host-cb_customer_refresh" : "cb_customer_refresh";

/** JWT claims pinned on sign + verify so tokens minted for other apps or contexts are rejected. */
export const JWT_ISSUER = "cashmir-biotech";
export const JWT_AUDIENCE = "cb-admin";
export const CUSTOMER_JWT_AUDIENCE = "cb-customer";
