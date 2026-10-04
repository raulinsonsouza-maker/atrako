import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import {
  disconnectWorkspaceConnection,
  getWorkspaceConnection,
  upsertWorkspaceConnection,
} from "@/lib/atrako/workspace-connections";
import {
  configureResendDomainTracking,
  createResendWebhook,
  listResendDomains,
  sendResendEmail,
  type ResendDomain,
} from "@/lib/integrations/resend/client";
import {
  formatFrom,
  patchResendMetadata,
  resolveResend,
  warmupDailyCap,
} from "@/lib/integrations/resend/connection";
import { getPublicOrigin } from "@/lib/http/public-origin";
import { prisma } from "@/lib/db";

export const maxDuration = 60;

function str(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim() ?? "";
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;

  const conn = await resolveResend(workspaceId);
  if (!conn) return NextResponse.json({ connected: false });

  let domains: ResendDomain[] = [];
  let domainsError: string | null = null;
  if (request.nextUrl.searchParams.get("domains") === "1") {
    try {
      domains = await listResendDomains(conn.apiKey);
    } catch (err) {
      domainsError = err instanceof Error ? err.message : "Falha ao listar domínios";
    }
  }

  return NextResponse.json({
    connected: true,
    fromName: conn.fromName,
    fromEmail: conn.fromEmail,
    replyTo: conn.replyTo,
    domain: conn.domain,
    domainId: conn.domainId,
    domainStatus: conn.domainStatus,
    domainVerifiedAt: conn.domainVerifiedAt,
    webhookConfigured: Boolean(conn.webhookSecret),
    lastWebhookAt: conn.lastWebhookAt,
    warmupDailyCap: warmupDailyCap(conn.domainVerifiedAt),
    webhookUrl: `${getPublicOrigin(request)}/api/webhooks/resend/${workspaceId}`,
    domains,
    domainsError,
  });
}

