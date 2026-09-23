import { NextRequest, NextResponse } from "next/server";
import { exchangeAuthorizationCode } from "@/lib/mercadopago/oauth";
import { encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const storedState = req.cookies.get("mp_oauth_state")?.value;
  const verifier = req.cookies.get("mp_oauth_verifier")?.value;
  const test = req.cookies.get("mp_oauth_test")?.value === "1";

  if (!code || !state || !storedState || state !== storedState || !verifier) {
    return NextResponse.redirect(
      absoluteUrl("/admin/integracoes/mercado-pago?error=oauth_state"),
    );
  }

  try {
    const token = await exchangeAuthorizationCode({
      code,
      codeVerifier: verifier,
      testToken: test,
    });

    await prisma.mercadoPagoAccount.deleteMany({});
    await prisma.mercadoPagoAccount.create({
      data: {
        mpUserId: String(token.user_id),
        accessTokenEnc: encryptSecret(token.access_token),
        refreshTokenEnc: token.refresh_token
          ? encryptSecret(token.refresh_token)
          : null,
        publicKey: token.public_key,
        liveMode: token.live_mode,
        expiresAt: new Date(Date.now() + token.expires_in * 1000),
        status: "CONNECTED",
      },
    });

    const res = NextResponse.redirect(
      absoluteUrl("/admin/integracoes/mercado-pago?connected=1"),
    );
    res.cookies.delete("mp_oauth_state");
    res.cookies.delete("mp_oauth_verifier");
    res.cookies.delete("mp_oauth_test");
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.redirect(
      absoluteUrl("/admin/integracoes/mercado-pago?error=oauth_exchange"),
    );
  }
}
