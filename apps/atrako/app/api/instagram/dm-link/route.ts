import { NextRequest, NextResponse } from "next/server";
import { acknowledgeDirectLinkClick } from "@/lib/instagram/automationEngine";
import { isDmLinkPrefetch, safeHttpUrl, verifyDmLinkToken } from "@/lib/instagram/dmLinkToken";

export async function GET(request: NextRequest) {
  const payload = verifyDmLinkToken(request.nextUrl.searchParams.get("t"));
  const fallback = payload ? safeHttpUrl(payload.u) : null;
  if (!payload || !fallback) {
    return new NextResponse("Link inválido", { status: 400 });
  }

  let target = fallback;
  if (!isDmLinkPrefetch(request.headers, request.method)) {
    try {
      const saved = await acknowledgeDirectLinkClick(payload);
      target = safeHttpUrl(saved) ?? fallback;
    } catch (error) {
      console.warn("[instagram] obrigado do link falhou:", error instanceof Error ? error.message : error);
    }
  }

  return NextResponse.redirect(target, 302);
}
