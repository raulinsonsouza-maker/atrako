import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_PANEL_LOGO,
  getPanelLogoUrl,
  setPanelLogoUrl,
} from "@/lib/config/branding";

function isAdminAuthorized(request: NextRequest): boolean {
  const token = request.headers.get("x-admin-token") ?? request.nextUrl.searchParams.get("token");
  const expected = process.env.ADMIN_SECRET;
  if (!expected) return true;
  return token === expected;
}

export async function GET(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const panelLogoUrl = await getPanelLogoUrl();
    return NextResponse.json({
      panelLogoUrl: panelLogoUrl ?? "",
      defaultLogoUrl: DEFAULT_PANEL_LOGO,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { panelLogoUrl?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.panelLogoUrl === undefined) {
    return NextResponse.json({ error: "panelLogoUrl é obrigatório" }, { status: 400 });
  }

  try {
    await setPanelLogoUrl(body.panelLogoUrl || null);
    const panelLogoUrl = await getPanelLogoUrl();
    return NextResponse.json({
      ok: true,
      panelLogoUrl: panelLogoUrl ?? "",
      defaultLogoUrl: DEFAULT_PANEL_LOGO,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
