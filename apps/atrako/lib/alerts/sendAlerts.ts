import { prisma } from "@/lib/db";
import { getIntegrationsConfig } from "@/lib/config/integrations";
import { fetchAccountBalance } from "@/lib/meta/metaClient";
import nodemailer from "nodemailer";

export interface SaldoAlerta {
  clienteId: string;
  nome: string;
  slug: string;
  accountId: string;
  saldo: number | null;
  moeda: string;
  burnDiario7d: number;
  diasRestantes: number | null;
  erro: string | null;
}

export interface AnomaliaAlerta {
  clienteId: string;
  nome: string;
  slug: string;
  canal: string;
  ultimoGastoData: string;
  diasSemGasto: number;
}

export interface AlertaSummary {
  saldosBaixos: SaldoAlerta[];
  anomalias: AnomaliaAlerta[];
  emailEnviado: boolean;
  webhookEnviado: boolean;
  erros: string[];
}

async function fetchSaldosBaixos(config: Awaited<ReturnType<typeof getIntegrationsConfig>>, balanceThresholdDays: number): Promise<{ alertas: SaldoAlerta[]; erros: string[] }> {
  const contasMeta = await prisma.conta.findMany({
    where: { plataforma: "META", accountIdPlataforma: { not: null } },
    include: {
      cliente: { select: { id: true, nome: true, slug: true, ativo: true } },
    },
  });

  const ativas = contasMeta.filter((c) => c.cliente.ativo && c.accountIdPlataforma);

  const now = new Date();
  const last7 = new Date(now);
  last7.setDate(last7.getDate() - 7);

  const fatosUlt7 = await prisma.fatoMidiaDiario.groupBy({
    by: ["clienteId"],
    where: {
      canal: "META",
      data: { gte: last7, lte: now },
    },
    _sum: { investimento: true },
  });

  const burnMap = new Map<string, number>();
  for (const f of fatosUlt7) {
    burnMap.set(f.clienteId, Number(f._sum.investimento ?? 0) / 7);
  }

  const metaToken = config.metaAccessToken;

  const settled = await Promise.allSettled(
    ativas.map(async (conta) => {
      const accountId = conta.accountIdPlataforma!;
      const cid = conta.clienteId;
      const burnDiario = burnMap.get(cid) ?? 0;

      if (!metaToken) {
        return {
          clienteId: cid,
          nome: conta.cliente.nome,
          slug: conta.cliente.slug,
          accountId,
          saldo: null as number | null,
          moeda: "BRL",
          burnDiario7d: burnDiario,
          diasRestantes: null as number | null,
          erro: "Token Meta não configurado",
        };
      }

      const balance = await fetchAccountBalance(accountId, metaToken);
      const saldoVal = balance.balance;
      const diasRestantes = saldoVal != null && burnDiario > 0 ? saldoVal / burnDiario : null;

      return {
        clienteId: cid,
        nome: conta.cliente.nome,
        slug: conta.cliente.slug,
        accountId,
        saldo: saldoVal,
        moeda: balance.currency,
        burnDiario7d: burnDiario,
        diasRestantes,
        erro: null as string | null,
      };
    })
  );

  const contas: SaldoAlerta[] = settled.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    const conta = ativas[i];
    return {
      clienteId: conta.clienteId,
      nome: conta.cliente.nome,
      slug: conta.cliente.slug,
      accountId: conta.accountIdPlataforma!,
      saldo: null,
      moeda: "BRL",
      burnDiario7d: burnMap.get(conta.clienteId) ?? 0,
      diasRestantes: null,
      erro: r.reason instanceof Error ? r.reason.message : "Erro ao buscar saldo",
    };
  });

  const erros: string[] = contas
    .filter((c) => c.erro !== null)
    .map((c) => `Saldo [${c.nome}]: ${c.erro}`);

  const alertas = contas.filter(
    (c) => c.diasRestantes !== null && c.diasRestantes < balanceThresholdDays
  );

  return { alertas, erros };
}

