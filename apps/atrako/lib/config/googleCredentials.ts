import { prisma } from "@/lib/db";

const KEYS = {
  clientEmail: "google_sheets_client_email",
  privateKey: "google_sheets_private_key",
} as const;


export async function getGoogleSheetsCredentials(): Promise<{
  clientEmail: string | null;
  privateKey: string | null;
}> {
  try {
    const rows = await prisma.systemConfig.findMany({
      where: { key: { in: [KEYS.clientEmail, KEYS.privateKey] } },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const fromDb = {
      clientEmail: map.get(KEYS.clientEmail) ?? null,
      privateKey: map.get(KEYS.privateKey) ?? null,
    };
    if (fromDb.clientEmail && fromDb.privateKey) return fromDb;
  } catch {
    // fallback se o banco falhar
  }
  const fromEnv = {
    clientEmail: process.env.GOOGLE_CLIENT_EMAIL ?? null,
    privateKey: process.env.GOOGLE_PRIVATE_KEY ?? null,
  };
  if (fromEnv.clientEmail && fromEnv.privateKey) return fromEnv;
  return { clientEmail: null, privateKey: null };
}

export async function setGoogleSheetsCredentials(data: {
  clientEmail: string;
  privateKey: string;
}) {
  await prisma.$transaction([
    prisma.systemConfig.upsert({
      where: { key: KEYS.clientEmail },
      create: { key: KEYS.clientEmail, value: data.clientEmail.trim() },
      update: { value: data.clientEmail.trim() },
    }),
    prisma.systemConfig.upsert({
      where: { key: KEYS.privateKey },
      create: { key: KEYS.privateKey, value: data.privateKey.trim() },
      update: { value: data.privateKey.trim() },
    }),
  ]);
}
