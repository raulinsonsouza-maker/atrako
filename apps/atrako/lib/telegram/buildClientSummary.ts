import { prisma } from "@/lib/db";

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function brl(val: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

// Short BRL for alerts: R$24 or R$1.200 (no space, no decimals)
function brlShort(val: number): string {
  return `R$${new Intl.NumberFormat("pt-BR").format(Math.round(val))}`;
}

// Returns "▲44%" / "▼33%" / "" (if 0% change or ref === 0)
function pctStr(cur: number, ref: number): string {
  if (ref === 0) return "";
  const p = ((cur - ref) / ref) * 100;
  const abs = Math.abs(Math.round(p));
  if (abs === 0) return "";
  return `${p > 0 ? "▲" : "▼"}${abs}%`;
}

function dateInBRT(offsetDays: number): Date {
  const now = new Date();
  const brtMs = now.getTime() - 3 * 60 * 60 * 1000;
  const brtNow = new Date(brtMs);
  return new Date(
    Date.UTC(
      brtNow.getUTCFullYear(),
      brtNow.getUTCMonth(),
      brtNow.getUTCDate() + offsetDays,
      0, 0, 0, 0
    )
  );
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// "qua, 22/jul"
function shortDate(d: Date): string {
  const weekdays = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const months = ["jan", "fev", "mar", "abr", "mai", "jun",
                  "jul", "ago", "set", "out", "nov", "dez"];
  return `${weekdays[d.getUTCDay()]}, ${d.getUTCDate()}/${months[d.getUTCMonth()]}`;
}

// Full weekday name for reference: "terça-feira"
function fullWeekday(d: Date): string {
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC", weekday: "long" });
}

/**
 * Builds a compact platform row, e.g.:
 *   Meta  R$ 70,67 ▼4%  ·  2 leads ▼33%  ·  CPL R$ 35,34 ▲44%
 *   Meta  R$ 70,67 ▼4%  ·  5 compras ▲20%  ·  CPA R$ 14,13 ▼20%
 */
function fmtPlatformRow(
  name: string,
  investY: number,
  investD: number,
  outcomeY: number,
  outcomeD: number,
  costY: number | null,
  costD: number | null,
  outcomeLabel: string,
  costLabel = "CPL",
): string {
  const parts: string[] = [];

  const invPct = pctStr(investY, investD);
  parts.push(`${name}  ${brl(investY)}${invPct ? ` ${invPct}` : ""}`);

  const outPct = pctStr(outcomeY, outcomeD);
  parts.push(`${outcomeY} ${outcomeLabel}${outPct ? ` ${outPct}` : ""}`);

  if (costY !== null) {
    const costPct = costD !== null ? pctStr(costY, costD) : "";
    parts.push(`${costLabel} ${brl(costY)}${costPct ? ` ${costPct}` : ""}`);
  }

  return parts.join("  ·  ");
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://central-inout.replit.app";

export async function buildClientSummary(clienteId: string): Promise<string> {
  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: { nome: true, portalToken: true, objetivoMidia: true },
  });
  if (!cliente) throw new Error(`Cliente ${clienteId} não encontrado`);

  const isEcommerce = (cliente as typeof cliente & { objetivoMidia?: string }).objetivoMidia === "ecommerce";

  const todayBRT = dateInBRT(0);
  const ystBRT  = dateInBRT(-1);
  const dafBRT  = dateInBRT(-2);

  const portalUrl = cliente.portalToken
    ? `${BASE_URL}/portal/${cliente.portalToken}`
    : null;
  const rodape = portalUrl ? `\n🔗 <a href="${portalUrl}">ver dashboard</a>` : "";

  const lastFato = await prisma.fatoMidiaDiario.findFirst({
    where: { clienteId, canal: { in: ["META", "GOOGLE", "LINKEDIN"] } },
    orderBy: { data: "desc" },
    select: { data: true },
  });

  const nomeHtml = escHtml(cliente.nome);

  if (!lastFato) {
    return `📊 <b>${nomeHtml}</b>\n\n⚠️ <b>Sem dados de mídia cadastrados</b>\nNenhum fato encontrado.${rodape}`;
  }

  const lastDate = new Date(lastFato.data);
  const staleDays = Math.floor(
    (todayBRT.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (staleDays > 2) {
    const lastStr = lastDate.toLocaleDateString("pt-BR", {
      timeZone: "UTC",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    return `📊 <b>${nomeHtml}</b>\n\n⚠️ <b>Dados desatualizados</b>\nÚltimo registro: ${escHtml(lastStr)} (há ${staleDays} dias)\nO sync pode ter falhado — verifique o painel admin.${rodape}`;
  }

  const fatos = await prisma.fatoMidiaDiario.findMany({
    where: {
      clienteId,
      canal: { in: ["META", "GOOGLE", "LINKEDIN"] },
      data: { gte: dafBRT, lt: todayBRT },
    },
    select: {
      canal: true,
      data: true,
      investimento: true,
      leads: true,
      conversoes: true,
      purchases: true,
    },
  });

  type Slot = { invest: number; leads: number; conv: number; purchases: number };
  const agg = new Map<string, Slot>();
  for (const f of fatos) {
    const key = `${f.canal}__${isoDay(new Date(f.data))}`;
    const s = agg.get(key) ?? { invest: 0, leads: 0, conv: 0, purchases: 0 };
    s.invest    += Number(f.investimento);
    s.leads     += f.leads;
    s.conv      += f.conversoes;
    s.purchases += f.purchases;
    agg.set(key, s);
  }

  function get(canal: string, day: Date): Slot {
    return agg.get(`${canal}__${isoDay(day)}`) ?? { invest: 0, leads: 0, conv: 0, purchases: 0 };
  }

  // For leads mode: max(leads, conversoes); for ecommerce: purchases
  function outcomeLeads(s: Slot): number { return Math.max(s.leads, s.conv); }
  function outcomePurch(s: Slot): number { return s.purchases; }
  const getOutcome = isEcommerce ? outcomePurch : outcomeLeads;

  const mY = get("META",   ystBRT);
  const mD = get("META",   dafBRT);
  const gY = get("GOOGLE", ystBRT);
  const gD = get("GOOGLE", dafBRT);
  const lY = get("LINKEDIN", ystBRT);
  const lD = get("LINKEDIN", dafBRT);

  const metaOutY   = getOutcome(mY);
  const metaOutD   = getOutcome(mD);
  const googleOutY = getOutcome(gY);
  const googleOutD = getOutcome(gD);
  const linkedinOutY = getOutcome(lY);
  const linkedinOutD = getOutcome(lD);

  const totalInvestY = mY.invest + gY.invest + lY.invest;
  const totalInvestD = mD.invest + gD.invest + lD.invest;
  const totalOutY    = metaOutY + googleOutY + linkedinOutY;

  const metaCostY   = metaOutY   > 0 ? mY.invest / metaOutY   : null;
  const metaCostD   = metaOutD   > 0 ? mD.invest / metaOutD   : null;
  const googleCostY = googleOutY > 0 ? gY.invest / googleOutY : null;
  const googleCostD = googleOutD > 0 ? gD.invest / googleOutD : null;
  const linkedinCostY = linkedinOutY > 0 ? lY.invest / linkedinOutY : null;
  const linkedinCostD = linkedinOutD > 0 ? lD.invest / linkedinOutD : null;

  const hasMeta   = mY.invest > 0 || mY.leads > 0 || mY.purchases > 0 || mD.invest > 0;
  const hasGoogle = gY.invest > 0 || gY.leads > 0 || gY.purchases > 0 || gD.invest > 0;
  const hasLinkedin = lY.invest > 0 || lY.leads > 0 || lY.purchases > 0 || lD.invest > 0;

  // Labels vary by objective
  const outLabelMeta   = isEcommerce
    ? (metaOutY   === 1 ? "compra"  : "compras")
    : (metaOutY   === 1 ? "lead"    : "leads");
  const outLabelGoogle = isEcommerce
    ? (googleOutY === 1 ? "compra"  : "compras")
    : (googleOutY === 1 ? "lead"    : "leads");
  const outLabelLinkedin = isEcommerce
    ? (linkedinOutY === 1 ? "compra" : "compras")
    : (linkedinOutY === 1 ? "lead"   : "leads");
  const costLabel = isEcommerce ? "CPA" : "CPL";
  const totalLabel = isEcommerce
    ? (totalOutY === 1 ? "1 compra" : `${totalOutY} compras`)
    : (totalOutY === 1 ? "1 lead"   : `${totalOutY} leads`);

  // ── Header ────────────────────────────────────────────────────────────────
  const lines: string[] = [];
  const ystShort = escHtml(shortDate(ystBRT));
  const dafDow   = escHtml(fullWeekday(dafBRT));

  lines.push(`📊 <b>${nomeHtml}</b>`);
  lines.push(`<i>${ystShort}</i>  <i>(vs ${dafDow})</i>\n`);

  // ── Compact platform rows ─────────────────────────────────────────────────
  if (hasMeta) {
    lines.push(fmtPlatformRow(
      "Meta",
      mY.invest, mD.invest,
      metaOutY, metaOutD,
      metaCostY, metaCostD,
      outLabelMeta,
      costLabel,
    ));
  }
  if (hasGoogle) {
    lines.push(fmtPlatformRow(
      "Google",
      gY.invest, gD.invest,
      googleOutY, googleOutD,
      googleCostY, googleCostD,
      outLabelGoogle,
      costLabel,
    ));
  }
  if (hasLinkedin) {
    lines.push(fmtPlatformRow(
      "LinkedIn",
      lY.invest, lD.invest,
      linkedinOutY, linkedinOutD,
      linkedinCostY, linkedinCostD,
      outLabelLinkedin,
      costLabel,
    ));
  }
  // Total row only when 2+ platforms active
  if ([hasMeta, hasGoogle, hasLinkedin].filter(Boolean).length >= 2) {
    const totPct = pctStr(totalInvestY, totalInvestD);
    lines.push(`Total  ${brl(totalInvestY)}${totPct ? ` ${totPct}` : ""}  ·  ${totalLabel}`);
  }
  lines.push("");

  // ── Compact alerts ────────────────────────────────────────────────────────
  const alerts: string[] = [];

  if (hasMeta && mY.invest === 0 && mD.invest > 0)
    alerts.push("🔴 Meta sem gasto registrado ontem");
  if (hasGoogle && gY.invest === 0 && gD.invest > 0)
    alerts.push("🔴 Google sem gasto registrado ontem");

  if (isEcommerce) {
    if (hasMeta && metaOutD > 0 && metaOutY === 0)
      alerts.push("🔴 Nenhuma compra no Meta ontem");
    if (hasGoogle && googleOutD > 0 && googleOutY === 0)
      alerts.push("🔴 Nenhuma compra no Google ontem");
    if (metaCostY !== null && metaCostD !== null && metaCostD > 0) {
      const chg = (metaCostY - metaCostD) / metaCostD;
      if (chg > 0.3)
        alerts.push(`🔴 CPA Meta +${Math.round(chg * 100)}% (${brlShort(metaCostD)}→${brlShort(metaCostY)})`);
      else if (chg < -0.3)
        alerts.push(`✅ CPA Meta -${Math.round(Math.abs(chg) * 100)}%`);
    }
    if (googleCostY !== null && googleCostD !== null && googleCostD > 0) {
      const chg = (googleCostY - googleCostD) / googleCostD;
      if (chg > 0.3)
        alerts.push(`🔴 CPA Google +${Math.round(chg * 100)}% (${brlShort(googleCostD)}→${brlShort(googleCostY)})`);
      else if (chg < -0.3)
        alerts.push(`✅ CPA Google -${Math.round(Math.abs(chg) * 100)}%`);
    }
    if (hasMeta && metaOutD > 0 && metaOutY > 0) {
      const chg = (metaOutY - metaOutD) / metaOutD;
      if (chg < -0.4)
        alerts.push(`⚠️ Compras Meta -${Math.round(Math.abs(chg) * 100)}%`);
    }
    if (hasGoogle && googleOutD > 0 && googleOutY > 0) {
      const chg = (googleOutY - googleOutD) / googleOutD;
      if (chg < -0.4)
        alerts.push(`⚠️ Compras Google -${Math.round(Math.abs(chg) * 100)}%`);
    }
  } else {
    if (hasMeta && metaOutD > 0 && metaOutY === 0)
      alerts.push("🔴 Nenhum lead no Meta ontem");
    if (hasGoogle && googleOutD > 0 && googleOutY === 0)
      alerts.push("🔴 Nenhum lead no Google ontem");
    if (metaCostY !== null && metaCostD !== null && metaCostD > 0) {
      const chg = (metaCostY - metaCostD) / metaCostD;
      if (chg > 0.3)
        alerts.push(`🔴 CPL Meta +${Math.round(chg * 100)}% (${brlShort(metaCostD)}→${brlShort(metaCostY)})`);
      else if (chg < -0.3)
        alerts.push(`✅ CPL Meta -${Math.round(Math.abs(chg) * 100)}%`);
    }
    if (googleCostY !== null && googleCostD !== null && googleCostD > 0) {
      const chg = (googleCostY - googleCostD) / googleCostD;
      if (chg > 0.3)
        alerts.push(`🔴 CPL Google +${Math.round(chg * 100)}% (${brlShort(googleCostD)}→${brlShort(googleCostY)})`);
      else if (chg < -0.3)
        alerts.push(`✅ CPL Google -${Math.round(Math.abs(chg) * 100)}%`);
    }
    if (hasMeta && metaOutD > 0 && metaOutY > 0) {
      const chg = (metaOutY - metaOutD) / metaOutD;
      if (chg < -0.4)
        alerts.push(`⚠️ Leads Meta -${Math.round(Math.abs(chg) * 100)}%`);
    }
    if (hasGoogle && googleOutD > 0 && googleOutY > 0) {
      const chg = (googleOutY - googleOutD) / googleOutD;
      if (chg < -0.4)
        alerts.push(`⚠️ Leads Google -${Math.round(Math.abs(chg) * 100)}%`);
    }
  }

  if (alerts.length === 0) {
    lines.push("✅ Sem alertas");
  } else {
    for (const a of alerts) lines.push(a);
  }

  if (rodape) lines.push(rodape);

  return lines.join("\n");
}