export async function POST(request: NextRequest) {
  let b: Record<string, unknown>;
  try {
    b = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const workspaceId = str(b.workspaceId);
  const action = str(b.action) || "save";
  const access = await requireWorkspaceAccess(
    workspaceId,
    action === "test" ? "operate" : "manage",
  );
  if (!access.ok) return access.response;

  if (action === "disconnect") {
    await disconnectWorkspaceConnection(workspaceId, "RESEND");
    return NextResponse.json({ ok: true, disconnected: true });
  }

  if (action === "validate") {
    const apiKey = str(b.apiKey);
    if (!apiKey.startsWith("re_")) {
      return NextResponse.json({ error: "API key do Resend começa com re_" }, { status: 400 });
    }
    try {
      const domains = await listResendDomains(apiKey);
      return NextResponse.json({ ok: true, domains });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "API key inválida" },
        { status: 400 },
      );
    }
  }

  const existing = await getWorkspaceConnection(workspaceId, "RESEND");
  const prevCreds = existing?.status === "ACTIVE" ? existing.credentials : {};
  const prevMeta = (existing?.metadata ?? {}) as Record<string, unknown>;

  if (action === "test") {
    const conn = await resolveResend(workspaceId);
    const to = str(b.to);
    if (!conn?.fromEmail) {
      return NextResponse.json({ error: "Conecte o Resend e escolha o remetente" }, { status: 400 });
    }
    if (!EMAIL_RE.test(to)) return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });
    const ws = await prisma.cliente.findUnique({ where: { id: workspaceId }, select: { nome: true } });
    try {
      const r = await sendResendEmail(conn.apiKey, {
        from: formatFrom(conn, ws?.nome ?? "Loja"),
        to: [to],
        subject: "Teste de envio — Atrako",
        html: `<p>Seu domínio <b>${conn.domain ?? ""}</b> está enviando pelo Atrako.</p>`,
        text: `Seu domínio ${conn.domain ?? ""} está enviando pelo Atrako.`,
        tags: [{ name: "test", value: "1" }],
      });
      return NextResponse.json({ ok: true, id: r.id });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Falha no envio" },
        { status: 400 },
      );
    }
  }

  if (action === "webhook-secret") {
    const secret = str(b.webhookSecret);
    if (!secret.startsWith("whsec_")) {
      return NextResponse.json({ error: "O signing secret começa com whsec_" }, { status: 400 });
    }
    if (!existing) return NextResponse.json({ error: "Conecte o Resend primeiro" }, { status: 400 });
    await upsertWorkspaceConnection({
      clienteId: workspaceId,
      provider: "RESEND",
      label: existing.label,
      credentials: { ...prevCreds, webhookSecret: secret },
      metadata: prevMeta,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "create-webhook") {
    const conn = await resolveResend(workspaceId);
    if (!conn) return NextResponse.json({ error: "Conecte o Resend primeiro" }, { status: 400 });
    const endpoint = `${getPublicOrigin(request)}/api/webhooks/resend/${workspaceId}`;
    try {
      const hook = await createResendWebhook(conn.apiKey, endpoint);
      if (!hook.signing_secret) throw new Error("Resend não retornou o signing secret");
      await upsertWorkspaceConnection({
        clienteId: workspaceId,
        provider: "RESEND",
        label: existing?.label ?? null,
        credentials: { ...prevCreds, webhookSecret: hook.signing_secret },
        metadata: { ...prevMeta, webhookId: hook.id ?? null, webhookEndpoint: endpoint },
      });
      return NextResponse.json({ ok: true });
    } catch (err) {
      return NextResponse.json(
        {
          error: err instanceof Error ? err.message : "Falha ao criar webhook",
          manual: true,
          endpoint,
        },
        { status: 400 },
      );
    }
  }

  if (action === "refresh") {
    const conn = await resolveResend(workspaceId);
    if (!conn) return NextResponse.json({ error: "Não conectado" }, { status: 400 });
    const domains = await listResendDomains(conn.apiKey).catch(() => []);
    const d = domains.find((x) => x.id === conn.domainId || x.name === conn.domain);
    if (d) {
      await patchResendMetadata(workspaceId, {
        domainStatus: d.status,
        ...(d.status === "verified" && !conn.domainVerifiedAt
          ? { domainVerifiedAt: new Date().toISOString() }
          : {}),
      });
    }
    return NextResponse.json({ ok: true, domainStatus: d?.status ?? null });
  }

  // save
  const apiKey = str(b.apiKey) || (typeof prevCreds.apiKey === "string" ? prevCreds.apiKey : "");
  if (!apiKey.startsWith("re_")) {
    return NextResponse.json({ error: "Informe a API key do Resend (re_…)" }, { status: 400 });
  }
  let domains: ResendDomain[];
  try {
    domains = await listResendDomains(apiKey);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "API key inválida" },
      { status: 400 },
    );
  }

  const domainId = str(b.domainId);
  const domain = domains.find((d) => d.id === domainId) ?? (domains.length === 1 ? domains[0] : null);
  const fromLocal = str(b.fromLocal).replace(/@.*$/, "") || "contato";
  const fromEmail = domain ? `${fromLocal}@${domain.name}` : null;
  const replyTo = str(b.replyTo);
  if (replyTo && !EMAIL_RE.test(replyTo)) {
    return NextResponse.json({ error: "Responder para: e-mail inválido" }, { status: 400 });
  }

  if (domain) {
    await configureResendDomainTracking(apiKey, domain.id).catch((err) =>
      console.warn("[resend] tracking config", err instanceof Error ? err.message : err),
    );
  }

  const verified = domain?.status === "verified";
  const sameDomain = prevMeta.domainId === domain?.id;
  await upsertWorkspaceConnection({
    clienteId: workspaceId,
    provider: "RESEND",
    label: domain?.name ?? "Resend",
    credentials: { ...prevCreds, apiKey },
    metadata: {
      ...prevMeta,
      fromName: str(b.fromName) || null,
      fromEmail,
      replyTo: replyTo || null,
      domain: domain?.name ?? null,
      domainId: domain?.id ?? null,
      domainStatus: domain?.status ?? null,
      domainVerifiedAt:
        verified && sameDomain && typeof prevMeta.domainVerifiedAt === "string"
          ? prevMeta.domainVerifiedAt
          : verified
            ? new Date().toISOString()
            : null,
    },
    status: "ACTIVE",
  });

  let webhookError: string | null = null;
  if (!prevCreds.webhookSecret) {
    const endpoint = `${getPublicOrigin(request)}/api/webhooks/resend/${workspaceId}`;
    try {
      const hook = await createResendWebhook(apiKey, endpoint);
      if (hook.signing_secret) {
        const fresh = await getWorkspaceConnection(workspaceId, "RESEND");
        await upsertWorkspaceConnection({
          clienteId: workspaceId,
          provider: "RESEND",
          label: fresh?.label ?? null,
          credentials: { ...(fresh?.credentials ?? {}), webhookSecret: hook.signing_secret },
          metadata: {
            ...((fresh?.metadata ?? {}) as Record<string, unknown>),
            webhookId: hook.id ?? null,
            webhookEndpoint: endpoint,
          },
        });
      } else {
        webhookError = "Resend não retornou o signing secret — cole manualmente.";
      }
    } catch (err) {
      webhookError = err instanceof Error ? err.message : "Falha ao criar webhook";
    }
  }

  if (verified) {
    const { ensureDefaultFlows } = await import("@/lib/flows/playbooks");
    await ensureDefaultFlows(workspaceId).catch((err) =>
      console.warn("[resend] ensureDefaultFlows", err),
    );
  }

  return NextResponse.json({
    ok: true,
    domains,
    domain: domain?.name ?? null,
    domainStatus: domain?.status ?? null,
    fromEmail,
    webhookError,
  });
}
