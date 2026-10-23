import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { getPersonJourney, storeProviderLabel } from "@/lib/atrako/person";
import type { AbandonedCartItem } from "@/lib/crm/abandoned-cart";
import { addLeadNote, ensureDefaultPipeline, setLeadOwner } from "@/lib/modules/crm";
import { leadCommunications } from "@/lib/flows/lead-card";
import { CHANNEL_LABELS, wooVisitExtras, type OrderChannel } from "@/lib/commerce-attribution/store-source";
import { isRevenueOrder } from "@/lib/commerce-attribution/order-status";
import { contactLocation, formatLocation, orderDetails } from "@/lib/commerce/order-details";
import { describeMlBuyer, parseMlBuyerFacts } from "@/lib/integrations/mercadolivre/buyer-facts";
import { refreshMlBuyerIfThin } from "@/lib/integrations/mercadolivre/enrich-buyer";
import { leadSourceLabel } from "@/lib/atrako/person";
import { parseLeadQualification } from "@/lib/qualification/store";
import { FIELD_DEFS } from "@/lib/qualification/fields";
import {
  CRM_ANSWER_ORDER,
  CRM_HIDE_ANSWER_KEYS,
  crmOriginDisplay,
  nextActionHuman,
  priorityHumanLabel,
} from "@/lib/qualification/crm-labels";
import { resolveChoice } from "@/lib/qualification/choices";
import type { QualifyFieldKey } from "@/lib/qualification/fields";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const lead = await prisma.nativeLead.findFirst({
    where: { id, clienteId: workspaceId },
    include: { contact: true, stage: true },
  });
  if (!lead) return NextResponse.json({ error: "not found" }, { status: 404 });

  const pipeline = await ensureDefaultPipeline(workspaceId);

  const sources = (lead.contact?.metadata as { sources?: string[] } | null)?.sources;
  const leadMeta = (lead.metadata ?? {}) as {
    lostReason?: string;
    lostAt?: string;
    notes?: Array<{ id?: string; text?: string; at?: string }>;
    ownerMemberId?: string | null;
    ownerName?: string | null;
    campaignName?: string | null;
    adName?: string | null;
    formName?: string | null;
    utm_campaign?: string | null;
  };
  const notes = Array.isArray(leadMeta.notes)
    ? leadMeta.notes
        .filter((n) => typeof n?.text === "string" && n.text.trim())
        .map((n) => ({ id: n.id ?? n.at ?? n.text, text: n.text as string, at: n.at ?? lead.createdAt.toISOString() }))
    : [];
  const members = await prisma.workspaceMember.findMany({
    where: { clienteId: workspaceId, active: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
    take: 40,
  });

  const cartRows = await prisma.abandonedCart.findMany({
    where: {
      clienteId: workspaceId,
      OR: [{ leadId: lead.id }, ...(lead.contactId ? [{ contactId: lead.contactId }] : [])],
    },
    orderBy: { abandonedAt: "desc" },
    take: 5,
  });
  const communications = lead.contactId ? await leadCommunications(workspaceId, lead.contactId) : null;

  const orderRows = await prisma.marketplaceOrder.findMany({
    where: {
      clienteId: workspaceId,
      OR: [{ leadId: lead.id }, ...(lead.contactId ? [{ contactId: lead.contactId }] : [])],
    },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take: 50,
    include: { items: true, source: true },
  });

  for (const row of orderRows.filter((row) => row.provider === "MERCADO_LIVRE").slice(0, 3)) {
    const saved = await refreshMlBuyerIfThin(row).catch(() => null);
    if (!saved) continue;
    if (saved.phone) row.buyerPhone = saved.phone;
    if (saved.email) row.buyerEmail = saved.email;
    if (saved.name) row.buyerName = saved.name;
    if (saved.cityName) row.cityName = saved.cityName;
    if (saved.cityRaw) row.cityRaw = saved.cityRaw;
    if (saved.stateUf) row.stateUf = saved.stateUf;
    row.rawPayload = saved.rawPayload;
    if (lead.contact) {
      if (!lead.contact.phone && saved.phone) lead.contact.phone = saved.phone;
      if (!lead.contact.email && saved.email) lead.contact.email = saved.email;
      if (saved.name && (lead.contact.name === "Contato" || !lead.contact.name.trim())) {
        lead.contact.name = saved.name;
      }
      const meta =
        lead.contact.metadata && typeof lead.contact.metadata === "object" && !Array.isArray(lead.contact.metadata)
          ? (lead.contact.metadata as Record<string, unknown>)
          : {};
      const city = saved.cityName ?? saved.cityRaw;
      if (city || saved.rawPayload) {
        lead.contact.metadata = {
          ...meta,
          ...(city ? { location: { city, state: saved.stateUf } } : {}),
        };
      }
    }
  }

  const journey = lead.contactId
    ? await getPersonJourney(workspaceId, lead.contactId).catch(() => null)
    : null;

  // Pedido não pago vira carrinho (`order:<id>`): o card mostra um só, com o status real do pedido.
  const cartOrderKey = (provider: string, externalId: string) => `${provider}:${externalId}`;
  const cartOrderKeys = new Set(
    cartRows.filter((c) => c.kind === "order").map((c) => cartOrderKey(c.provider, c.externalId.replace(/^order:/, ""))),
  );
  const statusOrder: Record<string, number> = { OPEN: 0, PENDING: 1, RECOVERED: 2, EXPIRED: 3 };
  const carts = cartRows
    .sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9))
    .map((c) => {
      const orderExternalId = c.kind === "order" ? c.externalId.replace(/^order:/, "") : null;
      const linked = orderExternalId
        ? orderRows.find((o) => o.provider === c.provider && o.externalId === orderExternalId)
        : null;
      const rawItems = Array.isArray(c.items) ? (c.items as AbandonedCartItem[]) : [];
      const items = rawItems.map((item, idx) => {
        if (item.imageUrl && item.productUrl) return item;
        const match =
          linked?.items.find((li) => li.title === item.title) ??
          (linked?.items.length === rawItems.length ? linked.items[idx] : undefined);
        return {
          ...item,
          imageUrl: item.imageUrl ?? match?.imageUrl ?? null,
          productUrl: item.productUrl ?? match?.productUrl ?? null,
        };
      });
      return {
        id: c.id,
        provider: c.provider,
        providerLabel: storeProviderLabel(c.provider),
        kind: c.kind,
        status: c.status,
        orderExternalId,
        orderStatus: linked?.status ?? null,
        totalCents: c.totalCents,
        currency: c.currency,
        items,
        recoveryUrl: c.recoveryUrl,
        abandonedAt: c.abandonedAt.toISOString(),
        recoveredAt: c.recoveredAt?.toISOString() ?? null,
        recoveredCents: c.recoveredCents,
        notifiedAt: c.notifiedAt?.toISOString() ?? null,
      };
    });

  const orders = orderRows.map((o) => ({
    id: o.id,
    fromCart: cartOrderKeys.has(cartOrderKey(o.provider, o.externalId)),
    externalId: o.externalId,
    provider: o.provider,
    providerLabel: storeProviderLabel(o.provider),
    status: o.status,
    paid: isRevenueOrder(o.status),
    totalCents: o.totalCents ?? 0,
    currency: o.currency ?? "BRL",
    occurredAt: (o.occurredAt ?? o.createdAt).toISOString(),
    details: orderDetails(o.provider, {
      ...(o.rawPayload && typeof o.rawPayload === "object" ? (o.rawPayload as Record<string, unknown>) : {}),
      shippingMode: o.shippingMode,
      logisticType: o.logisticType,
      shippingStatus: o.shippingStatus,
      cityName: o.cityName,
      cityRaw: o.cityRaw,
      stateUf: o.stateUf,
    }),
    items: o.items.map((i) => ({
      title: i.title,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
      imageUrl: i.imageUrl,
      productUrl: i.productUrl,
    })),
    visit: o.source
      ? {
          storeCampaign: o.source.storeCampaign,
          storeContent: o.source.storeContent,
          referrer: o.source.referrer,
          landingUrl: o.source.landingUrl,
          deviceType: o.source.deviceType,
          sessionPages: o.source.sessionPages,
          ...(o.provider === "WOOCOMMERCE"
            ? wooVisitExtras((o.rawPayload as { order?: Parameters<typeof wooVisitExtras>[0] } | null)?.order ?? {})
            : { userAgent: null, minutesOnSite: null }),
        }
      : null,
    source: o.source
      ? {
          channel: o.source.channel,
          channelLabel: CHANNEL_LABELS[o.source.channel as OrderChannel] ?? o.source.channel,
          storeSource: o.source.storeSource,
          storeMedium: o.source.storeMedium,
          storeContent: o.source.storeContent,
          deviceType: o.source.deviceType,
          adMethod: o.source.adMethod,
          adConfidence: o.source.adConfidence,
          adWindow: o.source.adWindow,
          campaignName: o.source.metaCampaignName,
          adsetName: o.source.metaAdsetName,
          adName: o.source.metaAdName,
          adId: o.source.metaAdId,
        }
      : null,
  }));

  const location = contactLocation(lead.contact?.metadata) ?? orders.find((o) => o.details?.location)?.details?.location ?? null;
  const mlCard = orderRows
    .filter((o) => o.provider === "MERCADO_LIVRE")
    .map((o) => {
      const raw = o.rawPayload && typeof o.rawPayload === "object" ? (o.rawPayload as Record<string, unknown>) : {};
      return describeMlBuyer({
        facts: parseMlBuyerFacts({ order: raw.order, billing: raw.billing, shipment: raw.shipment }),
        cityName: o.cityName,
        cityRaw: o.cityRaw,
        stateUf: o.stateUf,
        shippingMode: o.shippingMode,
        logisticType: o.logisticType,
        shippingStatus: o.shippingStatus,
        shipment: raw.shipment,
      });
    })
    .find((card) => card.nickname || card.location || card.address || card.document || card.shipping) ?? null;
  const contactMeta =
    lead.contact?.metadata && typeof lead.contact.metadata === "object" && !Array.isArray(lead.contact.metadata)
      ? (lead.contact.metadata as { nickname?: unknown; meliNickname?: unknown })
      : null;
  const storedNickname = [contactMeta?.nickname, contactMeta?.meliNickname].find((value) => typeof value === "string");
  const nickname = mlCard?.nickname ?? (typeof storedNickname === "string" ? storedNickname : null);

  return NextResponse.json({
    communications,
    orders,
    lead: {
      id: lead.id,
      contactId: lead.contactId,
      name: lead.contact?.name ?? "Lead",
      email: lead.contact?.email ?? null,
      phone: lead.contact?.phone ?? null,
      source: lead.source,
      status: lead.status,
      dealValue: lead.dealValue != null ? Number(lead.dealValue) : null,
      stageId: lead.stageId,
      stageName: lead.stage?.name ?? null,
      stageColor: lead.stage?.color ?? null,
      sources: Array.isArray(sources) ? sources : [],
      sourceLabel: crmOriginDisplay({
        source: lead.source,
        formName: leadMeta.formName ?? null,
        campaignName: leadMeta.campaignName ?? leadMeta.utm_campaign ?? null,
        sourceLabel: lead.source ? leadSourceLabel(lead.source) : null,
      }),
      location: formatLocation(location) ?? mlCard?.location ?? null,
      nickname,
      address: mlCard?.address ?? null,
      document: mlCard?.document ?? null,
      shipping: mlCard?.shipping ?? null,
      lostReason: leadMeta.lostReason ?? null,
      lostAt: leadMeta.lostAt ?? null,
      notes,
      ownerMemberId: leadMeta.ownerMemberId ?? null,
      ownerName: leadMeta.ownerName ?? null,
    campaignName: leadMeta.campaignName ?? leadMeta.utm_campaign ?? null,
    adName: leadMeta.adName ?? null,
    formName: leadMeta.formName ?? null,
    geoPage: (leadMeta as { geoPage?: string }).geoPage ?? null,
    geoPageTitle: (leadMeta as { geoPageTitle?: string }).geoPageTitle ?? null,
    aiSource: (leadMeta as { aiSource?: string }).aiSource ?? null,
    firstReferrer: (leadMeta as { firstReferrer?: string; referrer?: string }).firstReferrer ?? (leadMeta as { referrer?: string }).referrer ?? null,
    firstUtmSource: (leadMeta as { firstUtmSource?: string; utm_source?: string }).firstUtmSource ?? (leadMeta as { utm_source?: string }).utm_source ?? null,
    firstUtmMedium: (leadMeta as { firstUtmMedium?: string; utm_medium?: string }).firstUtmMedium ?? (leadMeta as { utm_medium?: string }).utm_medium ?? null,
    utmCampaign: (leadMeta as { utm_campaign?: string }).utm_campaign ?? null,
    utmContent: (leadMeta as { utm_content?: string }).utm_content ?? null,
      qualification: (() => {
        const q = parseLeadQualification(lead.metadata);
        if (!q.answers || !Object.keys(q.answers).length) return null;
        const crmLabel = Object.fromEntries(FIELD_DEFS.map((f) => [f.key, f.crmLabel]));
        const hide = new Set(CRM_HIDE_ANSWER_KEYS);
        const stateVal = q.answers.state?.value?.trim() || "";
        const order = new Map(CRM_ANSWER_ORDER.map((k, i) => [k, i]));
        const answers = Object.entries(q.answers)
          .filter(
            ([key, a]) =>
              a &&
              String(a.value || "").trim() &&
              !hide.has(key as QualifyFieldKey) &&
              key !== "state",
          )
          .map(([key, a]) => {
            const k = key as QualifyFieldKey;
            const choiceKeys: QualifyFieldKey[] = [
              "niche",
              "start_timeline",
              "business_objective",
              "main_question",
              "investment_status",
              "best_contact_time",
            ];
            let label = a!.label || a!.value;
            if (choiceKeys.includes(k)) {
              label = resolveChoice(k, a!.code || a!.value).label;
            } else if (k === "city" && stateVal) {
              label = `${label} · ${stateVal}`;
            }
            return {
              key,
              fieldLabel: crmLabel[k] || key,
              label,
              value: a!.value,
              code: a!.code ?? null,
              source: a!.source,
              at: a!.at,
            };
          })
          .sort((a, b) => (order.get(a.key as QualifyFieldKey) ?? 99) - (order.get(b.key as QualifyFieldKey) ?? 99));
        return {
          playbookId: q.playbookId,
          priority: q.priority,
          priorityLabel: priorityHumanLabel(q.priority),
          filledPercent: q.filledPercent,
          currentState: q.currentState,
          cadenceStatus: q.cadenceStatus,
          missing: q.missing,
          nextAction: nextActionHuman({
            priority: q.priority,
            currentState: q.currentState,
            cadenceStatus: q.cadenceStatus,
            missingCount: q.missing.length,
          }),
          answers,
        };
      })(),
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
    },
    members: members.map((m) => ({ id: m.id, name: m.name?.trim() || m.email, email: m.email })),
    carts,
    stages: pipeline.stages.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
    })),
    journey: journey?.items ?? [],
  });
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  try {
    if (body.action === "note") {
      await addLeadNote({
        workspaceId,
        leadId: id,
        text: typeof body.text === "string" ? body.text : "",
      });
    } else if (body.action === "owner") {
      await setLeadOwner({
        workspaceId,
        leadId: id,
        ownerMemberId: typeof body.ownerMemberId === "string" && body.ownerMemberId ? body.ownerMemberId : null,
      });
    } else {
      return NextResponse.json({ error: "ação inválida" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