async function fetchAnomalias(spendGapDays: number): Promise<AnomaliaAlerta[]> {
  const now = new Date();

  // Look back far enough to verify prior spend before the gap
  const lookbackDays = spendGapDays + 7;
  const lookbackStart = new Date(now);
  lookbackStart.setDate(lookbackStart.getDate() - lookbackDays);
  lookbackStart.setHours(0, 0, 0, 0);

  const clientes = await prisma.cliente.findMany({
    where: { ativo: true },
    select: { id: true, nome: true, slug: true },
  });
  const clienteMap = new Map(clientes.map((c) => [c.id, c]));

  const fatos = await prisma.fatoMidiaDiario.findMany({
    where: {
      data: { gte: lookbackStart, lte: now },
      canal: { in: ["META", "GOOGLE"] },
      clienteId: { in: clientes.map((c) => c.id) },
    },
    select: { clienteId: true, canal: true, data: true, investimento: true },
    orderBy: { data: "asc" },
  });

  type DaySpend = { data: Date; spend: number };
  const grouped = new Map<string, DaySpend[]>();
  for (const f of fatos) {
    const key = `${f.clienteId}__${f.canal}`;
    const entry = grouped.get(key) ?? [];
    entry.push({ data: new Date(f.data), spend: Number(f.investimento) });
    grouped.set(key, entry);
  }

  const anomalias: AnomaliaAlerta[] = [];

  for (const [key, days] of grouped.entries()) {
    const [clienteId, canal] = key.split("__");
    const cliente = clienteMap.get(clienteId);
    if (!cliente) continue;

    // Find the most recent day with spend
    const withSpend = days
      .filter((d) => d.spend > 0)
      .sort((a, b) => b.data.getTime() - a.data.getTime());
    if (withSpend.length === 0) continue;

    const lastDate = withSpend[0].data;
    const diasSemGasto = Math.floor(
      (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Only flag if gap meets the configured threshold
    if (diasSemGasto < spendGapDays) continue;

    anomalias.push({
      clienteId,
      nome: cliente.nome,
      slug: cliente.slug,
      canal,
      ultimoGastoData: lastDate.toISOString().slice(0, 10),
      diasSemGasto,
    });
  }

  anomalias.sort((a, b) => b.diasSemGasto - a.diasSemGasto);
  return anomalias;
}

function formatCurrency(value: number, moeda: string): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: moeda || "BRL",
  }).format(value);
}

