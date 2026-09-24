"use client";

/**
 * Encerra sessão staff e/ou membro e volta para a LP / login.
 */
export async function logoutEverywhere(redirectTo = "/"): Promise<void> {
  await Promise.allSettled([
    fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" } }),
    fetch("/api/auth/member/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }),
  ]);
  window.location.assign(redirectTo);
}
