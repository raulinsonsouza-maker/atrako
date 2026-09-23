import { NextRequest, NextResponse } from "next/server";
import { getIntegrationsConfig, updateIntegrationsConfig } from "@/lib/config/integrations";

function isAdminAuthorized(request: NextRequest): boolean {
  const token = request.headers.get("x-admin-token") ?? request.nextUrl.searchParams.get("token");
  const expected = process.env.ADMIN_SECRET;
  if (!expected) return true;
  return token === expected;
}

function buildResponse(config: Awaited<ReturnType<typeof getIntegrationsConfig>>) {
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
  };
}

export async function GET(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const config = await getIntegrationsConfig();
    return NextResponse.json(buildResponse(config));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    const config = await getIntegrationsConfig();
    return NextResponse.json({ ok: true, ...buildResponse(config) });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
