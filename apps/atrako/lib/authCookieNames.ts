/**
 * Cookie names safe for Edge Middleware (no node:crypto / prisma).
 * Keep in sync with authSecurity / memberAuth.
 */
export const AUTH_COOKIE_NAME = "inout_session";
export const AUTH_COOKIE_NAME_PRODUCTION = "__Host-inout_session";
export const MEMBER_SESSION_COOKIE = "atrako_member_session";
