import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { bad, gate, readBody, str } from "@/lib/flows/api";
import { setEnrollmentStatus } from "@/lib/flows/engine";
import { parseBirthDate, upsertContactBirthday } from "@/lib/flows/important-dates";

type Ctx = { params: Promise<{ id: string }> };

/** Ações do card: pausar/retomar/remover do fluxo, aniversário, retomar fluxos pausados por resposta. */
export async function POST(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await readBody(request);
  if (!body) return bad("Invalid JSON");
  const g = await gate(request, "operate", body);
  if (!g.ok) return g.response;
  const ws = g.workspaceId;
  const lead = await prisma.nativeLead.findFirst({ where: { id, clienteId: ws }, select: { contactId: true } });
  if (!lead?.contactId) return bad("Lead sem contato", 404);
  const action = str(body.action);

  if (action === "pause" || action === "resume" || action === "remove") {
    const enrollmentId = str(body.enrollmentId);
    const e = await prisma.messageFlowEnrollment.findFirst({
      where: { id: enrollmentId, clienteId: ws, contactId: lead.contactId },
      select: { id: true },
    });
    if (!e) return bad("Matrícula não encontrada", 404);
    await setEnrollmentStatus(ws, e.id, action);
    return NextResponse.json({ ok: true });
  }

  if (action === "birthday") {
    const raw = str(body.value);
    if (!raw) {
      await prisma.contactImportantDate.deleteMany({ where: { contactId: lead.contactId, kind: "BIRTHDAY" } });
      return NextResponse.json({ ok: true });
    }
    if (!parseBirthDate(raw)) return bad("Data inválida — use DD/MM ou DD/MM/AAAA");
    await upsertContactBirthday({ workspaceId: ws, contactId: lead.contactId, raw, source: "manual", overwrite: true });
    return NextResponse.json({ ok: true });
  }

  if (action === "unpause_flows") {
    await prisma.nativeContact.updateMany({
      where: { id: lead.contactId, clienteId: ws },
      data: { flowsPausedUntil: null },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "consent") {
    await prisma.nativeContact.updateMany({
      where: { id: lead.contactId, clienteId: ws },
      data: body.value === true ? { marketingConsentAt: new Date(), consentSource: "manual" } : { marketingConsentAt: null },
    });
    return NextResponse.json({ ok: true });
  }

  return bad("Ação inválida");
}
