import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Google Sheets (optional until sync is used)
  GOOGLE_CLIENT_EMAIL: z.string().optional(),
  GOOGLE_PRIVATE_KEY: z.string().optional(),
  GOOGLE_SHEETS_SCOPES: z.string().optional(),
  // Sync cron protection
  SYNC_CRON_TOKEN: z.string().optional(),
  // Atrako event bridge (disabled until configured)
  ATRAKO_EVENTS_URL: z.string().url().optional(),
  ATRAKO_EVENTS_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    GOOGLE_CLIENT_EMAIL: process.env.GOOGLE_CLIENT_EMAIL,
    GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY,
    GOOGLE_SHEETS_SCOPES: process.env.GOOGLE_SHEETS_SCOPES ?? "https://www.googleapis.com/auth/spreadsheets.readonly",
    SYNC_CRON_TOKEN: process.env.SYNC_CRON_TOKEN,
    ATRAKO_EVENTS_URL: process.env.ATRAKO_EVENTS_URL,
    ATRAKO_EVENTS_TOKEN: process.env.ATRAKO_EVENTS_TOKEN,
  });

  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors;
    throw new Error(`Invalid environment: ${JSON.stringify(msg)}`);
  }
  return parsed.data;
}

export const env = loadEnv();
