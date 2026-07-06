/** Shared admin session cookie name — import from here in middleware to avoid pulling Node-only auth code into the Edge bundle. */
export const ADMIN_SESSION_COOKIE = "cb_admin_session";

/** JWT claims pinned on sign + verify so tokens minted for other apps or contexts are rejected. */
export const JWT_ISSUER = "cashmir-biotech";
export const JWT_AUDIENCE = "cb-admin";
