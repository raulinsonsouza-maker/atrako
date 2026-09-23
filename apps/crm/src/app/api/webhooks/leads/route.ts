import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { LeadSource } from "@prisma/client";

/**
 * Webhook para receber leads de LP, Meta Lead Ads, Google Ads, etc.
 * Autenticação: header X-Api-Key ou body.apiKey ( Tenant.config.webhookApiKey )
 * Deduplicação por telefone (ou email se sem telefone).
 * Campos: name, phone?, email, origin?, campaign?, ad?, utm_source?, utm_medium?, utm_campaign?, utm_content?, utm_term?
 */
export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }

    const apiKey =
      (req.headers.get("x-api-key") as string)?.trim() ||
      (typeof body.apiKey === "string" ? body.apiKey.trim() : "");
    if (!apiKey) {
      return NextResponse.json({ error: "X-Api-Key ou apiKey obrigatório" }, { status: 401 });
    }

    const tenants = await db.tenant.findMany({ where: { status: "ACTIVE" }, select: { id: true, config: true } });
    const tenant = tenants.find((t) => (t.config as { webhookApiKey?: string } | null)?.webhookApiKey === apiKey);
    if (!tenant) {
      return NextResponse.json({ error: "ApiKey inválido" }, { status: 401 });
    }
    const tenantId = tenant.id;
    const cfg = (tenant.config || {}) as { autoAssignUserId?: string };

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.replace(/\D/g, "").trim() || null : null;
    if (!name) {
      return NextResponse.json({ error: "name obrigatório" }, { status: 400 });
    }
    const emailVal = email || `lead-${Date.now()}@placeholder.local`;

    const origin = (typeof body.origin === "string" ? body.origin : "").toUpperCase();
    const source: LeadSource =
      origin === "META"
        ? "META"
        : origin === "GOOGLE"
          ? "GOOGLE"
          : origin === "WHATSAPP"
            ? "WHATSAPP"
            : "OUTROS";

    const campaign = typeof body.campaign === "string" ? body.campaign.trim().slice(0, 255) : null;
    const ad = typeof body.ad === "string" ? body.ad.trim().slice(0, 255) : null;
    const utm: Record<string, string> = {};
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
      if (typeof body[k] === "string" && body[k]) utm[k] = String(body[k]).slice(0, 500);
    }

    // Deduplicação: por phone ou, se sem phone, por email
    const where: { tenantId: string; deletedAt: null; phone?: string; email?: string } = {
      tenantId,
      deletedAt: null,
    };
    if (phone) where.phone = phone;
    else where.email = emailVal;

    const existing = await db.lead.findFirst({ where });
    if (existing) {
      const upd: { campaign?: string; ad?: string; metadata?: Record<string, string> } = {};
      if (campaign != null) upd.campaign = campaign;
      if (ad != null) upd.ad = ad;
      if (Object.keys(utm).length) {
        const meta = (existing.metadata as Record<string, string> | null) || {};
        upd.metadata = { ...meta, ...utm };
      }
      if (Object.keys(upd).length) {
        await db.lead.update({ where: { id: existing.id }, data: upd });
      }
      return NextResponse.json({ ok: true, leadId: existing.id, updated: true });
    }

    // Primeiro estágio do pipeline
    const pipe = await db.pipeline.findFirst({
      where: { tenantId, isDefault: true },
      include: { stages: { orderBy: { order: "asc" }, take: 1 } },
    });
    const stageId = pipe?.stages[0]?.id ?? null;

    const lead = await db.lead.create({
      data: {
        tenantId,
        name,
        email: emailVal,
        phone,
        source,
        status: "NEW",
        stageId,
        campaign: campaign ?? undefined,
        ad: ad ?? undefined,
        metadata: Object.keys(utm).length ? utm : undefined,
        assignedToId: cfg.autoAssignUserId || undefined,
      },
    });

    return NextResponse.json({ ok: true, leadId: lead.id });
  } catch (e) {
    console.error("webhook leads", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
