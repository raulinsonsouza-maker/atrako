import { google, calendar_v3 } from "googleapis";

type OAuthTokens = {
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | null;
};

function assertEnv(name: string) {
  if (!process.env[name]) throw new Error(`Missing env ${name}`);
}

export function getGoogleOAuthClient() {
  assertEnv("GOOGLE_CLIENT_ID");
  assertEnv("GOOGLE_CLIENT_SECRET");
  assertEnv("GOOGLE_REDIRECT_URI");
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getGoogleAuthUrl(state: string) {
  const oauth2 = getGoogleOAuthClient();
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar"],
    state,
  });
}

export async function exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
  const oauth2 = getGoogleOAuthClient();
  const { tokens } = await oauth2.getToken(code);
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
  const oauth2 = getGoogleOAuthClient();
  oauth2.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2.refreshAccessToken();
  return {
    accessToken: credentials.access_token,
    refreshToken: credentials.refresh_token ?? refreshToken,
    tokenExpiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
  };
}

export async function getCalendarClient(tokens: OAuthTokens) {
  const oauth2 = getGoogleOAuthClient();
  if (tokens.accessToken) {
    oauth2.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken ?? undefined,
      expiry_date: tokens.tokenExpiresAt?.getTime(),
    });
  } else if (tokens.refreshToken) {
    const refreshed = await refreshAccessToken(tokens.refreshToken);
    oauth2.setCredentials({
      access_token: refreshed.accessToken ?? undefined,
      refresh_token: refreshed.refreshToken ?? undefined,
      expiry_date: refreshed.tokenExpiresAt?.getTime(),
    });
  }
  return google.calendar({ version: "v3", auth: oauth2 });
}

export async function listCalendars(tokens: OAuthTokens) {
  const calendar = await getCalendarClient(tokens);
  const res = await calendar.calendarList.list();
  return res.data.items ?? [];
}

export async function createEvent(
  calendarId: string,
  event: calendar_v3.Schema$Event,
  tokens: OAuthTokens
) {
  const calendar = await getCalendarClient(tokens);
  const res = await calendar.events.insert({ calendarId, requestBody: event });
  return res.data;
}

export async function updateEvent(
  calendarId: string,
  eventId: string,
  event: calendar_v3.Schema$Event,
  tokens: OAuthTokens
) {
  const calendar = await getCalendarClient(tokens);
  const res = await calendar.events.update({ calendarId, eventId, requestBody: event });
  return res.data;
}

export async function deleteEvent(calendarId: string, eventId: string, tokens: OAuthTokens) {
  const calendar = await getCalendarClient(tokens);
  await calendar.events.delete({ calendarId, eventId });
}

export async function listEventChanges(opts: {
  calendarId: string;
  tokens: OAuthTokens;
  syncToken?: string | null;
  timeMin?: string;
}) {
  const calendar = await getCalendarClient(opts.tokens);
  const res = await calendar.events.list({
    calendarId: opts.calendarId,
    syncToken: opts.syncToken ?? undefined,
    timeMin: opts.syncToken ? undefined : opts.timeMin,
    singleEvents: true,
    showDeleted: true,
  });
  return res.data;
}

export async function listEvents(opts: {
  calendarId: string;
  tokens: OAuthTokens;
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
}) {
  const calendar = await getCalendarClient(opts.tokens);
  const res = await calendar.events.list({
    calendarId: opts.calendarId,
    timeMin: opts.timeMin,
    timeMax: opts.timeMax,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: opts.maxResults ?? 50,
  });
  return res.data.items ?? [];
}

export async function watchCalendar(opts: {
  calendarId: string;
  tokens: OAuthTokens;
  channelId: string;
  webhookUrl: string;
  token?: string;
}) {
  const calendar = await getCalendarClient(opts.tokens);
  const res = await calendar.events.watch({
    calendarId: opts.calendarId,
    requestBody: {
      id: opts.channelId,
      type: "web_hook",
      address: opts.webhookUrl,
      token: opts.token,
    },
  });
  return res.data;
}
