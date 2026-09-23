import { NextResponse } from "next/server";
import { DEFAULT_PANEL_LOGO, getPanelLogoUrl } from "@/lib/config/branding";

/** Logo do painel (header) — público para o frontend. */
export async function GET() {
  try {
    const custom = await getPanelLogoUrl();
    return NextResponse.json({
      panelLogoUrl: custom,
      defaultLogoUrl: DEFAULT_PANEL_LOGO,
      logoUrl: custom ?? DEFAULT_PANEL_LOGO,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
