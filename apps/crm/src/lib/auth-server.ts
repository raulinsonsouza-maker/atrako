import { headers } from "next/headers";
import { cache } from "react";

/**
 * Obtém a sessão do usuário via Better Auth.
 * Usa fetch HTTP para /api/auth/get-session (compatível com Next.js Server Actions).
 * 
 * OTIMIZADO: Usa React cache() para reutilizar a sessão na mesma requisição,
 * evitando múltiplos fetches HTTP redundantes.
 */
export const getSession = cache(async () => {
  try {
    const h = await headers();
    const sessionHeader = h.get("x-session-data");
    if (sessionHeader) {
      try {
        const parsed = JSON.parse(sessionHeader) as { user?: unknown; session?: unknown };
        if (parsed?.user) return { user: parsed.user, session: parsed.session || null };
      } catch {
        /* header inválido, segue para fetch */
      }
    }

    const host = h.get("host") || h.get("x-forwarded-host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const base = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

    const res = await fetch(`${base}/api/auth/get-session`, {
      headers: { cookie: h.get("cookie") || "" },
      cache: "no-store",
    }).catch((err) => {
      console.error("[auth-server] Erro ao buscar sessão:", err);
      return null;
    });

    if (!res || !res.ok) return null;

    const json = await res.json().catch(() => null);
    if (!json?.user) return null;

    return {
      user: json.user,
      session: json.session || null,
    };
  } catch {
    return null;
  }
});
