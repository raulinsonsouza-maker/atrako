import { prisma } from "@/lib/prisma";

export function parseNotifyEmails(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e): e is string => typeof e === "string")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  } catch {
    return raw
      .split(/[,;]/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  }
}

export function serializeNotifyEmails(emails: string[]): string {
  const unique = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  return JSON.stringify(unique);
}

export async function resolveIntakeAlertRecipients(params: {
  productNotifyEmails: string | null;
  productAlertsEnabled: boolean;
  orgNotifyEmails: string | null;
  orgAlertsEnabled: boolean;
  organizationId: string;
}): Promise<string[]> {
  if (!params.productAlertsEnabled && !params.orgAlertsEnabled) return [];

  const fromProduct = parseNotifyEmails(params.productNotifyEmails);
  if (fromProduct.length > 0) return fromProduct;

  const fromOrg = parseNotifyEmails(params.orgNotifyEmails);
  if (fromOrg.length > 0) return fromOrg;

  const owner = await prisma.membership.findFirst({
    where: { organizationId: params.organizationId, role: "OWNER" },
    include: { user: { select: { email: true } } },
  });
  if (owner?.user.email) return [owner.user.email.toLowerCase()];
  return [];
}
