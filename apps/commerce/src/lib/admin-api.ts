import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { isAtrakoEmbedOpen } from "@/lib/session";

export async function requireAdminApi() {
  if (isAtrakoEmbedOpen()) {
    return {
      session: {
        user: {
          id: "atrako-embed",
          name: "Atrako",
          email: "atrako@local",
          role: "ADMIN" as const,
        },
      },
      error: null,
    };
  }
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { session: null, error: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) };
  }
  return { session, error: null };
}
