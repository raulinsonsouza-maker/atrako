import { prisma } from "@/lib/db";
import { DEFAULT_PANEL_LOGO, PANEL_LOGO_KEY } from "@/lib/config/branding-constants";

export { DEFAULT_PANEL_LOGO };

export async function getPanelLogoUrl(): Promise<string | null> {
  const row = await prisma.systemConfig.findUnique({
    where: { key: PANEL_LOGO_KEY },
  });
  const value = row?.value?.trim();
  return value || null;
}

export async function setPanelLogoUrl(url: string | null): Promise<void> {
  const trimmed = url?.trim() ?? "";
  if (!trimmed) {
    await prisma.systemConfig.deleteMany({ where: { key: PANEL_LOGO_KEY } });
    return;
  }
  await prisma.systemConfig.upsert({
    where: { key: PANEL_LOGO_KEY },
    create: { key: PANEL_LOGO_KEY, value: trimmed },
    update: { value: trimmed },
  });
}
