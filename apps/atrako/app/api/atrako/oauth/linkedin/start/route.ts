import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import {
  buildLinkedinAuthUrl,
  getPublicOrigin,
} from "@/lib/linkedin/linkedinClient";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  const access = await requireWorkspaceAccess(workspaceId, "manage");
  if (!access.ok) return access.response;
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const state = randomBytes(24).toString("hex");
  const redirectUri = `${getPublicOrigin(request)}/api/atrako/oauth/linkedin/callback`;
  await prisma.workspaceOAuthPending.create({
    data: {
      state,
      provider: "LINKEDIN_ADS",
      clienteId: workspaceId,
      redirectUri,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  const authUrl = await buildLinkedinAuthUrl(redirectUri, state);
  if (!authUrl) {
    return NextResponse.json({ error: "App LinkedIn não configurado em /admin/apps" }, { status: 503 });
  }
  return NextResponse.redirect(authUrl);
}
