export type ClienteAccessMode = "read" | "public-read" | "write";

/**
 * Anonymous access is an explicit opt-in for an endpoint and only applies
 * when the request does not carry a portal session cookie. A missing cookie
 * can never satisfy the default protected read policy.
 */
export function allowsAnonymousClienteRead(
  mode: ClienteAccessMode,
  hasPortalCookie: boolean,
) {
  return mode === "public-read" && !hasPortalCookie;
}