function buildEmailHtml(saldosBaixos: SaldoAlerta[], anomalias: AnomaliaAlerta[], balanceThresholdDays: number, spendGapDays: number): string {
  const date = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  let html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; color: #1a1a1a; background: #f5f5f5; margin: 0; padding: 20px; }
  .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
  .header { background: #1a1a2e; color: #fff; padding: 24px 28px; }
  .header h1 { margin: 0; font-size: 20px; }
  .header p { margin: 4px 0 0; font-size: 13px; color: #aaa; }
  .section { padding: 20px 28px; }
  .section-title { font-size: 15px; font-weight: 700; margin: 0 0 12px; }
  .alert-row { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border-radius: 8px; margin-bottom: 8px; }
  .alert-row.danger { background: #fef2f2; border-left: 3px solid #ef4444; }
  .alert-row.warning { background: #fffbeb; border-left: 3px solid #f59e0b; }
  .alert-name { font-weight: 600; font-size: 14px; }
  .alert-meta { font-size: 12px; color: #666; margin-top: 2px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
  .badge-danger { background: #fee2e2; color: #dc2626; }
  .badge-warning { background: #fef3c7; color: #d97706; }
  .divider { height: 1px; background: #f0f0f0; margin: 0 28px; }
  .footer { padding: 16px 28px; font-size: 11px; color: #999; }
  .no-alerts { color: #666; font-size: 13px; padding: 8px 0; }
</style></head>
<body><div class="container">
  <div class="header">
    <h1>Alerta Diário — Central de Clientes</h1>
    <p>${date}</p>
  </div>
`;

  html += `<div class="section"><p class="section-title">Saldo Baixo Meta Ads (&lt;${balanceThresholdDays} dias)</p>`;
  if (saldosBaixos.length === 0) {
    html += `<p class="no-alerts">Nenhuma conta com saldo crítico.</p>`;
  } else {
    for (const c of saldosBaixos) {
      const dias = c.diasRestantes !== null ? c.diasRestantes.toFixed(1) : "—";
      const saldo = c.saldo !== null ? formatCurrency(c.saldo, c.moeda) : "—";
      const cls = c.diasRestantes !== null && c.diasRestantes <= 3 ? "danger" : "warning";
      const badgeCls = cls === "danger" ? "badge-danger" : "badge-warning";
      html += `
      <div class="alert-row ${cls}">
        <div>
          <div class="alert-name">${c.nome}</div>
          <div class="alert-meta">Saldo: ${saldo} · Burn/dia: ${formatCurrency(c.burnDiario7d, c.moeda)}</div>
          <div class="alert-meta"><span class="badge ${badgeCls}">${dias} dias restantes</span></div>
        </div>
      </div>`;
    }
  }
  html += `</div><div class="divider"></div>`;

  html += `<div class="section"><p class="section-title">Anomalias de Gasto (&ge;${spendGapDays} dia(s) sem gasto)</p>`;
  if (anomalias.length === 0) {
    html += `<p class="no-alerts">Nenhuma anomalia detectada.</p>`;
  } else {
    for (const a of anomalias) {
      html += `
      <div class="alert-row danger">
        <div>
          <div class="alert-name">${a.nome} <span style="font-weight:400;color:#888;font-size:12px">(${a.canal})</span></div>
          <div class="alert-meta">Último gasto: ${a.ultimoGastoData}</div>
          <div class="alert-meta"><span class="badge badge-danger">${a.diasSemGasto} dia(s) sem gasto</span></div>
        </div>
      </div>`;
    }
  }
  html += `</div>`;

  html += `<div class="footer">Este alerta é enviado automaticamente pelo sistema Central de Clientes Inout. Limiares configurados: saldo &lt;${balanceThresholdDays} dias · gap de gasto &ge;${spendGapDays} dia(s).</div>`;
  html += `</div></body></html>`;
  return html;
}

function buildWebhookPayload(saldosBaixos: SaldoAlerta[], anomalias: AnomaliaAlerta[], balanceThresholdDays: number, spendGapDays: number): object {
  const date = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const lines: string[] = [`*Alerta Diário — Central de Clientes (${date})*`];

  lines.push(`\n*Saldo Baixo Meta Ads (<${balanceThresholdDays} dias)*`);
  if (saldosBaixos.length === 0) {
    lines.push("Nenhuma conta com saldo crítico.");
  } else {
    for (const c of saldosBaixos) {
      const dias = c.diasRestantes !== null ? c.diasRestantes.toFixed(1) : "—";
      const saldo = c.saldo !== null ? formatCurrency(c.saldo, c.moeda) : "—";
      lines.push(`• *${c.nome}* — Saldo: ${saldo} · ${dias} dias restantes`);
    }
  }

  lines.push(`\n*Anomalias de Gasto (≥${spendGapDays} dia(s) sem gasto)*`);
  if (anomalias.length === 0) {
    lines.push("Nenhuma anomalia detectada.");
  } else {
    for (const a of anomalias) {
      lines.push(`• *${a.nome}* (${a.canal}) — ${a.diasSemGasto} dia(s) sem gasto desde ${a.ultimoGastoData}`);
    }
  }

  lines.push(`\n_Limiares: saldo <${balanceThresholdDays} dias · gap de gasto ≥${spendGapDays} dia(s)_`);
  return { text: lines.join("\n") };
}

async function sendEmail(
  config: Awaited<ReturnType<typeof getIntegrationsConfig>>,
  saldosBaixos: SaldoAlerta[],
  anomalias: AnomaliaAlerta[],
  balanceThresholdDays: number,
  spendGapDays: number
): Promise<void> {
  const { alertNotificationEmail, alertSmtpHost, alertSmtpPort, alertSmtpUser, alertSmtpPass, alertSmtpFrom } = config;

  if (!alertNotificationEmail) throw new Error("E-mail de notificação não configurado");
  if (!alertSmtpHost || !alertSmtpUser || !alertSmtpPass) throw new Error("Configurações SMTP incompletas");

  const transporter = nodemailer.createTransport({
    host: alertSmtpHost,
    port: alertSmtpPort ? parseInt(alertSmtpPort, 10) : 587,
    secure: alertSmtpPort === "465",
    auth: { user: alertSmtpUser, pass: alertSmtpPass },
  });

  const html = buildEmailHtml(saldosBaixos, anomalias, balanceThresholdDays, spendGapDays);
  const date = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const totalAlertas = saldosBaixos.length + anomalias.length;

  await transporter.sendMail({
    from: alertSmtpFrom || alertSmtpUser,
    to: alertNotificationEmail,
    subject: `[Alerta ${date}] ${totalAlertas} item(ns) para atenção — Central de Clientes`,
    html,
  });
}

async function sendWebhook(
  webhookUrl: string,
  saldosBaixos: SaldoAlerta[],
  anomalias: AnomaliaAlerta[],
  balanceThresholdDays: number,
  spendGapDays: number
): Promise<void> {
  const payload = buildWebhookPayload(saldosBaixos, anomalias, balanceThresholdDays, spendGapDays);
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Webhook retornou status ${res.status}: ${await res.text()}`);
  }
}

export async function runDailyAlerts(): Promise<AlertaSummary> {
  const config = await getIntegrationsConfig();
  const erros: string[] = [];

  const balanceThresholdDays = config.alertBalanceThresholdDays
    ? parseInt(config.alertBalanceThresholdDays, 10) || 7
    : 7;
  const spendGapDays = config.alertSpendGapDays
    ? parseInt(config.alertSpendGapDays, 10) || 2
    : 2;

  const [saldosResult, anomalias] = await Promise.all([
    fetchSaldosBaixos(config, balanceThresholdDays).catch((e) => {
      erros.push(`Erro ao buscar saldos: ${e instanceof Error ? e.message : String(e)}`);
      return { alertas: [] as SaldoAlerta[], erros: [] as string[] };
    }),
    fetchAnomalias(spendGapDays).catch((e) => {
      erros.push(`Erro ao buscar anomalias: ${e instanceof Error ? e.message : String(e)}`);
      return [] as AnomaliaAlerta[];
    }),
  ]);

  const saldosBaixos = saldosResult.alertas;
  erros.push(...saldosResult.erros);

  const totalAlertas = saldosBaixos.length + anomalias.length;

  let emailEnviado = false;
  let webhookEnviado = false;

  if (totalAlertas > 0) {
    if (config.alertNotificationEmail) {
      try {
        await sendEmail(config, saldosBaixos, anomalias, balanceThresholdDays, spendGapDays);
        emailEnviado = true;
      } catch (e) {
        erros.push(`Erro ao enviar e-mail: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (config.alertWebhookUrl) {
      try {
        await sendWebhook(config.alertWebhookUrl, saldosBaixos, anomalias, balanceThresholdDays, spendGapDays);
        webhookEnviado = true;
      } catch (e) {
        erros.push(`Erro ao enviar webhook: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  return { saldosBaixos, anomalias, emailEnviado, webhookEnviado, erros };
}
