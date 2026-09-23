import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceConfig, patchWorkspaceSettings } from "@/lib/config/getWorkspaceConfig";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { assertCanManageConfig } from "@/lib/tenancy/workspace";
import { normalizePrimaryHex } from "@/lib/brand/primaryColor";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  const ws = await findWorkspaceById(workspaceId);
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  try {
    await assertCanManageConfig(workspaceId);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = await getWorkspaceConfig(workspaceId);
  return NextResponse.json(config);
}

export async function PATCH(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const workspaceId = typeof b.workspaceId === "string" ? b.workspaceId : "";
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  const ws = await findWorkspaceById(workspaceId);
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  try {
    await assertCanManageConfig(workspaceId);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let primaryColor: string | null | undefined;
  if (b.primaryColor === null) {
    primaryColor = null;
  } else if (typeof b.primaryColor === "string") {
    const normalized = normalizePrimaryHex(b.primaryColor);
    if (!normalized) {
      return NextResponse.json(
        { error: "primaryColor inválida — use hex #RRGGBB" },
        { status: 400 }
      );
    }
    primaryColor = normalized;
  } else {
    primaryColor = undefined;
  }

  await patchWorkspaceSettings(workspaceId, {
    timezone: typeof b.timezone === "string" ? b.timezone : undefined,
    currency: typeof b.currency === "string" ? b.currency : undefined,
    locale: typeof b.locale === "string" ? b.locale : undefined,
    primaryColor,
    customDomain:
      typeof b.customDomain === "string"
        ? b.customDomain
        : b.customDomain === null
          ? null
          : undefined,
    onboardingStep: typeof b.onboardingStep === "string" ? b.onboardingStep : undefined,
    nome: typeof b.nome === "string" ? b.nome : undefined,
    logoUrl:
      typeof b.logoUrl === "string" ? b.logoUrl : b.logoUrl === null ? null : undefined,
    modulesEnabled:
      b.modulesEnabled && typeof b.modulesEnabled === "object"
        ? (b.modulesEnabled as Record<string, boolean>)
        : undefined,
    tracking:
      b.tracking && typeof b.tracking === "object"
        ? (b.tracking as Record<string, unknown>)
        : undefined,
    financePrefs:
      b.financePrefs && typeof b.financePrefs === "object"
        ? (b.financePrefs as Record<string, unknown>)
        : undefined,
    notifyPrefs:
      b.notifyPrefs && typeof b.notifyPrefs === "object"
        ? (b.notifyPrefs as Record<string, unknown>)
        : undefined,
    formsPrefs:
      b.formsPrefs && typeof b.formsPrefs === "object"
        ? (b.formsPrefs as Record<string, unknown>)
        : undefined,
  });

  const config = await getWorkspaceConfig(workspaceId);
  return NextResponse.json(config);
}
