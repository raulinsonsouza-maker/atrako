import { prisma } from "@/lib/db";

const KEYS = {
  metaAccessToken: "meta_access_token",
  metaAdAccountId: "meta_ad_account_id",
  googleDeveloperToken: "google_ads_developer_token",
  googleRefreshToken: "google_ads_refresh_token",
  googleClientId: "google_ads_client_id",
  googleClientSecret: "google_ads_client_secret",
  googleLoginCustomerId: "google_ads_login_customer_id",
  googleAnalyticsCredentials: "google_analytics_credentials",
  alertNotificationEmail: "alert_notification_email",
  alertWebhookUrl: "alert_webhook_url",
  alertSmtpHost: "alert_smtp_host",
  alertSmtpPort: "alert_smtp_port",
  alertSmtpUser: "alert_smtp_user",
  alertSmtpPass: "alert_smtp_pass",
  alertSmtpFrom: "alert_smtp_from",
  alertBalanceThresholdDays: "alert_balance_threshold_days",
  alertSpendGapDays: "alert_spend_gap_days",
} as const;

export interface IntegrationsConfig {
  metaAccessToken: string | null;
  metaAdAccountId: string | null;
  googleDeveloperToken: string | null;
  googleRefreshToken: string | null;
  googleClientId: string | null;
  googleClientSecret: string | null;
  googleLoginCustomerId: string | null;
  googleAnalyticsCredentials: string | null;
  alertNotificationEmail: string | null;
  alertWebhookUrl: string | null;
  alertSmtpHost: string | null;
  alertSmtpPort: string | null;
  alertSmtpUser: string | null;
  alertSmtpPass: string | null;
  alertSmtpFrom: string | null;
  alertBalanceThresholdDays: string | null;
  alertSpendGapDays: string | null;
}

export async function getIntegrationsConfig(): Promise<IntegrationsConfig> {
  const rows = await prisma.systemConfig.findMany({
    where: {
      key: {
        in: [
          KEYS.metaAccessToken,
          KEYS.metaAdAccountId,
          KEYS.googleDeveloperToken,
          KEYS.googleRefreshToken,
          KEYS.googleClientId,
          KEYS.googleClientSecret,
          KEYS.googleLoginCustomerId,
          KEYS.googleAnalyticsCredentials,
          KEYS.alertNotificationEmail,
          KEYS.alertWebhookUrl,
          KEYS.alertSmtpHost,
          KEYS.alertSmtpPort,
          KEYS.alertSmtpUser,
          KEYS.alertSmtpPass,
          KEYS.alertSmtpFrom,
          KEYS.alertBalanceThresholdDays,
          KEYS.alertSpendGapDays,
        ],
      },
    },
  });

  const map = new Map(rows.map((r) => [r.key, r.value]));

  return {
    metaAccessToken: map.get(KEYS.metaAccessToken) ?? null,
    metaAdAccountId: map.get(KEYS.metaAdAccountId) ?? null,
    googleDeveloperToken: map.get(KEYS.googleDeveloperToken) ?? null,
    googleRefreshToken: map.get(KEYS.googleRefreshToken) ?? null,
    googleClientId: map.get(KEYS.googleClientId) ?? null,
    googleClientSecret: map.get(KEYS.googleClientSecret) ?? null,
    googleLoginCustomerId:
      map.get(KEYS.googleLoginCustomerId) ?? process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? null,
    googleAnalyticsCredentials:
      process.env.GOOGLE_ANALYTICS_CREDENTIALS ?? map.get(KEYS.googleAnalyticsCredentials) ?? null,
    alertNotificationEmail: map.get(KEYS.alertNotificationEmail) ?? null,
    alertWebhookUrl: map.get(KEYS.alertWebhookUrl) ?? null,
    alertSmtpHost: map.get(KEYS.alertSmtpHost) ?? null,
    alertSmtpPort: map.get(KEYS.alertSmtpPort) ?? null,
    alertSmtpUser: map.get(KEYS.alertSmtpUser) ?? null,
    alertSmtpPass: map.get(KEYS.alertSmtpPass) ?? null,
    alertSmtpFrom: map.get(KEYS.alertSmtpFrom) ?? null,
    alertBalanceThresholdDays: map.get(KEYS.alertBalanceThresholdDays) ?? null,
    alertSpendGapDays: map.get(KEYS.alertSpendGapDays) ?? null,
  };
}

