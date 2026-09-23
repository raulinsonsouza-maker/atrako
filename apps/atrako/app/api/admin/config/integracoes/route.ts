import { NextRequest, NextResponse } from "next/server";
import { getIntegrationsConfig, updateIntegrationsConfig } from "@/lib/config/integrations";
import { prisma } from "@/lib/db";
import { requireInternalAdmin } from "@/lib/internalAccess";
import { writeAuditLog } from "@/lib/internalUsers";

async function buildResponse(config: Awaited<ReturnType<typeof getIntegrationsConfig>>) {
  let globalSyncSuccessAt: string | null = null;
  let globalSyncAttemptAt: string | null = null;
  try {
    const state = await prisma.syncState.findUnique({ where: { id: "global" } });
    globalSyncSuccessAt = state?.successAt?.toISOString() ?? null;
    globalSyncAttemptAt = state?.attemptAt?.toISOString() ?? null;
  } catch {
    // SyncState may not exist yet
  }

  return {
    metaAdAccountId: config.metaAdAccountId ?? "",
    hasMetaAccessToken: !!config.metaAccessToken,
    hasGoogleDeveloperToken: !!config.googleDeveloperToken,
    hasGoogleRefreshToken: !!config.googleRefreshToken,
    hasGoogleClientId: !!config.googleClientId,
    hasGoogleClientSecret: !!config.googleClientSecret,
    googleLoginCustomerId: config.googleLoginCustomerId ?? "",
    alertNotificationEmail: config.alertNotificationEmail ?? "",
    alertWebhookUrl: config.alertWebhookUrl ?? "",
    alertSmtpHost: config.alertSmtpHost ?? "",
    alertSmtpPort: config.alertSmtpPort ?? "",
    alertSmtpUser: config.alertSmtpUser ?? "",
    hasAlertSmtpPass: !!config.alertSmtpPass,
    alertSmtpFrom: config.alertSmtpFrom ?? "",
    alertBalanceThresholdDays: config.alertBalanceThresholdDays ?? "",
    alertSpendGapDays: config.alertSpendGapDays ?? "",
    hasTelegramBotToken: !!config.telegramBotToken,
    telegramChannelId: config.telegramChannelId ?? "",
    globalSyncSuccessAt,
    globalSyncAttemptAt,
  };
}

export async function GET(request: NextRequest) {
  const access = await requireInternalAdmin();
  if (access.response) return access.response;

  try {
    const config = await getIntegrationsConfig();
    return NextResponse.json(await buildResponse(config));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const access = await requireInternalAdmin();
  if (access.response) return access.response;

  let body: {
    metaAccessToken?: string;
    metaAdAccountId?: string;
    googleDeveloperToken?: string;
    googleRefreshToken?: string;
    googleClientId?: string;
    googleClientSecret?: string;
    googleLoginCustomerId?: string;
    alertNotificationEmail?: string;
    alertWebhookUrl?: string;
    alertSmtpHost?: string;
    alertSmtpPort?: string;
    alertSmtpUser?: string;
    alertSmtpPass?: string;
    alertSmtpFrom?: string;
    alertBalanceThresholdDays?: string;
    alertSpendGapDays?: string;
    telegramBotToken?: string;
    telegramChannelId?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.alertBalanceThresholdDays !== undefined) {
    const num = Number(body.alertBalanceThresholdDays);
    if (!Number.isInteger(num) || num < 1) {
      return NextResponse.json({ error: "alertBalanceThresholdDays deve ser um inteiro positivo." }, { status: 400 });
    }
    body.alertBalanceThresholdDays = String(num);
  }

  if (body.alertSpendGapDays !== undefined) {
    const num = Number(body.alertSpendGapDays);
    if (!Number.isInteger(num) || num < 1) {
      return NextResponse.json({ error: "alertSpendGapDays deve ser um inteiro positivo." }, { status: 400 });
    }
    body.alertSpendGapDays = String(num);
  }

  try {
    await updateIntegrationsConfig(body);
    const auditableFields = [
      "metaAccessToken", "metaAdAccountId", "googleDeveloperToken", "googleRefreshToken",
      "googleClientId", "googleClientSecret", "googleLoginCustomerId", "alertNotificationEmail",
      "alertWebhookUrl", "alertSmtpHost", "alertSmtpPort", "alertSmtpUser", "alertSmtpPass",
      "alertSmtpFrom", "alertBalanceThresholdDays", "alertSpendGapDays", "telegramBotToken",
      "telegramChannelId",
    ];
    await writeAuditLog({
      action: "INTEGRATION_CONFIG_UPDATED",
      actorInternalUserId: access.user.id,
      metadata: {
        operationType: "update",
        changedFields: auditableFields.filter((field) => body[field as keyof typeof body] !== undefined),
      },
    });
    const config = await getIntegrationsConfig();
    return NextResponse.json({ ok: true, ...(await buildResponse(config)) });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
