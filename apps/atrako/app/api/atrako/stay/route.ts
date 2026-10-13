import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { requireModuleApi } from "@/lib/modules/resolve";
import { asFeatures, asHighlights, asPhotos, ensureStayWorkspace, publicProperty } from "@/lib/stay/catalog";
import { stayCanManage, stayPanelRole } from "@/lib/stay/panel";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

async function loadProperty(workspaceId: string) {
  let property = await prisma.stayProperty.findUnique({ where: { clienteId: workspaceId } });
  if (!property) {
    await ensureStayWorkspace(workspaceId);
    property = await prisma.stayProperty.findUnique({ where: { clienteId: workspaceId } });
  }
  return property;
}

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  const moduleOff = await requireModuleApi(workspaceId, "hospedagem");
  if (moduleOff) return moduleOff;
  const property = await loadProperty(workspaceId);
  return NextResponse.json({
    property: property
      ? {
          ...publicProperty(property),
          id: property.id,
          published: property.published,
          photos: asPhotos(property.photos),
          features: asFeatures(property.features),
          highlights: asHighlights(property.highlights),
        }
      : null,
    role: await stayPanelRole(workspaceId),
  });
}

export async function PATCH(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  const access = await requireWorkspaceAccess(workspaceId, "manage");
  if (!access.ok) return access.response;
  if (!stayCanManage(await stayPanelRole(workspaceId))) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  const moduleOff = await requireModuleApi(workspaceId, "hospedagem");
  if (moduleOff) return moduleOff;
  const property = await loadProperty(workspaceId);
  if (!property) return NextResponse.json({ error: "Imóvel não encontrado" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 160);
  if (typeof body.headline === "string") data.headline = body.headline.trim().slice(0, 200);
  if (typeof body.story === "string") data.story = body.story.trim().slice(0, 4000);
  if (typeof body.concept === "string") data.concept = body.concept.trim().slice(0, 2000);
  if (typeof body.acceptingBookings === "boolean") data.acceptingBookings = body.acceptingBookings;
  if (typeof body.published === "boolean") data.published = body.published;
  if (Number.isInteger(body.nightlyCents) && Number(body.nightlyCents) >= 0) data.nightlyCents = Number(body.nightlyCents);
  if (Number.isInteger(body.cleaningFeeCents) && Number(body.cleaningFeeCents) >= 0) data.cleaningFeeCents = Number(body.cleaningFeeCents);
  if (Number.isInteger(body.minNights) && Number(body.minNights) >= 1) data.minNights = Number(body.minNights);
  if (Number.isInteger(body.maxNights) && Number(body.maxNights) >= 1) data.maxNights = Number(body.maxNights);
  if (typeof body.checkInTime === "string" && TIME.test(body.checkInTime)) data.checkInTime = body.checkInTime;
  if (typeof body.checkOutTime === "string" && TIME.test(body.checkOutTime)) data.checkOutTime = body.checkOutTime;
  if (Number.isInteger(body.heroFrameCount) && Number(body.heroFrameCount) >= 0) data.heroFrameCount = Number(body.heroFrameCount);
  if (Array.isArray(body.photos)) data.photos = asPhotos(body.photos);
  const minNights = (data.minNights as number | undefined) ?? property.minNights;
  const maxNights = (data.maxNights as number | undefined) ?? property.maxNights;
  if (maxNights < minNights) return NextResponse.json({ error: "O máximo de noites precisa ser maior que o mínimo." }, { status: 400 });
  if (!Object.keys(data).length) return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });

  const fresh = await prisma.stayProperty.update({ where: { id: property.id }, data });
  return NextResponse.json({ property: { ...publicProperty(fresh), id: fresh.id, published: fresh.published } });
}
