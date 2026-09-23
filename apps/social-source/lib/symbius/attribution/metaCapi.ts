import { prisma } from "@/lib/db";
import { createHash } from "crypto";

function sha256(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export async function sendMetaCapiEvent(params: {
  organizationId: string;
  eventName: string;
  eventId: string;
  value?: number;
  currency?: string;
  email?: string | null;
  phone?: string | null;
  eventSourceUrl?: string;
}): Promise<void> {
  const settings = await prisma.igOrgSettings.findUnique({
    where: { organizationId: params.organizationId },
  });
  if (!settings?.metaPixelId || !settings?.metaCapiToken) return;

  const userData: Record<string, string[]> = {};
  if (params.email) userData.em = [sha256(params.email)];
  if (params.phone) {
    userData.ph = [sha256(params.phone.replace(/\D/g, ""))];
  }

  const body = {
    data: [
      {
        event_name: params.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: params.eventId,
        action_source: "website",
        event_source_url: params.eventSourceUrl,
        user_data: userData,
        custom_data:
          params.value != null
            ? {
                value: params.value,
                currency: params.currency ?? "BRL",
              }
            : undefined,
      },
    ],
  };

  try {
    const url = `https://graph.facebook.com/v21.0/${settings.metaPixelId}/events?access_token=${encodeURIComponent(settings.metaCapiToken)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn("[attribution/capi]", res.status, text.slice(0, 300));
    }
  } catch (e) {
    console.warn("[attribution/capi]", e);
  }
}
