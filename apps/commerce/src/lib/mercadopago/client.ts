import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { refreshAccessToken } from "@/lib/mercadopago/oauth";
import { fetchMercadoPagoFromAtrako } from "@/lib/atrako-connections";

export async function getConnectedMpAccount() {
  return prisma.mercadoPagoAccount.findFirst({
    where: { status: "CONNECTED" },
    orderBy: { connectedAt: "desc" },
  });
}

export async function getSellerAccessToken() {
  const fromHub = await fetchMercadoPagoFromAtrako();
  if (fromHub?.accessToken) return fromHub.accessToken;

  const account = await getConnectedMpAccount();
  if (!account) return null;

  const nearExpiry =
    account.expiresAt && account.expiresAt.getTime() - Date.now() < 1000 * 60 * 60 * 24 * 7;

  if (nearExpiry && account.refreshTokenEnc) {
    try {
      const refreshed = await refreshAccessToken(decryptSecret(account.refreshTokenEnc));
      await prisma.mercadoPagoAccount.update({
        where: { id: account.id },
        data: {
          accessTokenEnc: encryptSecret(refreshed.access_token),
          refreshTokenEnc: refreshed.refresh_token
            ? encryptSecret(refreshed.refresh_token)
            : account.refreshTokenEnc,
          publicKey: refreshed.public_key || account.publicKey,
          liveMode: refreshed.live_mode,
          expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
        },
      });
      return refreshed.access_token;
    } catch {
      // fall through to current token
    }
  }

  return decryptSecret(account.accessTokenEnc);
}

export async function getOrCreatePaymentSettings() {
  return prisma.paymentSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
}
