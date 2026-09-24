import { prisma } from "../lib/db";
import { encryptCredentials, decryptCredentials } from "../lib/atrako/credentials-crypto";

async function main() {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET?.trim();
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  const redirectUri =
    process.env.GOOGLE_ADS_REDIRECT_URI?.trim() ||
    "https://atrako.com.br/api/atrako/oauth/google-ads/callback";
  if (!clientId || !clientSecret) throw new Error("GOOGLE_ADS_CLIENT_ID/SECRET required");

  const existing = await prisma.platformApp.findUnique({ where: { provider: "GOOGLE_ADS" } });
  const prev = existing ? decryptCredentials(existing.credentialsEnc) : {};
  const next = {
    ...prev,
    clientId,
    clientSecret,
    redirectUri,
    ...(developerToken ? { developerToken } : {}),
  };

  await prisma.platformApp.upsert({
    where: { provider: "GOOGLE_ADS" },
    create: {
      provider: "GOOGLE_ADS",
      enabled: true,
      label: "Google Ads",
      credentialsEnc: encryptCredentials(next),
    },
    update: {
      enabled: true,
      label: "Google Ads",
      credentialsEnc: encryptCredentials(next),
    },
  });

  const calRedirect =
    process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim() ||
    "https://atrako.com.br/api/atrako/oauth/google-calendar/callback";
  const calExisting = await prisma.platformApp.findUnique({
    where: { provider: "GOOGLE_CALENDAR" },
  });
  const calPrev = calExisting ? decryptCredentials(calExisting.credentialsEnc) : {};
  await prisma.platformApp.upsert({
    where: { provider: "GOOGLE_CALENDAR" },
    create: {
      provider: "GOOGLE_CALENDAR",
      enabled: true,
      label: "Google Calendar",
      credentialsEnc: encryptCredentials({ ...calPrev, redirectUri: calRedirect }),
    },
    update: {
      enabled: true,
      label: "Google Calendar",
      credentialsEnc: encryptCredentials({
        ...calPrev,
        redirectUri: (calPrev as { redirectUri?: string }).redirectUri || calRedirect,
      }),
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        googleAds: {
          hasClientId: true,
          hasClientSecret: true,
          hasDeveloperToken: Boolean(next.developerToken),
          redirectUri: next.redirectUri,
          enabled: true,
        },
        googleCalendar: {
          enabled: true,
          inheritsOAuthFrom: "GOOGLE_ADS",
          redirectUri: calRedirect,
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
