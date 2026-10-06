import { NextRequest, NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/internalAccess";
import { getModuleReleases, setModuleRelease } from "@/lib/modules/resolve";
import { MODULES, getModuleDef, isModuleKey, isModuleRelease } from "@/lib/modules/registry";

async function listModules() {
  const releases = await getModuleReleases();
  return MODULES.map((m) => ({
    key: m.key,
    core: Boolean(m.core),
    defaultRelease: m.defaultRelease,
    release: m.core ? "AVAILABLE" : releases[m.key],
  }));
}

export async function GET() {
  const authz = await requireInternalAdmin();
  if (authz.response) return authz.response;
  return NextResponse.json({ modules: await listModules() });
}

export async function PATCH(request: NextRequest) {
  const authz = await requireInternalAdmin();
  if (authz.response) return authz.response;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const key = typeof body.key === "string" ? body.key : "";
  const release = typeof body.release === "string" ? body.release : "";
  if (!isModuleKey(key)) {
    return NextResponse.json({ error: "Módulo inválido." }, { status: 400 });
  }
  if (!isModuleRelease(release)) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }
  if (getModuleDef(key).core) {
    return NextResponse.json({ error: "Módulos do núcleo ficam sempre disponíveis." }, { status: 400 });
  }
  await setModuleRelease(key, release);
  return NextResponse.json({ ok: true, modules: await listModules() });
}
