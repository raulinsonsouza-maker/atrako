/**
 * OAuth Tray Commerce.
 * https://developers.tray.com.br/#autorizando-seu-aplicativo
 */

/** Normaliza host da loja (sem protocolo/path). */
export function normalizeTrayStoreHost(input: string): string | null {
  let raw = input.trim().toLowerCase();
  if (!raw) return null;
  raw = raw.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\s+/g, "");
  if (!raw.includes(".") || raw.length < 4) return null;
  if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(raw)) return null;
  return raw;
}

/** Garante api_address com https e path /web_api. */
export function normalizeTrayApiAddress(input: string): string | null {
  let raw = input.trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) {
    raw = `https://${raw}`;
  }
  try {
    const url = new URL(raw);
    let path = url.pathname.replace(/\/+$/, "");
    if (!path.endsWith("/web_api")) {
      path = path === "" || path === "/" ? "/web_api" : `${path}/web_api`;
    }
    return `${url.origin}${path}`;
  } catch {
    return null;
  }
}

export function buildTrayAuthorizeUrl(input: {
  storeHost: string;
  consumerKey: string;
  callback: string;
}): string {
  const url = new URL(`https://${input.storeHost}/auth.php`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("consumer_key", input.consumerKey);
  url.searchParams.set("callback", input.callback);
  return url.toString();
}

export type TrayTokenResponse = {
  access_token: string;
  refresh_token: string;
  date_expiration_access_token?: string;
  date_expiration_refresh_token?: string;
  api_host?: string;
  store_id?: string | number;
  message?: string;
  code?: string | number;
};

export async function exchangeTrayCode(input: {
  apiAddress: string;
  consumerKey: string;
  consumerSecret: string;
  code: string;
}): Promise<TrayTokenResponse> {
  const apiAddress = normalizeTrayApiAddress(input.apiAddress);
  if (!apiAddress) throw new Error("tray_api_address_invalid");

  const body = new URLSearchParams({
    consumer_key: input.consumerKey,
    consumer_secret: input.consumerSecret,
    code: input.code,
  });

  const res = await fetch(`${apiAddress}/auth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });
  const text = await res.text().catch(() => "");
  let json: TrayTokenResponse;
  try {
    json = JSON.parse(text) as TrayTokenResponse;
  } catch {
    throw new Error(`tray_token_failed:${res.status}:${text.slice(0, 200)}`);
  }
  if (!res.ok || !json.access_token) {
    throw new Error(
      `tray_token_failed:${res.status}:${json.message || text.slice(0, 200)}`,
    );
  }
  return json;
}

export async function refreshTrayAccessToken(input: {
  apiAddress: string;
  refreshToken: string;
}): Promise<TrayTokenResponse> {
  const apiAddress = normalizeTrayApiAddress(input.apiAddress);
  if (!apiAddress) throw new Error("tray_api_address_invalid");

  const url = new URL(`${apiAddress}/auth`);
  url.searchParams.set("refresh_token", input.refreshToken);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const text = await res.text().catch(() => "");
  let json: TrayTokenResponse;
  try {
    json = JSON.parse(text) as TrayTokenResponse;
  } catch {
    throw new Error(`tray_refresh_failed:${res.status}:${text.slice(0, 200)}`);
  }
  if (!res.ok || !json.access_token) {
    throw new Error(
      `tray_refresh_failed:${res.status}:${json.message || text.slice(0, 200)}`,
    );
  }
  return json;
}

/** Parse "YYYY-MM-DD HH:mm:ss" Tray → ISO ou null. */
export function parseTrayDateTime(raw: string | null | undefined): string | null {
  if (!raw || raw.startsWith("0000")) return null;
  const normalized = raw.trim().replace(" ", "T");
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
