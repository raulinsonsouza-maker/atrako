import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { getIntegrationsConfig } from "@/lib/config/integrations";

export interface Ga4Credentials {
  type: string;
  project_id?: string;
  private_key_id?: string;
  private_key: string;
  client_email: string;
  client_id?: string;
  auth_uri?: string;
  token_uri?: string;
}

function parseCredentials(jsonStr: string | null): Ga4Credentials | null {
  if (!jsonStr?.trim()) return null;
  try {
    const parsed = JSON.parse(jsonStr) as Ga4Credentials;
    if (parsed.type === "service_account" && parsed.private_key && parsed.client_email) {
      return parsed;
    }
  } catch {
    // invalid JSON
  }
  return null;
}

let cachedClient: BetaAnalyticsDataClient | null = null;

async function getGa4Client(): Promise<BetaAnalyticsDataClient> {
  if (cachedClient) return cachedClient;

  const config = await getIntegrationsConfig();
  const creds = parseCredentials(config.googleAnalyticsCredentials);

  if (!creds) {
    throw new Error(
      "Google Analytics: credenciais não configuradas. Defina GOOGLE_ANALYTICS_CREDENTIALS (env) ou google_analytics_credentials (SystemConfig)"
    );
  }

  cachedClient = new BetaAnalyticsDataClient({
    credentials: {
      client_email: creds.client_email,
      private_key: creds.private_key.replace(/\\n/g, "\n"),
    },
  });

  return cachedClient;
}

export interface Ga4DailyRow {
  date: string;
  sessions: number;
  activeUsers: number;
  engagedSessions: number;
  engagementRate: number;
  bounceRate: number;
  averageSessionDuration: number;
  newUsers: number;
  screenPageViews: number;
}

function getMetricValue(row: { metricValues?: unknown }, index: number): number {
  const vals = row.metricValues;
  if (!vals || !Array.isArray(vals)) return 0;
  const item = vals[index];
  const val = item && typeof item === "object" && "value" in item ? (item as { value?: string }).value : undefined;
  if (val === undefined || val === null || val === "") return 0;
  const n = parseFloat(val);
  return Number.isNaN(n) ? 0 : n;
}

export async function fetchDailyReport(
  propertyId: string,
  dateFrom: string,
  dateTo: string
): Promise<Ga4DailyRow[]> {
  const normalized = propertyId.replace(/\D/g, "");
  if (!normalized) {
    throw new Error("Google Analytics: property_id inválido (deve conter apenas dígitos)");
  }

  const client = await getGa4Client();

  const [response] = await client.runReport({
    property: `properties/${normalized}`,
    dateRanges: [{ startDate: dateFrom, endDate: dateTo }],
    dimensions: [{ name: "date" }],
    metrics: [
      { name: "sessions" },
      { name: "activeUsers" },
      { name: "engagedSessions" },
      { name: "engagementRate" },
      { name: "bounceRate" },
      { name: "averageSessionDuration" },
      { name: "newUsers" },
      { name: "screenPageViews" },
    ],
  });

  const rows: Ga4DailyRow[] = [];

  for (const row of response.rows ?? []) {
    const dateStr = row.dimensionValues?.[0]?.value ?? "";
    if (!dateStr) continue;

    rows.push({
      date: dateStr,
      sessions: Math.round(getMetricValue(row, 0)),
      activeUsers: Math.round(getMetricValue(row, 1)),
      engagedSessions: Math.round(getMetricValue(row, 2)),
      engagementRate: getMetricValue(row, 3),
      bounceRate: getMetricValue(row, 4),
      averageSessionDuration: Math.round(getMetricValue(row, 5)),
      newUsers: Math.round(getMetricValue(row, 6)),
      screenPageViews: Math.round(getMetricValue(row, 7)),
    });
  }

  return rows;
}

export interface Ga4ChannelRow {
  date: string;
  canal: string;
  sessions: number;
  activeUsers: number;
}

export async function fetchChannelReport(
  propertyId: string,
  dateFrom: string,
  dateTo: string
): Promise<Ga4ChannelRow[]> {
  const normalized = propertyId.replace(/\D/g, "");
  if (!normalized) {
    throw new Error("Google Analytics: property_id inválido (deve conter apenas dígitos)");
  }

  const client = await getGa4Client();

  const [response] = await client.runReport({
    property: `properties/${normalized}`,
    dateRanges: [{ startDate: dateFrom, endDate: dateTo }],
    dimensions: [
      { name: "date" },
      { name: "sessionDefaultChannelGroup" },
    ],
    metrics: [{ name: "sessions" }, { name: "activeUsers" }],
  });

  const rows: Ga4ChannelRow[] = [];

  for (const row of response.rows ?? []) {
    const dateStr = row.dimensionValues?.[0]?.value ?? "";
    const canal = row.dimensionValues?.[1]?.value ?? "(not set)";
    if (!dateStr) continue;

    rows.push({
      date: dateStr,
      canal,
      sessions: Math.round(getMetricValue(row, 0)),
      activeUsers: Math.round(getMetricValue(row, 1)),
    });
  }

  return rows;
}