export async function updateIntegrationsConfig(data: {
  metaAccessToken?: string;
  metaAdAccountId?: string;
  googleDeveloperToken?: string;
  googleRefreshToken?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  googleLoginCustomerId?: string;
  googleAnalyticsCredentials?: string;
  alertNotificationEmail?: string;
  alertWebhookUrl?: string;
  alertSmtpHost?: string;
  alertSmtpPort?: string;
  alertSmtpUser?: string;
  alertSmtpPass?: string;
  alertSmtpFrom?: string;
  alertBalanceThresholdDays?: string;
  alertSpendGapDays?: string;
}) {
  const ops = [];

  if (data.metaAccessToken !== undefined) {
    ops.push(
      prisma.systemConfig.upsert({
        where: { key: KEYS.metaAccessToken },
        create: { key: KEYS.metaAccessToken, value: data.metaAccessToken.trim() },
        update: { value: data.metaAccessToken.trim() },
      })
    );
  }

  if (data.metaAdAccountId !== undefined) {
    ops.push(
      prisma.systemConfig.upsert({
        where: { key: KEYS.metaAdAccountId },
        create: { key: KEYS.metaAdAccountId, value: data.metaAdAccountId.trim() },
        update: { value: data.metaAdAccountId.trim() },
      })
    );
  }

  if (data.googleDeveloperToken !== undefined) {
    ops.push(
      prisma.systemConfig.upsert({
        where: { key: KEYS.googleDeveloperToken },
        create: { key: KEYS.googleDeveloperToken, value: data.googleDeveloperToken.trim() },
        update: { value: data.googleDeveloperToken.trim() },
      })
    );
  }

  if (data.googleRefreshToken !== undefined) {
    ops.push(
      prisma.systemConfig.upsert({
        where: { key: KEYS.googleRefreshToken },
        create: { key: KEYS.googleRefreshToken, value: data.googleRefreshToken.trim() },
        update: { value: data.googleRefreshToken.trim() },
      })
    );
  }

  if (data.googleClientId !== undefined) {
    ops.push(
      prisma.systemConfig.upsert({
        where: { key: KEYS.googleClientId },
        create: { key: KEYS.googleClientId, value: data.googleClientId.trim() },
        update: { value: data.googleClientId.trim() },
      })
    );
  }

  if (data.googleClientSecret !== undefined) {
    ops.push(
      prisma.systemConfig.upsert({
        where: { key: KEYS.googleClientSecret },
        create: { key: KEYS.googleClientSecret, value: data.googleClientSecret.trim() },
        update: { value: data.googleClientSecret.trim() },
      })
    );
  }

  if (data.googleLoginCustomerId !== undefined) {
    ops.push(
      prisma.systemConfig.upsert({
        where: { key: KEYS.googleLoginCustomerId },
        create: { key: KEYS.googleLoginCustomerId, value: data.googleLoginCustomerId.replace(/\D/g, "") },
        update: { value: data.googleLoginCustomerId.replace(/\D/g, "") },
      })
    );
  }

  if (data.googleAnalyticsCredentials !== undefined) {
    ops.push(
      prisma.systemConfig.upsert({
        where: { key: KEYS.googleAnalyticsCredentials },
        create: {
          key: KEYS.googleAnalyticsCredentials,
          value: data.googleAnalyticsCredentials.trim(),
        },
        update: { value: data.googleAnalyticsCredentials.trim() },
      })
    );
  }

  if (data.alertNotificationEmail !== undefined) {
    ops.push(
      prisma.systemConfig.upsert({
        where: { key: KEYS.alertNotificationEmail },
        create: { key: KEYS.alertNotificationEmail, value: data.alertNotificationEmail.trim() },
        update: { value: data.alertNotificationEmail.trim() },
      })
    );
  }

  if (data.alertWebhookUrl !== undefined) {
    ops.push(
      prisma.systemConfig.upsert({
        where: { key: KEYS.alertWebhookUrl },
        create: { key: KEYS.alertWebhookUrl, value: data.alertWebhookUrl.trim() },
        update: { value: data.alertWebhookUrl.trim() },
      })
    );
  }

  if (data.alertSmtpHost !== undefined) {
    ops.push(
      prisma.systemConfig.upsert({
        where: { key: KEYS.alertSmtpHost },
        create: { key: KEYS.alertSmtpHost, value: data.alertSmtpHost.trim() },
        update: { value: data.alertSmtpHost.trim() },
      })
    );
  }

  if (data.alertSmtpPort !== undefined) {
    ops.push(
      prisma.systemConfig.upsert({
        where: { key: KEYS.alertSmtpPort },
        create: { key: KEYS.alertSmtpPort, value: data.alertSmtpPort.trim() },
        update: { value: data.alertSmtpPort.trim() },
      })
    );
  }

  if (data.alertSmtpUser !== undefined) {
    ops.push(
      prisma.systemConfig.upsert({
        where: { key: KEYS.alertSmtpUser },
        create: { key: KEYS.alertSmtpUser, value: data.alertSmtpUser.trim() },
        update: { value: data.alertSmtpUser.trim() },
      })
    );
  }

  if (data.alertSmtpPass !== undefined) {
    ops.push(
      prisma.systemConfig.upsert({
        where: { key: KEYS.alertSmtpPass },
        create: { key: KEYS.alertSmtpPass, value: data.alertSmtpPass.trim() },
        update: { value: data.alertSmtpPass.trim() },
      })
    );
  }

  if (data.alertSmtpFrom !== undefined) {
    ops.push(
      prisma.systemConfig.upsert({
        where: { key: KEYS.alertSmtpFrom },
        create: { key: KEYS.alertSmtpFrom, value: data.alertSmtpFrom.trim() },
        update: { value: data.alertSmtpFrom.trim() },
      })
    );
  }

  if (data.alertBalanceThresholdDays !== undefined) {
    ops.push(
      prisma.systemConfig.upsert({
        where: { key: KEYS.alertBalanceThresholdDays },
        create: { key: KEYS.alertBalanceThresholdDays, value: data.alertBalanceThresholdDays.trim() },
        update: { value: data.alertBalanceThresholdDays.trim() },
      })
    );
  }

  if (data.alertSpendGapDays !== undefined) {
    ops.push(
      prisma.systemConfig.upsert({
        where: { key: KEYS.alertSpendGapDays },
        create: { key: KEYS.alertSpendGapDays, value: data.alertSpendGapDays.trim() },
        update: { value: data.alertSpendGapDays.trim() },
      })
    );
  }

  if (ops.length === 0) return;

  await prisma.$transaction(ops);
}

