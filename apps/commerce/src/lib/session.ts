import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export function isAtrakoEmbedOpen() {
  return process.env.ATRAKO_EMBED_OPEN === "true";
}

export async function requireAdmin() {
  if (isAtrakoEmbedOpen()) {
    return {
      user: {
        id: "atrako-embed",
        name: "Atrako",
        email: "atrako@local",
        role: "ADMIN" as const,
      },
    };
  }
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/login?callbackUrl=/admin");
  }
  return session;
}

export async function requireBuyer() {
  if (isAtrakoEmbedOpen()) {
    return {
      user: {
        id: "atrako-embed",
        name: "Atrako",
        email: "atrako@local",
        role: "BUYER" as const,
      },
    };
  }
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/membros");
  }
  return session;
}
