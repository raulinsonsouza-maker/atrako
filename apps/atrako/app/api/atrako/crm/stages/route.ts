import { NextRequest, NextResponse } from "next/server";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { assertCanOperateWorkspace } from "@/lib/tenancy/workspace";
import {
  configurePipelineStages,
  createPipelineStage,
  updatePipelineStage,
} from "@/lib/modules/crm";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const workspaceId = typeof b.workspaceId === "string" ? b.workspaceId : "";
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId obrigatório" }, { status: 400 });
  }
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  try {
    await assertCanOperateWorkspace(workspaceId);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  /** Salvar funil completo (modal configurar). */
  if (b.action === "configure") {
    const middleRaw = Array.isArray(b.middle) ? b.middle : [];
    const middle = middleRaw.flatMap((row) => {
      if (!row || typeof row !== "object") return [];
      const o = row as Record<string, unknown>;
      return [
        {
          id: typeof o.id === "string" ? o.id : undefined,
          name: typeof o.name === "string" ? o.name : "",
          color: typeof o.color === "string" ? o.color : "#8E8E93",
        },
      ];
    });
    try {
      const pipeline = await configurePipelineStages({
        workspaceId,
        middle,
        entryName: typeof b.entryName === "string" ? b.entryName : undefined,
        entryColor: typeof b.entryColor === "string" ? b.entryColor : undefined,
        wonName: typeof b.wonName === "string" ? b.wonName : undefined,
        wonColor: typeof b.wonColor === "string" ? b.wonColor : undefined,
      });
      return NextResponse.json({
        stages: pipeline.stages.map((s) => ({
          id: s.id,
          name: s.name,
          color: s.color,
          order: s.order,
          role: s.role,
        })),
      });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Falha ao salvar funil" },
        { status: 400 },
      );
    }
  }

  const name = typeof b.name === "string" ? b.name : "";
  const color = typeof b.color === "string" ? b.color : undefined;
  if (!name.trim()) {
    return NextResponse.json({ error: "name obrigatório" }, { status: 400 });
  }
  try {
    const stage = await createPipelineStage({ workspaceId, name, color });
    return NextResponse.json(
      { id: stage.id, name: stage.name, color: stage.color, order: stage.order },
      { status: 201 },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha ao criar" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const workspaceId = typeof b.workspaceId === "string" ? b.workspaceId : "";
  const stageId = typeof b.stageId === "string" ? b.stageId : "";
  if (!workspaceId || !stageId) {
    return NextResponse.json({ error: "workspaceId e stageId obrigatórios" }, { status: 400 });
  }
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  try {
    await assertCanOperateWorkspace(workspaceId);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const stage = await updatePipelineStage({
      workspaceId,
      stageId,
      name: typeof b.name === "string" ? b.name : undefined,
      color: typeof b.color === "string" ? b.color : b.color === null ? null : undefined,
    });
    return NextResponse.json({
      id: stage.id,
      name: stage.name,
      color: stage.color,
      order: stage.order,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha ao atualizar" },
      { status: 400 },
    );
  }
}
