"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Loader2 } from "lucide-react";
import { Button, PillSelect, Switch, TextField } from "@/components/ui";
import type { TeamPaymentLink } from "@/lib/crm/payment-links";

type ChannelResult = { ok: boolean; detail: string };
type Results = Partial<Record<"whatsapp" | "email", ChannelResult>>;

type LinksPayload = {
  links: TeamPaymentLink[];
  mpReady: boolean;
  contact: { hasEmail: boolean; hasPhone: boolean };
  dealValue: number | null;
};

const STATUS_LABEL: Record<TeamPaymentLink["status"], string> = {
  PENDING: "Aguardando pagamento",
  PAID: "Pago",
  CANCELED: "Cancelado",
  EXPIRED: "Expirado",
  REFUNDED: "Estornado",
};

const INSTALLMENT_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: i === 0 ? "1x (à vista)" : `Até ${i + 1}x`,
}));

const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function parseMoneyToCents(raw: string) {
  const clean = raw.replace(/[^\d,.-]/g, "");
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="toolbar"
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" strokeWidth={2} /> : <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />}
      {copied ? "Copiado" : "Copiar link"}
    </Button>
  );
}

function ResultLines({ results }: { results: Results }) {
  const rows = (Object.entries(results) as Array<["whatsapp" | "email", ChannelResult]>).filter(([, r]) => r);
  if (!rows.length) return null;
  return (
    <ul className="space-y-1">
      {rows.map(([ch, r]) => (
        <li key={ch} className={`type-fine-print ${r.ok ? "text-[var(--ink-muted-80)]" : "text-[var(--danger)]"}`}>
          {ch === "whatsapp" ? "WhatsApp" : "E-mail"}: {r.detail}
        </li>
      ))}
    </ul>
  );
}

