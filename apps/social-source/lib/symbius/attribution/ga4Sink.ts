import { prisma } from "@/lib/db";

export async function sendGa4Purchase(params: {
  organizationId: string;
  transactionId: string;
  value: number;
  currency: string;
  clientId: string;
}): Promise<void> {
  const settings = await prisma.igOrgSettings.findUnique({
    where: { organizationId: params.organizationId },
  });
  if (!settings?.ga4MeasurementId || !settings?.ga4ApiSecret) return;

  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(settings.ga4MeasurementId)}&api_secret=${encodeURIComponent(settings.ga4ApiSecret)}`;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: params.clientId,
        events: [
          {
            name: "purchase",
            params: {
              transaction_id: params.transactionId,
              value: params.value,
              currency: params.currency,
            },
          },
        ],
      }),
    });
  } catch (e) {
    console.warn("[attribution/ga4]", e);
  }
}
