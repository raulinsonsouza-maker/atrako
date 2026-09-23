import "server-only";

import { NextResponse } from "next/server";
import { InternalAuthError, requireInternalUser } from "@/lib/internalUsers";

/**
 * API authorization for browser-facing internal routes. The local opaque
 * session cookie is the only browser credential; ADMIN_SECRET/x-admin-token
 * are not accepted here.
 */
export async function requireInternalAdmin() {
  try {
    return { user: await requireInternalUser("ADMIN"), response: null };
  } catch (error) {
    if (error instanceof InternalAuthError) {
      return {
        user: null,
        response: NextResponse.json({ error: error.message }, { status: error.status }),
      };
    }
    throw error;
  }
}

export async function requireInternalAnalyst() {
  try {
    return { user: await requireInternalUser(), response: null };
  } catch (error) {
    if (error instanceof InternalAuthError) {
      return {
        user: null,
        response: NextResponse.json({ error: error.message }, { status: error.status }),
      };
    }
    throw error;
  }
}

export async function isInternalAdminAuthorized() {
  const result = await requireInternalAdmin();
  return Boolean(result.user && !result.response);
}

export async function isInternalAnalystAuthorized() {
  const result = await requireInternalAnalyst();
  return Boolean(result.user && !result.response);
}