export function LeadPaymentLinks({ workspaceId, leadId }: { workspaceId: string; leadId: string }) {
  const qc = useQueryClient();
  const key = ["lead-payment-links", workspaceId, leadId];
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const r = await fetch(`/api/atrako/crm/leads/${leadId}/payment-links?workspaceId=${encodeURIComponent(workspaceId)}`);
      if (!r.ok) throw new Error("fail");
      return (await r.json()) as LinksPayload;
    },
  });

  const [amount, setAmount] = useState("");
  const [maxInstallments, setMaxInstallments] = useState("12");
  const [description, setDescription] = useState("");
  const [viaWhatsApp, setViaWhatsApp] = useState(true);
  const [viaEmail, setViaEmail] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<{ linkId: string; results: Results } | null>(null);

  useEffect(() => {
    if (!data) return;
    if (data.dealValue && !amount) setAmount(data.dealValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
    if (!data.contact.hasPhone) setViaWhatsApp(false);
    if (!data.contact.hasEmail) setViaEmail(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const channels = [viaWhatsApp && "whatsapp", viaEmail && "email"].filter(Boolean) as string[];

  async function refresh(next?: TeamPaymentLink[]) {
    if (next && data) qc.setQueryData(key, { ...data, links: next });
    else await qc.invalidateQueries({ queryKey: key });
    await qc.invalidateQueries({ queryKey: ["crm-lead", workspaceId, leadId] });
  }

  async function create() {
    setError("");
    const amountCents = parseMoneyToCents(amount);
    if (!Number.isFinite(amountCents) || amountCents < 100) return setError("Informe o valor negociado.");
    if (description.trim().length < 3) return setError("Descreva o que está sendo cobrado.");
    setPending(true);
    try {
      const r = await fetch(`/api/atrako/crm/leads/${leadId}/payment-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          amountCents,
          maxInstallments: Number(maxInstallments),
          description,
          channels,
        }),
      });
      const body = (await r.json().catch(() => ({}))) as {
        error?: string;
        link?: TeamPaymentLink;
        results?: Results;
        links?: TeamPaymentLink[];
      };
      if (!r.ok || !body.link) throw new Error(body.error || "Não foi possível gerar o link.");
      setResults({ linkId: body.link.id, results: body.results ?? {} });
      setDescription("");
      await refresh(body.links);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível gerar o link.");
    } finally {
      setPending(false);
    }
  }

  async function act(linkId: string, action: "cancel" | "resend") {
    setError("");
    const r = await fetch(`/api/atrako/crm/leads/${leadId}/payment-links`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, linkId, action, channels }),
    });
    const body = (await r.json().catch(() => ({}))) as { error?: string; results?: Results; links?: TeamPaymentLink[] };
    if (!r.ok) return setError(body.error || "Não foi possível concluir.");
    if (action === "resend") setResults({ linkId, results: body.results ?? {} });
    await refresh(body.links);
  }

  if (isLoading || !data) {
    return (
      <p className="flex items-center gap-2 type-fine-print text-[var(--ink-muted-48)]">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando cobranças…
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {!data.mpReady ? (
        <div className="utility-card p-4">
          <p className="type-caption-strong text-[var(--ink)]">Mercado Pago não conectado</p>
          <p className="mt-1 type-fine-print text-[var(--ink-muted-80)]">
            Para cobrar pelo link, a conta do Mercado Pago da empresa precisa ser conectada em Configurações → Conexões.
          </p>
        </div>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <p className="type-caption-strong text-[var(--ink)]">Novo link de pagamento</p>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Valor negociado (R$)" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00" />
            <div>
              <p className="type-caption-strong text-[var(--ink)]">Parcelamento</p>
              <PillSelect
                size="field"
                className="mt-2"
                value={maxInstallments}
                onChange={setMaxInstallments}
                options={INSTALLMENT_OPTIONS}
                aria-label="Parcelas no cartão"
              />
            </div>
          </div>
          <TextField
            label="O que está sendo cobrado"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex.: Taxa de adesão da franquia"
            maxLength={200}
          />
          <div className="space-y-2">
            <label className="flex items-center justify-between gap-3">
              <span className="type-caption text-[var(--ink)]">
                Enviar no WhatsApp
                {!data.contact.hasPhone ? <span className="text-[var(--ink-muted-48)]"> · sem telefone</span> : null}
              </span>
              <Switch checked={viaWhatsApp} onChange={setViaWhatsApp} disabled={!data.contact.hasPhone} aria-label="Enviar no WhatsApp" />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span className="type-caption text-[var(--ink)]">
                Enviar por e-mail
                {!data.contact.hasEmail ? <span className="text-[var(--ink-muted-48)]"> · sem e-mail</span> : null}
              </span>
              <Switch checked={viaEmail} onChange={setViaEmail} disabled={!data.contact.hasEmail} aria-label="Enviar por e-mail" />
            </label>
          </div>
          {error ? <p className="type-fine-print text-[var(--danger)]">{error}</p> : null}
          <Button type="submit" variant="primary" size="toolbar" disabled={pending}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {channels.length ? "Gerar e enviar link" : "Gerar link"}
          </Button>
          <p className="type-fine-print text-[var(--ink-muted-48)]">
            O lead paga no Pix ou no cartão (até o limite de parcelas). Quando o pagamento é aprovado, o lead vai para Ganho e o valor entra no Financeiro. O link vale 7 dias.
          </p>
        </form>
      )}

      {data.links.length ? (
        <div className="space-y-3">
          <p className="type-caption-strong text-[var(--ink)]">Links enviados</p>
          <ul className="divide-y divide-[var(--divider-soft)]">
            {data.links.map((l) => (
              <li key={l.id} className="space-y-2 py-3 first:pt-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="type-caption-strong text-[var(--ink)]">
                      {brl(l.amountCents)}
                      <span className="ml-1.5 type-fine-print text-[var(--ink-muted-48)]">
                        {l.maxInstallments > 1 ? `até ${l.maxInstallments}x` : "à vista"}
                      </span>
                    </p>
                    <p className="mt-0.5 truncate type-fine-print text-[var(--ink-muted-80)]">{l.description}</p>
                    <p className="mt-0.5 type-micro-legal text-[var(--ink-muted-48)]">
                      {[
                        `Criado ${fmtShort(l.createdAt)}`,
                        l.createdByName,
                        l.sentVia.length ? `enviado por ${l.sentVia.map((v) => (v === "whatsapp" ? "WhatsApp" : "e-mail")).join(" e ")}` : "não enviado",
                        l.paidAt ? `pago ${fmtShort(l.paidAt)}${l.method === "card" ? ` no cartão ${l.installments ?? 1}x` : l.method === "pix" ? " no Pix" : ""}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 type-fine-print ${
                      l.status === "PAID" ? "text-[var(--success)]" : l.status === "PENDING" ? "text-[var(--primary)]" : "text-[var(--ink-muted-48)]"
                    }`}
                  >
                    {STATUS_LABEL[l.status]}
                  </span>
                </div>
                {l.status === "PENDING" || l.status === "EXPIRED" ? (
                  <div className="flex flex-wrap gap-2">
                    {l.status === "PENDING" ? <CopyLink url={l.url} /> : null}
                    <Button type="button" variant="outline" size="toolbar" disabled={!channels.length} onClick={() => void act(l.id, "resend")}>
                      Reenviar
                    </Button>
                    {l.status === "PENDING" ? (
                      <Button type="button" variant="ghost" size="toolbar" onClick={() => void act(l.id, "cancel")}>
                        Cancelar
                      </Button>
                    ) : null}
                  </div>
                ) : null}
                {results?.linkId === l.id ? <ResultLines results={results.results} /> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
