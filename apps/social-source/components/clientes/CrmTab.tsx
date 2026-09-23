"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { FunilCrmSection } from "@/components/clientes/FunilCrmSection";
import {
  RefreshCw, Inbox, Search, X,
  ChevronLeft, ChevronRight, ChevronDown,
  BarChart3, MapPin, Layers, Filter, Eye,
  Wallet, TrendingUp, Home, CheckCircle,
} from "lucide-react";
import { isMiranteIncorporadora } from "@/lib/clientProfiles";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lead {
  id: string;
  crmLeadId: string;
  etapa: string;
  valor: number | null;
  dataEntrada: string;
  dataFechamento: string | null;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  contato: string | null;
  fonte: string | null;
  rating: number | null;
  status: string | null;
  momentoLead: string | null;
  dadosMarketing?: {
    faturamento?: string | null;
    segmento?: string | null;
    investimento?: string | null;
    interesse?: string | null;
    cargo?: string | null;
    origemMarketing?: string | null;
    eventoConversao?: string | null;
    empresa?: string | null;
    lifecycleStage?: string | null;
    metaAdId?: string | null;
    metaAdName?: string | null;
    metaAdsetId?: string | null;
    metaAdsetName?: string | null;
    metaCampaignId?: string | null;
    metaCampaignName?: string | null;
    metaFormId?: string | null;
    metaFormName?: string | null;
    utmSource?: string | null;
    utmMedium?: string | null;
    utmCampaign?: string | null;
    utmContent?: string | null;
    trafficSource?: string | null;
  } | null;
  dadosCv?: {
    origem?: string | null;
    origemUltimo?: string | null;
    midiaOriginal?: string | null;
    midiaUltimo?: string | null;
    conversaoOriginal?: string | null;
    conversaoUltimo?: string | null;
    empreendimento?: string | null;
    empreendimentoPrimeiro?: string | null;
    empreendimentoUltimo?: string | null;
    score?: number | null;
    possibilidadeVenda?: string | number | null;
    profissao?: string | null;
    rendaFamiliar?: string | null;
    feedback?: string | null;
    motivoCancelamento?: string | null;
    descricaoCancelamento?: string | null;
    submotivoCancelamento?: string | null;
    corretor?: string | null;
    corretorUltimo?: string | null;
    gestor?: string | null;
    imobiliaria?: string | null;
    pontoVenda?: string | null;
    regiao?: string | null;
    cidade?: string | null;
    estado?: string | null;
    tags?: string[] | string | null;
    reserva?: string | null;
    utmSource?: string | null;
    utmMedium?: string | null;
    utmCampaign?: string | null;
    utmContent?: string | null;
    utmTerm?: string | null;
  } | null;
}

interface LeadsApiResponse {
  leads: Lead[];
  total: number;
  page: number;
  pageSize: number;
}

interface PorFonte {
  fonte: string;
  canal: string;
  leads: number;
  ganhos: number;
  perdidos: number;
  andamento: number;
  visitou: number;
  valor: number;
  taxaGanho: number;
  taxaPerda: number;
  ratingMedio: number | null;
  investCanal: number | null;
}

interface PorCanal {
  canal: string;
  leads: number;
  ganhos: number;
  perdidos: number;
  andamento: number;
  visitou: number;
  valor: number;
  ratingMedio: number | null;
  pvMedio: number | null;
  investCanal: number | null;
}

interface PorEstado {
  estado: string;
  leads: number;
  ratingMedio: number | null;
}

interface PorConversao {
  conversao: string;
  leads: number;
  ratingMedio: number | null;
}

interface PorCampanha {
  campanha: string;
  canal: string;
  leads: number;
  ganhos: number;
  perdidos: number;
  andamento: number;
  visitou: number;
  valor: number;
  taxaGanho: number;
  investCanal: number | null;
}

interface PorCriativo {
  adName: string;
  adId: string | null;
  adsetName: string | null;
  campaignName: string | null;
  leads: number;
  ganhos: number;
  perdidos: number;
  andamento: number;
  visitou: number;
  valor: number;
  taxaGanho: number;
  spend: number;
  impressions: number;
  clicks: number;
}

interface PorCampanhaConfirmada {
  campaignName: string;
  leads: number;
  ganhos: number;
  perdidos: number;
  andamento: number;
  visitou: number;
  valor: number;
  taxaGanho: number;
}

interface MetaHierNodeBase {
  leads: number;
  ganhos: number;
  perdidos: number;
  andamento: number;
  visitou: number;
  valor: number;
  taxaGanho: number;
  spend: number;
}

interface MetaAdNode extends MetaHierNodeBase {
  adId: string | null;
  adName: string;
}

interface MetaAdsetNode extends MetaHierNodeBase {
  adsetId: string | null;
  adsetName: string;
  ads: MetaAdNode[];
}

interface MetaCampanhaNode extends MetaHierNodeBase {
  campaignId: string | null;
  campaignName: string;
  adsets: MetaAdsetNode[];
}

interface GoogleUtmNode {
  campaignName: string;
  leads: number;
  ganhos: number;
  perdidos: number;
  andamento: number;
  visitou: number;
  valor: number;
  taxaGanho: number;
  taxaPerda: number;
  ratingMedio: number | null;
  pvMedio: number | null;
}

interface TagRow {
  tag: string;
  count: number;
  isAlerta: boolean;
}

interface ReconversaoMeta {
  metaLeadId: string;
  fullName: string | null;
  emailLead: string | null;
  createdTime: string;
  campaignName: string | null;
  adsetName: string | null;
  adName: string | null;
  dataEntrada: string;
  etapa: string | null;
}

interface ReconversaoGoogle {
  leadCrmId: string;
  nome: string | null;
  email: string;
  dataEntrada: string;
  fonte: string | null;
  utmCampaign: string | null;
  dataEntradaAnterior: string;
  etapa: string | null;
}

interface AtribuicaoData {
  configured: boolean;
  totalLeads: number;
  totalGanhos: number;
  totalPerdidos: number;
  totalAndamento: number;
  totalValor: number;
  investMeta: number;
  investGoogle: number;
  leadsMeta: number;
  leadsGoogle: number;
  metaCrmLeads: number;
  googleCrmLeads: number;
  metaLeadsConfirmados: number;
  cplMetaCampanha: number | null;
  cplGoogleCampanha: number | null;
  cplMetaCrm: number | null;
  cplGoogleCrm: number | null;
  cplMetaConfirmado: number | null;
  cacMetaCrm: number | null;
  cacGoogleCrm: number | null;
  porFonte: PorFonte[];
  porCanal: PorCanal[];
  porEstado: PorEstado[];
  porConversao: PorConversao[];
  porCampanha: PorCampanha[];
  porCriativo: PorCriativo[];
  porCampanhaConfirmada: PorCampanhaConfirmada[];
  porMetaHierarquia: MetaCampanhaNode[];
  porGoogleUtmHier?: GoogleUtmNode[];
  totalLeadsMeta?: number;
  reconversoesMeta?: ReconversaoMeta[];
  reconversoesGoogle?: ReconversaoGoogle[];
  leadsComEstado: number;
  leadsComConversao: number;
  porTags: TagRow[];
  totalComTags: number;
  alertaLeads: number;
  visitasCount?: number;
  vendasCount?: number;
  ultimoSyncAt?: string | null;
}

// ─── Filter type ──────────────────────────────────────────────────────────────

type LeadFilter = {
  type: "canal" | "estado" | "conversao" | "etapa" | "funil" | "metaCampaign" | "metaAdset" | "metaAd" | "utmCampaign";
  value: string;
  label: string;
} | null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrencyBR(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateBR(iso: string | Date | null) {
  if (!iso) return "—";
  const d = new Date(iso as string);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function canalFromMidia(
  fonte: string | null,
  midiaOriginal?: string | null,
): "META" | "GOOGLE" | "ORGANICO" | "INDICACAO" | "DIRETO" | "OUTRO" {
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Primary: midiaOriginal (real paid media channel)
  if (midiaOriginal) {
    const m = norm(midiaOriginal);
    if (m.includes("facebook") || m.includes("meta") || m.includes("instagram") || m.includes("fb ads") || /\bfb\b/.test(m)) return "META";
    if (m.includes("google") || m.includes("youtube") || m.includes("pmax") || m.includes("busca paga")) return "GOOGLE";
    if (m.includes("indica") || m.includes("referral") || m.includes("amigo") || m.includes("parceiro")) return "INDICACAO";
    if (m.includes("organic") || m.includes("organico") || m.includes("seo")) return "ORGANICO";
    if (m.includes("email") || m.includes("whatsapp")) return "DIRETO";
  }

  // Fallback: fonte
  if (!fonte) return "OUTRO";
  const f = norm(fonte);
  if (f.includes("facebook") || f.includes("meta") || f.includes("instagram") || /\bfb\b/.test(f)) return "META";
  if (f.includes("google") || f.includes("busca paga") || f.includes("youtube") || f.includes("pmax")) return "GOOGLE";
  if (f.includes("organic") || f.includes("organico") || f.includes("seo")) return "ORGANICO";
  if (f.includes("indica") || f.includes("referral") || f.includes("referencia")) return "INDICACAO";
  if (f.includes("direto") || f.includes("direct") || f.includes("whatsapp") || f.includes("site") || f.includes("email")) return "DIRETO";
  return "OUTRO";
}

// Alert tags: leads that should probably not be in the active funnel
const ALERTA_KEYWORDS = [
  "nao quer", "sem interesse", "renda insuficiente", "contato inexistente",
  "desistencia", "invalido", "duplicado", "descartado", "nao quer imovel",
  "busca outra", "nao retorna",
];

function isAlertaTag(tag: string): boolean {
  const t = tag.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return ALERTA_KEYWORDS.some((k) => t.includes(k));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  won:     { label: "Ganho",        cls: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" },
  lost:    { label: "Perdido",      cls: "bg-red-500/10 text-red-400 border border-red-500/20" },
  ongoing: { label: "Em andamento", cls: "bg-blue-500/10 text-blue-400 border border-blue-500/20" },
  paused:  { label: "Pausado",      cls: "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20" },
};

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-[var(--border)]">—</span>;
  const cfg = STATUS_CFG[status] ?? { label: status, cls: "bg-[var(--muted)] text-[var(--muted-foreground)]" };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

const CANAL_CFG: Record<string, { label: string; color: string; hex: string }> = {
  META:      { label: "Meta",      color: "text-blue-400",                  hex: "#3b82f6" },
  GOOGLE:    { label: "Google",    color: "text-red-400",                   hex: "#ef4444" },
  ORGANICO:  { label: "Orgânico",  color: "text-emerald-400",               hex: "#10b981" },
  INDICACAO: { label: "Indicação", color: "text-purple-400",                hex: "#a855f7" },
  DIRETO:    { label: "Direto",    color: "text-amber-500",                 hex: "#f59e0b" },
  OUTRO:     { label: "Outro",     color: "text-[var(--muted-foreground)]", hex: "#6b7280" },
};

const PV_LABELS: Record<string, { label: string; color: string }> = {
  "1": { label: "Muito baixa", color: "text-red-400/80" },
  "2": { label: "Baixa",       color: "text-orange-400/80" },
  "3": { label: "Média",       color: "text-yellow-400/80" },
  "4": { label: "Alta",        color: "text-lime-400" },
  "5": { label: "Muito alta",  color: "text-emerald-400" },
};

const MOMENTO_LABELS: Record<string, { label: string; chip: string }> = {
  "lead frio":    { label: "Lead Frio",   chip: "bg-sky-500/10 text-sky-400 border border-sky-500/20" },
  "frio":         { label: "Lead Frio",   chip: "bg-sky-500/10 text-sky-400 border border-sky-500/20" },
  "lead morno":   { label: "Lead Morno",  chip: "bg-amber-500/10 text-amber-400 border border-amber-500/20" },
  "morno":        { label: "Lead Morno",  chip: "bg-amber-500/10 text-amber-400 border border-amber-500/20" },
  "lead quente":  { label: "Lead Quente", chip: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" },
  "quente":       { label: "Lead Quente", chip: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" },
  "sem momento":  { label: "Sem Momento", chip: "bg-[var(--muted)] text-[var(--muted-foreground)] border border-[var(--border)]" },
};

function getMomentoLabel(raw: string | null | undefined): { label: string; chip: string } | null {
  if (!raw) return null;
  const key = raw.toLowerCase().trim();
  return MOMENTO_LABELS[key] ?? { label: raw, chip: "bg-[var(--muted)] text-[var(--muted-foreground)] border border-[var(--border)]" };
}


function HorizontalBar({
  label, value, total, color, onClick, isActive,
}: {
  label: string;
  value: number;
  total: number;
  color?: string;
  onClick?: () => void;
  isActive?: boolean;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${
        onClick ? "cursor-pointer hover:bg-[var(--primary)]/8" : ""
      } ${isActive ? "bg-[var(--primary)]/10 ring-1 ring-inset ring-[var(--primary)]/20" : ""}`}
    >
      <span className={`w-28 shrink-0 truncate text-[11px] font-medium ${isActive ? "text-[var(--primary)]" : "text-[var(--foreground)]"}`} title={label}>
        {label}
      </span>
      <div className="flex min-w-0 flex-1 items-center">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--muted)]">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.max(pct, 0.5)}%`,
              backgroundColor: color ?? "var(--primary)",
              opacity: isActive ? 1 : 0.7,
            }}
          />
        </div>
      </div>
      <span className="w-10 shrink-0 text-right tabular-nums text-[10px] text-[var(--muted-foreground)]">
        {pct.toFixed(1)}%
      </span>
      <span className={`w-8 shrink-0 text-right tabular-nums text-[11px] font-bold ${isActive ? "text-[var(--primary)]" : "text-[var(--foreground)]"}`}>
        {value}
      </span>
    </div>
  );
}

// ─── Lead Detail Drawer ───────────────────────────────────────────────────────

function DField({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--muted-foreground)]">{label}</span>
      <span className="text-sm text-[var(--foreground)]">{value}</span>
    </div>
  );
}

function DSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--primary)]">{title}</p>
      <div className="grid grid-cols-2 gap-x-5 gap-y-3">{children}</div>
    </div>
  );
}

interface FormAnswer { label: string; value: string; }

function LeadDetailDrawer({
  lead, onClose, clienteId, isAgencia,
}: {
  lead: Lead | null;
  onClose: () => void;
  clienteId: string;
  isAgencia: boolean;
}) {
  React.useEffect(() => {
    if (!lead) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [lead, onClose]);

  const [formAnswers, setFormAnswers] = React.useState<FormAnswer[]>([]);
  const [formName, setFormName] = React.useState<string | null>(null);
  const [formLoading, setFormLoading] = React.useState(false);

  React.useEffect(() => {
    setFormAnswers([]);
    setFormName(null);
    if (!isAgencia || !lead?.telefone) return;
    setFormLoading(true);
    fetch(`/api/clientes/${clienteId}/crm/form-answers?phone=${encodeURIComponent(lead.telefone)}`)
      .then((r) => r.json())
      .then((data) => {
        setFormAnswers(data.answers ?? []);
        setFormName(data.formName ?? null);
      })
      .catch(() => {})
      .finally(() => setFormLoading(false));
  }, [lead?.id, isAgencia, clienteId, lead?.telefone]);

  const cv = lead?.dadosCv ?? null;
  const rawTagsField = cv?.tags;
  const cvTags: string[] = Array.isArray(rawTagsField)
    ? (rawTagsField as string[])
    : typeof rawTagsField === "string" && rawTagsField.trim()
      ? rawTagsField.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
  const mkt = lead?.dadosMarketing ?? null;
  // Use midiaOriginal as primary signal for canal display
  const canal = canalFromMidia(lead?.fonte ?? null, cv?.midiaOriginal ?? null);
  const canalCfg = CANAL_CFG[canal] ?? CANAL_CFG.OUTRO;
  const isOpen = lead !== null;

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <div
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-[500px] overflow-y-auto border-l border-[var(--border)] bg-[var(--background)] shadow-2xl transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {lead && (
          <div className="flex flex-col gap-6 p-6 pb-12">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={lead.status} />
                  <span className="rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--primary)]">
                    {lead.etapa}
                  </span>
                </div>
                <h2 className="text-xl font-extrabold leading-tight text-[var(--foreground)]">
                  {lead.nome ?? lead.email ?? lead.telefone ?? "Sem identificação"}
                </h2>
                {lead.nome && (lead.email ?? lead.telefone) && (
                  <p className="text-sm text-[var(--muted-foreground)]">{lead.email ?? lead.telefone}</p>
                )}
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="h-px bg-[var(--border)]" />

            {/* Contato */}
            <DSection title="Contato">
              {lead.email && <DField label="E-mail" value={lead.email} />}
              {lead.telefone && <DField label="Telefone" value={lead.telefone} />}
              <DField label="Data de entrada" value={formatDateBR(lead.dataEntrada)} />
            </DSection>

            <div className="h-px bg-[var(--border)]" />

            {/* Campanha & Mídia — o que ajuda a melhorar campanhas */}
            <DSection title="Campanha & Mídia">
              <DField label="Canal" value={
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: canalCfg.hex }} />
                  <span className={`font-semibold ${canalCfg.color}`}>{canalCfg.label}</span>
                </span>
              } />
              {mkt?.metaCampaignName && (
                <div className="col-span-2">
                  <DField label="Campanha" value={mkt.metaCampaignName} />
                </div>
              )}
              {mkt?.metaAdsetName && <DField label="Conjunto de anúncios" value={mkt.metaAdsetName} />}
              {mkt?.metaAdName && <DField label="Anúncio / Criativo" value={mkt.metaAdName} />}
              {mkt?.metaFormName && <DField label="Formulário" value={mkt.metaFormName} />}
              {cv?.conversaoOriginal && (
                <div className="col-span-2">
                  <DField label="Conversão (CRM)" value={cv.conversaoOriginal} />
                </div>
              )}
              {cv?.conversaoUltimo && cv.conversaoUltimo !== cv.conversaoOriginal && (
                <div className="col-span-2">
                  <DField label="Última conversão (CRM)" value={cv.conversaoUltimo} />
                </div>
              )}
              {cv?.utmCampaign && <DField label="UTM campaign" value={cv.utmCampaign} />}
              {cv?.utmContent && <DField label="UTM content" value={cv.utmContent} />}
              {cv?.utmTerm && <DField label="UTM term" value={cv.utmTerm} />}
              {cv?.midiaOriginal && !mkt?.metaCampaignName && (
                <DField label="Mídia original" value={cv.midiaOriginal} />
              )}
              {cv?.origem && <DField label="Origem" value={cv.origem} />}
              {cv?.origemUltimo && cv.origemUltimo !== cv.origem && (
                <DField label="Origem (último)" value={cv.origemUltimo} />
              )}
              {cv?.estado && (
                <DField label="Localização" value={
                  [cv.cidade, cv.estado].filter(Boolean).join(" / ")
                } />
              )}
              {!cv?.estado && cv?.regiao && <DField label="Região" value={cv.regiao} />}
            </DSection>

            {/* Qualidade do lead */}
            {(cv?.score != null || lead.momentoLead || cv?.possibilidadeVenda != null || cv?.profissao || cv?.rendaFamiliar) && (
              <>
                <div className="h-px bg-[var(--border)]" />
                <DSection title="Qualidade do Lead">
                  {cv?.score != null && (
                    <DField label="Score CV" value={
                      <span className="font-bold text-[var(--primary)]">{cv.score}</span>
                    } />
                  )}
                  {lead.momentoLead && (() => {
                    const m = getMomentoLabel(lead.momentoLead);
                    return m ? (
                      <DField label="Temperatura" value={
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${m.chip}`}>{m.label}</span>
                      } />
                    ) : null;
                  })()}
                  {cv?.possibilidadeVenda != null && (
                    <DField label="Possib. de venda" value={
                      (() => {
                        const key = String(cv.possibilidadeVenda);
                        const cfg = PV_LABELS[key];
                        return cfg
                          ? <span className={cfg.color}>{key} — {cfg.label}</span>
                          : String(cv.possibilidadeVenda);
                      })()
                    } />
                  )}
                  {cv?.profissao && <DField label="Profissão" value={cv.profissao} />}
                  {cv?.rendaFamiliar && <DField label="Renda familiar" value={cv.rendaFamiliar} />}
                </DSection>
              </>
            )}

            {/* Comercial — o que ajuda a fechar a venda */}
            {(cv?.empreendimento || cv?.corretor || cv?.gestor || cv?.imobiliaria || cv?.pontoVenda || lead.valor != null || cv?.reserva || lead.dataFechamento) && (
              <>
                <div className="h-px bg-[var(--border)]" />
                <DSection title="Comercial">
                  {cv?.empreendimento && (
                    <div className="col-span-2">
                      <DField label="Empreendimento" value={cv.empreendimento} />
                    </div>
                  )}
                  {cv?.pontoVenda && <DField label="Ponto de venda" value={cv.pontoVenda} />}
                  {cv?.corretor && <DField label="Corretor" value={cv.corretor} />}
                  {cv?.gestor && <DField label="Gestor" value={cv.gestor} />}
                  {cv?.imobiliaria && (
                    <div className="col-span-2">
                      <DField label="Imobiliária" value={cv.imobiliaria} />
                    </div>
                  )}
                  {lead.valor != null && (
                    <DField label="Valor" value={
                      <span className="font-bold text-emerald-400">{formatCurrencyBR(lead.valor)}</span>
                    } />
                  )}
                  {cv?.reserva && <DField label="Reserva" value={cv.reserva} />}
                  {lead.dataFechamento && <DField label="Fechamento" value={formatDateBR(lead.dataFechamento)} />}
                  {cv?.feedback && (
                    <div className="col-span-2">
                      <DField label="Feedback" value={cv.feedback} />
                    </div>
                  )}
                </DSection>
              </>
            )}

            {/* Tags */}
            {cvTags.length > 0 && (
              <>
                <div className="h-px bg-[var(--border)]" />
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--primary)]">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[...cvTags]
                      .sort((a, b) => Number(isAlertaTag(b)) - Number(isAlertaTag(a)))
                      .map((tag) => {
                        const alerta = isAlertaTag(tag);
                        return (
                          <span
                            key={tag}
                            className={
                              alerta
                                ? "inline-flex items-center gap-1 rounded-full border border-red-500/25 bg-red-500/10 px-2.5 py-0.5 text-[11px] font-medium text-red-400"
                                : "rounded-full border border-[var(--border)] bg-[var(--muted)] px-2.5 py-0.5 text-[11px] text-[var(--foreground)]"
                            }
                          >
                            {alerta && <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />}
                            {tag}
                          </span>
                        );
                      })}
                  </div>
                </div>
              </>
            )}

            {/* Motivo de perda */}
            {lead.status === "lost" && cv?.motivoCancelamento && (
              <>
                <div className="h-px bg-[var(--border)]" />
                <div className="space-y-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-400">Motivo de Perda</p>
                  <div className="grid grid-cols-2 gap-x-5 gap-y-3">
                    <DField label="Motivo" value={<span className="text-red-400">{cv.motivoCancelamento}</span>} />
                    {cv.submotivoCancelamento && (
                      <DField label="Submotivo" value={<span className="text-red-400">{cv.submotivoCancelamento}</span>} />
                    )}
                    {cv.descricaoCancelamento && (
                      <div className="col-span-2">
                        <DField label="Descrição" value={<span className="text-red-400">{cv.descricaoCancelamento}</span>} />
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Respostas do Formulário (agência — match por telefone com MetaLeadIndividual) */}
            {isAgencia && (formLoading || formAnswers.length > 0) && (
              <>
                <div className="h-px bg-[var(--border)]" />
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--primary)]">
                      Respostas do Formulário
                    </p>
                    {formName && (
                      <span className="truncate rounded-full bg-[var(--muted)] px-2 py-0.5 text-[10px] text-[var(--muted-foreground)]">
                        {formName}
                      </span>
                    )}
                  </div>
                  {formLoading ? (
                    <div className="flex items-center gap-2 text-[12px] text-[var(--muted-foreground)]">
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
                      Carregando respostas…
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-x-5 gap-y-3">
                      {formAnswers.map((a) => (
                        <div key={a.label} className={a.value.length > 40 ? "col-span-2" : ""}>
                          <DField label={a.label} value={a.value} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Marketing (non-CV) */}
            {mkt && !cv && (mkt.faturamento || mkt.segmento || mkt.cargo || mkt.empresa) && (
              <>
                <div className="h-px bg-[var(--border)]" />
                <DSection title="Dados de Marketing">
                  {mkt.empresa && <DField label="Empresa" value={mkt.empresa} />}
                  {mkt.faturamento && <DField label="Faturamento" value={mkt.faturamento} />}
                  {mkt.segmento && <DField label="Segmento" value={mkt.segmento} />}
                  {mkt.cargo && <DField label="Cargo" value={mkt.cargo} />}
                  {mkt.origemMarketing && <DField label="Origem marketing" value={mkt.origemMarketing} />}
                  {mkt.eventoConversao && <DField label="Evento de conversão" value={mkt.eventoConversao} />}
                  {mkt.lifecycleStage && <DField label="Lifecycle stage" value={mkt.lifecycleStage} />}
                </DSection>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Campaign Section ─────────────────────────────────────────────────────────

function CampanhaSection({ data }: { data: AtribuicaoData }) {
  const porCampanha = data.porCampanha ?? [];
  const metaCampanhas = porCampanha.filter((m) => m.canal === "META").sort((a, b) => b.leads - a.leads);
  const googleCampanhas = porCampanha.filter((m) => m.canal === "GOOGLE").sort((a, b) => b.leads - a.leads);

  if (metaCampanhas.length === 0 && googleCampanhas.length === 0) return null;

  // Suppress when all rows share a single portal name — it duplicates "Canais de Origem" without adding info.
  const allCampanhas = [...metaCampanhas, ...googleCampanhas];
  const uniquePortals = new Set(allCampanhas.map((r) => r.campanha));
  if (uniquePortals.size <= 1) return null;

  const CampanhaTable = ({
    rows,
    canal,
    investCanal,
  }: {
    rows: PorCampanha[];
    canal: "META" | "GOOGLE";
    investCanal: number;
  }) => {
    const cfg = CANAL_CFG[canal];
    const totalLeads = rows.reduce((s, r) => s + r.leads, 0);
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className={`inline-block h-2 w-2 rounded-full`} style={{ backgroundColor: cfg.hex }} />
          <p className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</p>
          <span className="text-xs text-[var(--muted-foreground)]">· {totalLeads} leads</span>
          {investCanal > 0 && (
            <span className="text-xs text-[var(--muted-foreground)]">
              · {formatCurrencyBR(investCanal)} investidos
            </span>
          )}
        </div>
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="min-w-[600px] w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30">
                {["Conversão / Portal CRM", "Leads", "Visitou", "Em aberto", "Ganhos", "Conv%"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--muted-foreground)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.campanha}
                  className={`border-b border-[var(--border)]/50 transition-colors hover:bg-[var(--muted)]/20 ${
                    i % 2 === 0 ? "" : "bg-[var(--muted)]/10"
                  }`}
                >
                  <td className="px-4 py-2.5">
                    <span className="max-w-[200px] block truncate font-medium text-[var(--foreground)]" title={row.campanha}>
                      {row.campanha}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums font-semibold text-[var(--foreground)]">{row.leads}</td>
                  <td className="px-4 py-2.5 tabular-nums text-[var(--muted-foreground)]">
                    {row.visitou > 0 ? row.visitou : <span className="opacity-40">—</span>}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-blue-400">{row.andamento}</td>
                  <td className="px-4 py-2.5 tabular-nums font-bold text-emerald-400">
                    {row.ganhos > 0 ? row.ganhos : <span className="font-normal opacity-40">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {row.leads > 0 ? (
                      <span className={`tabular-nums font-semibold ${row.taxaGanho > 0 ? "text-emerald-400" : "text-[var(--muted-foreground)]"}`}>
                        {row.taxaGanho}%
                      </span>
                    ) : (
                      <span className="opacity-40">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="mt-1 h-8 w-1 shrink-0 rounded-full bg-[var(--primary)]" />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">CRM</p>
          <h2 className="text-xl font-extrabold tracking-tight text-[var(--foreground)]">Por Portal de Entrada</h2>
        </div>
      </div>
      <div className="space-y-6">
        {metaCampanhas.length > 0 && (
          <CampanhaTable rows={metaCampanhas} canal="META" investCanal={data.investMeta ?? 0} />
        )}
        {googleCampanhas.length > 0 && (
          <CampanhaTable rows={googleCampanhas} canal="GOOGLE" investCanal={data.investGoogle ?? 0} />
        )}
      </div>
      <p className="text-[10px] text-[var(--muted-foreground)]">
        "Portal de Entrada" = como o lead chegou ao CRM (ex: <span className="font-medium">RdStation</span> = integração via RD Station; <span className="font-medium">Painel Corretor</span> = cadastro pelo app do corretor). Não é o nome da campanha — nomes de campanha aparecem em CRM × Meta.
      </p>
    </div>
  );
}

// ─── Meta Hierarquia (Campanha → Conjunto → Anúncio) ──────────────────────────

function AdPreviewModal({ adId, adName, onClose }: { adId: string; adName: string; onClose: () => void }) {
  const [iframeBody, setIframeBody] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);
  const [preview, setPreview] = React.useState<{ src: string; w: number; h: number } | null>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  React.useEffect(() => {
    setLoading(true);
    fetch(`/api/meta/preview?adId=${encodeURIComponent(adId)}&adFormat=MOBILE_FEED_STANDARD`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data: { body?: string }) => {
        if (data?.body) setIframeBody(data.body);
        else setFailed(true);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [adId]);

  React.useEffect(() => {
    if (!iframeBody) return;
    try {
      const doc = new DOMParser().parseFromString(iframeBody, "text/html");
      const iframe = doc.querySelector("iframe");
      const src = iframe?.getAttribute("src") ?? "";
      const w = parseInt(iframe?.getAttribute("width") ?? "0", 10) || 320;
      const h = parseInt(iframe?.getAttribute("height") ?? "0", 10) || 560;
      if (src) setPreview({ src, w, h });
      else setFailed(true);
    } catch { setFailed(true); }
  }, [iframeBody]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl bg-[var(--card)] border border-white/[0.08] overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
          <Eye className="w-4 h-4 text-[var(--primary)] flex-shrink-0" />
          <p className="text-sm font-semibold text-[var(--foreground)] flex-1 min-w-0 truncate">{adName}</p>
          <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors flex-shrink-0 p-1" aria-label="Fechar">✕</button>
        </div>
        <div className="flex items-center justify-center bg-black min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-12 text-[var(--muted-foreground)]">
              <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs">Carregando prévia…</p>
            </div>
          ) : preview ? (
            (() => {
              const scale = 320 / preview.w;
              const displayH = Math.round(preview.h * scale);
              return (
                <div style={{ width: 320, height: displayH, overflow: "hidden", position: "relative" }}>
                  <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: preview.w, height: preview.h }}>
                    <iframe title="Prévia do anúncio" src={preview.src} scrolling="no" style={{ border: "none", display: "block", width: preview.w, height: preview.h }} />
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="flex flex-col items-center gap-3 py-12 text-[var(--muted-foreground)]">
              <Eye className="w-12 h-12 opacity-20" />
              <p className="text-xs">{failed ? "Prévia não disponível" : "Nenhuma prévia"}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetaHierStat({ value, cls, dash }: { value: number; cls: string; dash?: boolean }) {
  if (value > 0) return <span className={`tabular-nums font-semibold ${cls}`}>{value.toLocaleString("pt-BR")}</span>;
  return dash ? <span className="opacity-25 text-[var(--muted-foreground)]">—</span> : <span className="tabular-nums text-[var(--muted-foreground)]">0</span>;
}

function MetaHierarquiaSection({
  data,
  activeFilter,
  onFilter,
  isAgencia,
}: {
  data: AtribuicaoData;
  activeFilter: LeadFilter;
  onFilter: (f: LeadFilter) => void;
  isAgencia?: boolean;
}) {
  const campanhas = data.porMetaHierarquia ?? [];
  const [openCamp, setOpenCamp] = React.useState<Set<string>>(new Set());
  const [openAdset, setOpenAdset] = React.useState<Set<string>>(new Set());
  const [previewAd, setPreviewAd] = React.useState<{ adId: string; adName: string } | null>(null);

  if (campanhas.length === 0) return null;

  const toggle = (set: Set<string>, key: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key); else next.add(key);
    setter(next);
  };

  const totalLeads = campanhas.reduce((s, c) => s + c.leads, 0);
  const totalGanhos = campanhas.reduce((s, c) => s + c.ganhos, 0);
  const totalValor = campanhas.reduce((s, c) => s + c.valor, 0);
  const metaHex = "#3b82f6";

  const isNodeActive = (type: "metaCampaign" | "metaAdset" | "metaAd", id: string | null) =>
    id != null && activeFilter?.type === type && activeFilter.value === id;

  const cpl = (spend: number, leads: number) => (spend > 0 && leads > 0 ? spend / leads : null);

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="mt-1 h-8 w-1 shrink-0 rounded-full bg-[var(--primary)]" />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">CRM × Meta</p>
          <h2 className="text-xl font-extrabold tracking-tight text-[var(--foreground)]">Campanha → Conjunto → Anúncio</h2>
        </div>
      </div>

      {/* Summary chips */}
      {totalGanhos > 0 && (
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5">
            <span className="text-xs font-semibold text-emerald-400">{totalGanhos} {isAgencia ? "fechamento" : "venda"}{totalGanhos !== 1 ? "s" : ""}</span>
            {totalValor > 0 && <span className="text-xs text-emerald-400/60">· {formatCurrencyBR(totalValor)}</span>}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="min-w-[860px] w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30">
              {(isAgencia
                ? ["Campanha / Conjunto / Anúncio", "Leads", "Atend.", "Fechamentos", "Valor", "Invest.", "CPL", "Conv%"]
                : ["Campanha / Conjunto / Anúncio", "Leads", "Visitas", "Atend.", "Vendas", "Valor", "Invest.", "CPL", "Conv%"]
              ).map((h, i) => (
                <th key={h} className={`px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--muted-foreground)] ${i === 0 ? "text-left" : "text-right"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {campanhas.map((camp) => {
              const campKey = camp.campaignId ?? camp.campaignName;
              const campOpen = openCamp.has(campKey);
              const campActive = isNodeActive("metaCampaign", camp.campaignId);
              const campCpl = cpl(camp.spend, camp.leads);
              return (
                <React.Fragment key={campKey}>
                  {/* Campaign row */}
                  <tr className={`border-b border-[var(--border)]/60 transition-colors hover:bg-[var(--muted)]/20 ${campActive ? "bg-[var(--primary)]/[0.06]" : ""}`}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => toggle(openCamp, campKey, setOpenCamp)}
                          className="shrink-0 rounded p-0.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)]/50 hover:text-[var(--foreground)]"
                          aria-label={campOpen ? "Recolher" : "Expandir"}
                        >
                          {campOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                        <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: metaHex }} />
                        <button
                          type="button"
                          disabled={camp.campaignId == null}
                          onClick={() => onFilter(campActive ? null : { type: "metaCampaign", value: camp.campaignId!, label: `Campanha: ${camp.campaignName}` })}
                          className={`max-w-[280px] truncate text-left font-semibold ${camp.campaignId == null ? "cursor-default" : "hover:text-[var(--primary)]"} ${campActive ? "text-[var(--primary)]" : "text-[var(--foreground)]"}`}
                          title={camp.campaignName}
                        >
                          {camp.campaignName}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right"><MetaHierStat value={camp.leads} cls="text-[var(--foreground)]" /></td>
                    {!isAgencia && <td className="px-4 py-2.5 text-right"><MetaHierStat value={camp.visitou} cls="text-amber-400" dash /></td>}
                    <td className="px-4 py-2.5 text-right"><MetaHierStat value={camp.andamento} cls="text-blue-400" dash /></td>
                    <td className="px-4 py-2.5 text-right"><MetaHierStat value={camp.ganhos} cls="text-emerald-400" dash /></td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-[var(--muted-foreground)]">{camp.valor > 0 ? formatCurrencyBR(camp.valor) : <span className="opacity-25">—</span>}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-[var(--muted-foreground)]">{camp.spend > 0 ? formatCurrencyBR(camp.spend) : <span className="opacity-25">—</span>}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{campCpl != null ? <span className="font-semibold text-[var(--primary)]">{formatCurrencyBR(campCpl)}</span> : <span className="opacity-25">—</span>}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{camp.leads > 0 ? <span className={camp.taxaGanho > 0 ? "font-semibold text-emerald-400" : "text-[var(--muted-foreground)]"}>{camp.taxaGanho}%</span> : <span className="opacity-25">—</span>}</td>
                  </tr>

                  {/* Adset rows */}
                  {campOpen && camp.adsets.map((as) => {
                    const adsetKey = `${campKey}::${as.adsetId ?? as.adsetName}`;
                    const adsetOpen = openAdset.has(adsetKey);
                    const adsetActive = isNodeActive("metaAdset", as.adsetId);
                    const adsetCpl = cpl(as.spend, as.leads);
                    return (
                      <React.Fragment key={adsetKey}>
                        <tr className={`border-b border-[var(--border)]/40 bg-[var(--muted)]/[0.08] transition-colors hover:bg-[var(--muted)]/20 ${adsetActive ? "bg-[var(--primary)]/[0.06]" : ""}`}>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-1.5 pl-6">
                              <button
                                type="button"
                                onClick={() => toggle(openAdset, adsetKey, setOpenAdset)}
                                className="shrink-0 rounded p-0.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)]/50 hover:text-[var(--foreground)]"
                                aria-label={adsetOpen ? "Recolher" : "Expandir"}
                              >
                                {adsetOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                              </button>
                              <button
                                type="button"
                                disabled={as.adsetId == null}
                                onClick={() => onFilter(adsetActive ? null : { type: "metaAdset", value: as.adsetId!, label: `Conjunto: ${as.adsetName}` })}
                                className={`max-w-[260px] truncate text-left text-xs font-medium ${as.adsetId == null ? "cursor-default" : "hover:text-[var(--primary)]"} ${adsetActive ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`}
                                title={as.adsetName}
                              >
                                {as.adsetName}
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right"><MetaHierStat value={as.leads} cls="text-[var(--foreground)]" /></td>
                          {!isAgencia && <td className="px-4 py-2 text-right"><MetaHierStat value={as.visitou} cls="text-amber-400" dash /></td>}
                          <td className="px-4 py-2 text-right"><MetaHierStat value={as.andamento} cls="text-blue-400" dash /></td>
                          <td className="px-4 py-2 text-right"><MetaHierStat value={as.ganhos} cls="text-emerald-400" dash /></td>
                          <td className="px-4 py-2 text-right tabular-nums text-[var(--muted-foreground)]">{as.valor > 0 ? formatCurrencyBR(as.valor) : <span className="opacity-25">—</span>}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-[var(--muted-foreground)]">{as.spend > 0 ? formatCurrencyBR(as.spend) : <span className="opacity-25">—</span>}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{adsetCpl != null ? <span className="font-semibold text-[var(--primary)]">{formatCurrencyBR(adsetCpl)}</span> : <span className="opacity-25">—</span>}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{as.leads > 0 ? <span className={as.taxaGanho > 0 ? "font-semibold text-emerald-400" : "text-[var(--muted-foreground)]"}>{as.taxaGanho}%</span> : <span className="opacity-25">—</span>}</td>
                        </tr>

                        {/* Ad rows */}
                        {adsetOpen && as.ads.map((ad) => {
                          const adKey = `${adsetKey}::${ad.adId ?? ad.adName}`;
                          const adActive = isNodeActive("metaAd", ad.adId);
                          const adCpl = cpl(ad.spend, ad.leads);
                          return (
                            <tr key={adKey} className={`border-b border-[var(--border)]/30 transition-colors hover:bg-[var(--muted)]/20 ${adActive ? "bg-[var(--primary)]/[0.06]" : ""}`}>
                              <td className="px-4 py-1.5">
                                <div className="flex items-center gap-1.5 pl-[3.25rem]">
                                  <span className="inline-block h-1 w-1 shrink-0 rounded-full bg-[var(--muted-foreground)]/40" />
                                  <button
                                    type="button"
                                    disabled={ad.adId == null}
                                    onClick={() => onFilter(adActive ? null : { type: "metaAd", value: ad.adId!, label: `Anúncio: ${ad.adName}` })}
                                    className={`max-w-[200px] truncate text-left text-xs ${ad.adId == null ? "cursor-default" : "hover:text-[var(--primary)]"} ${adActive ? "font-semibold text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`}
                                    title={ad.adName}
                                  >
                                    {ad.adName}
                                  </button>
                                  {ad.adId && (
                                    <button
                                      type="button"
                                      onClick={() => setPreviewAd({ adId: ad.adId!, adName: ad.adName })}
                                      className="shrink-0 rounded p-0.5 text-[var(--muted-foreground)]/50 hover:text-[var(--primary)] transition-colors"
                                      title="Ver criativo"
                                    >
                                      <Eye className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-1.5 text-right"><MetaHierStat value={ad.leads} cls="text-[var(--foreground)]" /></td>
                              {!isAgencia && <td className="px-4 py-1.5 text-right"><MetaHierStat value={ad.visitou} cls="text-amber-400" dash /></td>}
                              <td className="px-4 py-1.5 text-right"><MetaHierStat value={ad.andamento} cls="text-blue-400" dash /></td>
                              <td className="px-4 py-1.5 text-right"><MetaHierStat value={ad.ganhos} cls="text-emerald-400" dash /></td>
                              <td className="px-4 py-1.5 text-right tabular-nums text-[var(--muted-foreground)]">{ad.valor > 0 ? formatCurrencyBR(ad.valor) : <span className="opacity-25">—</span>}</td>
                              <td className="px-4 py-1.5 text-right tabular-nums text-[var(--muted-foreground)]">{ad.spend > 0 ? formatCurrencyBR(ad.spend) : <span className="opacity-25">—</span>}</td>
                              <td className="px-4 py-1.5 text-right tabular-nums">{adCpl != null ? <span className="font-semibold text-[var(--primary)]">{formatCurrencyBR(adCpl)}</span> : <span className="opacity-25">—</span>}</td>
                              <td className="px-4 py-1.5 text-right tabular-nums">{ad.leads > 0 ? <span className={ad.taxaGanho > 0 ? "font-semibold text-emerald-400" : "text-[var(--muted-foreground)]"}>{ad.taxaGanho}%</span> : <span className="opacity-25">—</span>}</td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {previewAd && (
        <AdPreviewModal
          adId={previewAd.adId}
          adName={previewAd.adName}
          onClose={() => setPreviewAd(null)}
        />
      )}
    </div>
  );
}

// ─── Google UTM Hierarquia Section ────────────────────────────────────────────

function GoogleUtmHierarquiaSection({
  data,
  activeFilter,
  onFilter,
  isAgencia,
}: {
  data: AtribuicaoData;
  activeFilter: LeadFilter;
  onFilter: (f: LeadFilter) => void;
  isAgencia?: boolean;
}) {
  const campanhas = data.porGoogleUtmHier ?? [];
  if (campanhas.length === 0) return null;

  const totalLeads  = campanhas.reduce((s, c) => s + c.leads, 0);
  const totalGanhos = campanhas.reduce((s, c) => s + c.ganhos, 0);
  const totalValor  = campanhas.reduce((s, c) => s + c.valor, 0);
  const googleHex   = "#3b82f6";

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="mt-1 h-8 w-1 shrink-0 rounded-full bg-[var(--primary)]" />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">CRM × Google</p>
          <h2 className="text-xl font-extrabold tracking-tight text-[var(--foreground)]">Campanha UTM → Leads</h2>
        </div>
      </div>

      {totalGanhos > 0 && (
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5">
            <span className="text-xs font-semibold text-emerald-400">{totalGanhos} {isAgencia ? (totalGanhos === 1 ? "fechamento" : "fechamentos") : (totalGanhos === 1 ? "venda" : "vendas")}</span>
            {totalValor > 0 && <span className="text-xs text-emerald-400/60">· {formatCurrencyBR(totalValor)}</span>}
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/5 px-3 py-1.5">
            <span className="text-xs font-semibold text-blue-400">{totalLeads} leads Google</span>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="min-w-[620px] w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30">
              {(isAgencia
                ? ["Campanha UTM", "Leads", "Atend.", "Fechamentos", "Valor", "Conv%"]
                : ["Campanha UTM", "Leads", "Visitas", "Atend.", "Vendas", "Valor", "Conv%"]
              ).map((h, i) => (
                <th key={h} className={`px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--muted-foreground)] ${i === 0 ? "text-left" : "text-right"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {campanhas.map((camp) => {
              const isActive = activeFilter?.type === "utmCampaign" && activeFilter.value === camp.campaignName;
              return (
                <tr
                  key={camp.campaignName}
                  className={`border-b border-[var(--border)]/60 transition-colors hover:bg-[var(--muted)]/20 ${isActive ? "bg-[var(--primary)]/[0.06]" : ""}`}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: googleHex }} />
                      <button
                        type="button"
                        onClick={() => onFilter(isActive ? null : { type: "utmCampaign", value: camp.campaignName, label: `Campanha: ${camp.campaignName}` })}
                        className={`max-w-[340px] truncate text-left font-semibold hover:text-[var(--primary)] ${isActive ? "text-[var(--primary)]" : "text-[var(--foreground)]"}`}
                        title={camp.campaignName}
                      >
                        {camp.campaignName}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="tabular-nums font-semibold text-[var(--foreground)]">{camp.leads.toLocaleString("pt-BR")}</span>
                  </td>
                  {!isAgencia && (
                    <td className="px-4 py-2.5 text-right">
                      {camp.visitou > 0
                        ? <span className="tabular-nums font-semibold text-amber-400">{camp.visitou.toLocaleString("pt-BR")}</span>
                        : <span className="opacity-25 text-[var(--muted-foreground)]">—</span>}
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-right">
                    {camp.andamento > 0
                      ? <span className="tabular-nums font-semibold text-blue-400">{camp.andamento.toLocaleString("pt-BR")}</span>
                      : <span className="opacity-25 text-[var(--muted-foreground)]">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {camp.ganhos > 0
                      ? <span className="tabular-nums font-semibold text-emerald-400">{camp.ganhos.toLocaleString("pt-BR")}</span>
                      : <span className="opacity-25 text-[var(--muted-foreground)]">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-[var(--muted-foreground)]">
                    {camp.valor > 0 ? formatCurrencyBR(camp.valor) : <span className="opacity-25">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {camp.leads > 0
                      ? <span className={camp.taxaGanho > 0 ? "font-semibold text-emerald-400" : "text-[var(--muted-foreground)]"}>{camp.taxaGanho}%</span>
                      : <span className="opacity-25">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Reconversões Modal ───────────────────────────────────────────────────────

function ReconversoesModal({
  canal,
  metaItems,
  googleItems,
  onClose,
}: {
  canal: "META" | "GOOGLE";
  metaItems?: ReconversaoMeta[];
  googleItems?: ReconversaoGoogle[];
  onClose: () => void;
}) {
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const isMeta = canal === "META";

  // Normalise both sources to a unified display row
  const rows = isMeta
    ? (metaItems ?? []).map((r) => ({
        id: r.metaLeadId,
        nome: r.fullName,
        email: r.emailLead,
        primary: r.adName,
        secondary: r.campaignName,
        dataConversao: r.createdTime,
        dataCrm: r.dataEntrada,
        etapa: r.etapa,
      }))
    : (googleItems ?? []).map((r) => ({
        id: r.leadCrmId,
        nome: r.nome,
        email: r.email,
        primary: r.fonte,
        secondary: r.utmCampaign,
        dataConversao: r.dataEntrada,
        dataCrm: r.dataEntradaAnterior,
        etapa: r.etapa,
      }));

  const accentColor = isMeta ? "var(--primary)" : "#3b82f6";
  const labelCanal  = isMeta ? "Meta Ads" : "Google Ads";
  const colAtrib    = isMeta ? "Anúncio / Campanha" : "Origem / Campanha UTM";
  const colConv     = isMeta ? "Nova conversão" : "Nova entrada";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-3xl border border-white/[0.08] bg-[var(--card)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-white/[0.06]">
          <div className="mt-1 h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: accentColor }} />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: accentColor }}>{labelCanal}</p>
            <h3 className="text-lg font-extrabold tracking-tight text-[var(--foreground)]">
              Reconversões · {rows.length}
            </h3>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)] leading-snug">
              {isMeta
                ? "Leads que já estavam no CRM e preencheram o formulário novamente no período"
                : "Leads Google do período cujo e-mail já constava no CRM antes do período selecionado"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-0.5 shrink-0 p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto max-h-[68vh] overflow-y-auto">
          <table className="min-w-[600px] w-full text-sm">
            <thead className="sticky top-0 z-10 bg-[var(--card)] border-b border-white/[0.06]">
              <tr>
                {["Lead", colAtrib, colConv, "No CRM desde", "Etapa atual"].map((h) => (
                  <th key={h} className="px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--muted-foreground)] text-left whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-semibold text-[var(--foreground)] leading-tight">{r.nome || "—"}</p>
                    {r.email && <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">{r.email}</p>}
                  </td>
                  <td className="px-5 py-3.5 max-w-[200px]">
                    <p className="text-xs font-medium text-[var(--foreground)] leading-snug">{r.primary || "—"}</p>
                    {r.secondary && <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5 leading-snug">{r.secondary}</p>}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-[var(--muted-foreground)] tabular-nums whitespace-nowrap">
                    {formatDateBR(r.dataConversao)}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-[var(--muted-foreground)] tabular-nums whitespace-nowrap">
                    {formatDateBR(r.dataCrm)}
                  </td>
                  <td className="px-5 py-3.5">
                    {r.etapa ? (
                      <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold" style={{ borderColor: `color-mix(in srgb, ${accentColor} 20%, transparent)`, backgroundColor: `color-mix(in srgb, ${accentColor} 8%, transparent)`, color: accentColor }}>
                        {r.etapa}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--muted-foreground)] opacity-40">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Análise de Origem Section ────────────────────────────────────────────────

function AtribuicaoSection({
  clienteId,
  dateRange,
  activeFilter,
  onFilter,
  isAgencia,
  isMirante,
}: {
  clienteId: string;
  dateRange: { from: string; to: string };
  activeFilter: LeadFilter;
  onFilter: (f: LeadFilter) => void;
  isAgencia?: boolean;
  isMirante?: boolean;
}) {
  const [convSearch, setConvSearch] = React.useState("");
  const [reconversoesOpen, setReconversoesOpen] = React.useState(false);
  const [reconversoesGoogleOpen, setReconversoesGoogleOpen] = React.useState(false);

  const filterQs = activeFilter
    ? `&filterType=${encodeURIComponent(activeFilter.type)}&filterValue=${encodeURIComponent(activeFilter.value)}`
    : "";

  const paidOnlyQs = isAgencia ? "&paidOnly=1" : "";

  const { data, isLoading } = useQuery<AtribuicaoData>({
    queryKey: ["crm-atribuicao", clienteId, dateRange.from, dateRange.to, activeFilter?.type, activeFilter?.value, isAgencia],
    queryFn: () =>
      fetch(`/api/clientes/${clienteId}/crm/atribuicao?from=${dateRange.from}&to=${dateRange.to}${filterQs}${paidOnlyQs}`)
        .then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (!data?.configured) return null;

  const totalLeads = data.totalLeads ?? 0;
  const porCanal = data.porCanal ?? [];
  const porEstado = data.porEstado ?? [];
  const porConversao = (data.porConversao ?? []).filter((c) =>
    !convSearch || c.conversao.toLowerCase().includes(convSearch.toLowerCase())
  );
  const leadsComEstado = data.leadsComEstado ?? 0;
  const leadsComConversao = data.leadsComConversao ?? 0;

  return (
    <div className="space-y-5">
      {/* ── Custo por Etapa Física (Mirante only) ── */}
      {isMirante && (() => {
        const investTotal = (data.investMeta ?? 0) + (data.investGoogle ?? 0);
        const visitas = data.visitasCount ?? 0;
        const vendas = data.vendasCount ?? 0;
        const custoVisita = visitas > 0 && investTotal > 0 ? investTotal / visitas : null;
        const custoVenda = vendas > 0 && investTotal > 0 ? investTotal / vendas : null;
        return (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="mt-1 h-8 w-1 shrink-0 rounded-full bg-[var(--primary)]" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">CRM · Investimento</p>
                <h2 className="text-xl font-extrabold tracking-tight text-[var(--foreground)]">Custo por Etapa Física</h2>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 transition-all hover:border-[color-mix(in_srgb,var(--primary)_20%,var(--border))]">
                <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[var(--primary)] opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-[0.05]" />
                <div className="mb-2 flex items-center gap-2">
                  <Home className="h-4 w-4 text-[var(--muted-foreground)]" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">Visitas</span>
                </div>
                <p className="text-2xl font-extrabold tabular-nums text-[var(--foreground)]">{visitas}</p>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">negociações com visita</p>
              </div>
              <div className="group relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 transition-all hover:border-emerald-500/40">
                <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-emerald-500 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-[0.07]" />
                <div className="mb-2 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-400">Vendas</span>
                </div>
                <p className="text-2xl font-extrabold tabular-nums text-emerald-400">{vendas}</p>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">negócios ganhos</p>
              </div>
              <div className="group relative overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--primary)_25%,var(--border))] bg-[var(--card)] p-4 transition-all hover:border-[color-mix(in_srgb,var(--primary)_40%,var(--border))]">
                <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[var(--primary)] opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-[0.07]" />
                <div className="mb-2 flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-[var(--primary)]" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">Custo / Visita</span>
                </div>
                <p className="text-2xl font-extrabold tabular-nums text-[var(--foreground)]">
                  {custoVisita != null ? formatCurrencyBR(Math.round(custoVisita)) : "—"}
                </p>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">investimento ÷ visitas</p>
              </div>
              <div className="group relative overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--primary)_25%,var(--border))] bg-[var(--card)] p-4 transition-all hover:border-[color-mix(in_srgb,var(--primary)_40%,var(--border))]">
                <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[var(--primary)] opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-[0.07]" />
                <div className="mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[var(--primary)]" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">Custo / Venda</span>
                </div>
                <p className="text-2xl font-extrabold tabular-nums text-[var(--foreground)]">
                  {custoVenda != null ? formatCurrencyBR(Math.round(custoVenda)) : "—"}
                </p>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">investimento ÷ vendas</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="mt-1 h-8 w-1 shrink-0 rounded-full bg-[var(--primary)]" />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">CRM</p>
          <h2 className="text-xl font-extrabold tracking-tight text-[var(--foreground)]">Análise de Origem</h2>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <RefreshCw className="h-4 w-4 animate-spin text-[var(--muted-foreground)]" />
        </div>
      ) : (
        <>
          {/* ── Performance por Canal ─────────────────────────────────────── */}
          {(totalLeads > 0 || (data.totalLeadsMeta ?? 0) > 0) && (() => {
            let paidCanais = porCanal.filter((c) => c.canal === "META" || c.canal === "GOOGLE");
            // Ensure META card renders when Meta form submissions exist but no CRM leads yet
            if ((data.totalLeadsMeta ?? 0) > 0 && !paidCanais.find((c) => c.canal === "META")) {
              const metaZero: PorCanal = {
                canal: "META", leads: 0, ganhos: 0, perdidos: 0, andamento: 0, visitou: 0, valor: 0,
                ratingMedio: null, pvMedio: null, investCanal: data.investMeta,
              };
              paidCanais = [metaZero, ...paidCanais];
            }
            const outrosCanais = porCanal.filter((c) => c.canal !== "META" && c.canal !== "GOOGLE");

            const canalMeta: Record<string, { cpl: number | null; cplPlat: number | null; cac: number | null; invest: number }> = {
              META:   { cpl: data.cplMetaCrm ?? null,   cplPlat: data.cplMetaCampanha ?? null,   cac: data.cacMetaCrm ?? null,   invest: data.investMeta },
              GOOGLE: { cpl: data.cplGoogleCrm ?? null, cplPlat: data.cplGoogleCampanha ?? null, cac: data.cacGoogleCrm ?? null, invest: data.investGoogle },
            };

            return (
              <div className="space-y-3">
                {/* Paid channel unified cards */}
                {paidCanais.length > 0 && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {paidCanais.map((c) => {
                      const cfg = CANAL_CFG[c.canal] ?? CANAL_CFG.OUTRO;
                      const meta = canalMeta[c.canal];
                      const isActive = activeFilter?.type === "canal" && activeFilter.value === c.canal;
                      const perdidos = c.leads - c.ganhos - c.andamento;

                      const ganhosPct = c.leads > 0 ? (c.ganhos / c.leads) * 100 : 0;
                      const andamentoPct = c.leads > 0 ? (c.andamento / c.leads) * 100 : 0;
                      const perdidosPct = c.leads > 0 ? (perdidos / c.leads) * 100 : 0;

                      return (
                        <div
                          key={c.canal}
                          onClick={() => isActive ? onFilter(null) : onFilter({ type: "canal", value: c.canal, label: `Canal: ${cfg.label}` })}
                          className={`group relative cursor-pointer overflow-hidden rounded-2xl border p-5 transition-all ${
                            isActive
                              ? "border-[color-mix(in_srgb,var(--primary)_35%,var(--border))] bg-[var(--primary)]/5"
                              : "border-[var(--border)] bg-[var(--card)] hover:border-[color-mix(in_srgb,var(--primary)_25%,var(--border))]"
                          }`}
                        >
                          {/* Channel accent line */}
                          <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] opacity-70" style={{ backgroundColor: cfg.hex }} />
                          {/* Hover glow */}
                          <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-[0.1]" style={{ backgroundColor: cfg.hex }} />

                          {/* ── Header ── */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cfg.hex }} />
                              <span className="text-sm font-bold text-[var(--foreground)]">{cfg.label}</span>
                              {c.canal === "META" && (data.totalLeadsMeta ?? 0) > 0 && (
                                <span className="rounded-full bg-[var(--muted)]/40 px-2 py-0.5 text-[10px] font-semibold text-[var(--muted-foreground)]">
                                  {data.totalLeadsMeta} forms
                                </span>
                              )}
                            </div>
                            <Filter className={`h-3.5 w-3.5 transition-colors ${isActive ? "fill-[var(--primary)] text-[var(--primary)]" : "text-[var(--muted-foreground)]/30 group-hover:text-[var(--muted-foreground)]/70"}`} />
                          </div>

                          {/* ── Hero: leads CRM em destaque ── */}
                          <div className="mt-4">
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--muted-foreground)]">Leads no CRM</p>
                              <p className="mt-0.5 tabular-nums text-5xl font-black leading-none" style={{ color: cfg.hex }}>
                                {c.leads.toLocaleString("pt-BR")}
                              </p>
                            </div>
                          </div>

                          {/* ── Funil clicável ── */}
                          <div className={`mt-5 grid gap-1 border-t border-[var(--border)]/50 pt-4 text-center ${isAgencia ? "grid-cols-3" : "grid-cols-4"}`}>
                            {(isAgencia ? [
                              { key: "leads",       label: "Leads",       val: c.leads,     cls: "text-[var(--foreground)]", dash: false },
                              { key: "atendimento", label: "Atend.",       val: c.andamento, cls: "text-blue-400",            dash: true  },
                              { key: "vendas",      label: "Fechamentos",  val: c.ganhos,    cls: "text-emerald-400",         dash: true  },
                            ] : [
                              { key: "leads",       label: "Leads",  val: c.leads,     cls: "text-[var(--foreground)]", dash: false },
                              { key: "atendimento", label: "Atend.", val: c.andamento, cls: "text-blue-400",            dash: true  },
                              { key: "visitas",     label: "Visitas",val: c.visitou,   cls: "text-amber-400",           dash: true  },
                              { key: "vendas",      label: "Vendas", val: c.ganhos,    cls: "text-emerald-400",         dash: true  },
                            ]).map((s) => {
                              const stageActive = activeFilter?.type === "funil" && activeFilter.value === `${c.canal}|${s.key}`;
                              return (
                                <button
                                  key={s.key}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onFilter(stageActive ? null : { type: "funil", value: `${c.canal}|${s.key}`, label: `${cfg.label} · ${s.label}` });
                                  }}
                                  className={`rounded-lg px-1 py-1.5 transition-colors ${
                                    stageActive
                                      ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                                      : "hover:bg-[var(--muted)]/40"
                                  }`}
                                >
                                  <p className={`text-xl font-extrabold leading-none tabular-nums ${s.cls}`}>
                                    {s.val > 0 ? s.val.toLocaleString("pt-BR") : (s.dash ? <span className="font-normal opacity-20 text-[var(--muted-foreground)]">—</span> : "0")}
                                  </p>
                                  <p className="mt-1.5 text-[9px] font-semibold uppercase leading-tight tracking-[0.06em] text-[var(--muted-foreground)]">{s.label}</p>
                                </button>
                              );
                            })}
                          </div>

                          {/* ── Barra de status com legendas ── */}
                          <div className="mt-4">
                            <div className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full">
                              {ganhosPct > 0 && <div className="h-full bg-emerald-400" style={{ width: `${ganhosPct}%` }} />}
                              {andamentoPct > 0 && <div className="h-full bg-blue-400" style={{ width: `${andamentoPct}%` }} />}
                              {perdidosPct > 0 && <div className="h-full bg-[var(--muted-foreground)]/30" style={{ width: `${perdidosPct}%` }} />}
                              {c.leads === 0 && <div className="h-full w-full rounded-full bg-[var(--muted)]/30" />}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[var(--muted-foreground)]">
                              {c.ganhos > 0 && (
                                <span className="flex items-center gap-1">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/70" />
                                  {c.ganhos} {isAgencia ? "fechamento" : "venda"}{c.ganhos !== 1 ? "s" : ""} ({ganhosPct.toFixed(0)}%)
                                </span>
                              )}
                              {c.andamento > 0 && (
                                <span className="flex items-center gap-1">
                                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400/70" />
                                  {c.andamento} em atend.
                                </span>
                              )}
                              {perdidos > 0 && (
                                <span className="flex items-center gap-1">
                                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--muted-foreground)]/40" />
                                  {perdidos} perdido{perdidos !== 1 ? "s" : ""} ({perdidosPct.toFixed(0)}%)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* ── Duplicados — linha própria, mais visível ── */}
                          {((c.canal === "META" && (data.reconversoesMeta?.length ?? 0) > 0) ||
                            (c.canal === "GOOGLE" && (data.reconversoesGoogle?.length ?? 0) > 0)) && (
                            <div className="mt-3 flex items-center gap-2">
                              {c.canal === "META" && (data.reconversoesMeta?.length ?? 0) > 0 && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setReconversoesOpen(true); }}
                                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/[0.07] px-3 py-1 text-[10px] font-semibold text-amber-400 transition-colors hover:bg-amber-400/[0.12]"
                                >
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400/80" />
                                  {data.reconversoesMeta!.length} duplicado{data.reconversoesMeta!.length !== 1 ? "s" : ""}
                                </button>
                              )}
                              {c.canal === "GOOGLE" && (data.reconversoesGoogle?.length ?? 0) > 0 && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setReconversoesGoogleOpen(true); }}
                                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/[0.07] px-3 py-1 text-[10px] font-semibold text-amber-400 transition-colors hover:bg-amber-400/[0.12]"
                                >
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400/80" />
                                  {data.reconversoesGoogle!.length} duplicado{data.reconversoesGoogle!.length !== 1 ? "s" : ""}
                                </button>
                              )}
                            </div>
                          )}

                          {/* ── Valor vendido ── */}
                          {c.ganhos > 0 && c.valor > 0 && (
                            <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
                              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-emerald-400/70">Valor Vendido</p>
                              <p className="tabular-nums text-sm font-bold text-emerald-400">{formatCurrencyBR(c.valor)}</p>
                            </div>
                          )}

                          {/* ── CPL Real CRM — tile hero full-width ── */}
                          {meta.cpl != null && (
                            <div
                              className="mt-4 flex items-center justify-between rounded-xl border px-4 py-3"
                              style={{
                                borderColor: `color-mix(in srgb, ${cfg.hex} 22%, var(--border))`,
                                backgroundColor: `color-mix(in srgb, ${cfg.hex} 7%, transparent)`,
                              }}
                            >
                              <div>
                                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">CPL Real · CRM</p>
                                {meta.cplPlat != null && (
                                  <p className="mt-0.5 text-[10px] text-[var(--muted-foreground)]/55">
                                    vs {formatCurrencyBR(meta.cplPlat)} plataforma
                                  </p>
                                )}
                              </div>
                              <p className="tabular-nums text-2xl font-black leading-none" style={{ color: cfg.hex }}>
                                {formatCurrencyBR(meta.cpl)}
                              </p>
                            </div>
                          )}

                          {/* ── Investimento + CAC ── */}
                          {meta.invest > 0 && (
                            <div className={`mt-2 grid gap-2 ${meta.cac != null ? "grid-cols-2" : "grid-cols-1"}`}>
                              <div className="rounded-xl bg-[var(--muted)]/20 px-3 py-2.5">
                                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-foreground)]">Investimento</p>
                                <p className="mt-0.5 tabular-nums text-sm font-bold text-[var(--foreground)]">{formatCurrencyBR(meta.invest)}</p>
                              </div>
                              {meta.cac != null && (
                                <div className="rounded-xl bg-emerald-500/[0.07] px-3 py-2.5">
                                  <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-emerald-400/80">CAC Real</p>
                                  <p className="mt-0.5 tabular-nums text-sm font-bold text-emerald-400">{formatCurrencyBR(meta.cac)}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Other channels compact table */}
                {outrosCanais.length > 0 && (
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <BarChart3 className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
                      <p className="text-xs font-semibold text-[var(--muted-foreground)]">Outros canais</p>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)]">
                          {["Canal", "Leads", "Ganhos", "Conv%", "Qualif."].map((h) => (
                            <th key={h} className={`pb-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)] ${h === "Canal" ? "text-left" : "text-right"}`}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {outrosCanais.map((c) => {
                          const cfg = CANAL_CFG[c.canal] ?? CANAL_CFG.OUTRO;
                          const isActive = activeFilter?.type === "canal" && activeFilter.value === c.canal;
                          return (
                            <tr
                              key={c.canal}
                              onClick={() => isActive ? onFilter(null) : onFilter({ type: "canal", value: c.canal, label: `Canal: ${cfg.label}` })}
                              className={`cursor-pointer border-b border-[var(--border)]/40 last:border-0 transition-colors hover:bg-[var(--primary)]/5 ${isActive ? "bg-[var(--primary)]/8" : ""}`}
                            >
                              <td className="py-2 pr-3">
                                <div className="flex items-center gap-1.5">
                                  <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: cfg.hex }} />
                                  <span className={`text-[11px] font-semibold ${isActive ? "text-[var(--primary)]" : cfg.color}`}>{cfg.label}</span>
                                </div>
                              </td>
                              <td className="py-2 text-right tabular-nums text-[11px] text-[var(--foreground)]">{c.leads}</td>
                              <td className="py-2 text-right tabular-nums text-[11px] font-bold text-emerald-400">
                                {c.ganhos > 0 ? c.ganhos : <span className="font-normal opacity-30">—</span>}
                              </td>
                              <td className="py-2 text-right tabular-nums text-[11px]">
                                {c.ganhos > 0 ? <span className="text-emerald-400">{((c.ganhos / c.leads) * 100).toFixed(1)}%</span> : <span className="opacity-30">—</span>}
                              </td>
                              <td className="py-2 text-right tabular-nums text-[11px]">
                                {c.pvMedio != null ? (
                                  <span className={PV_LABELS[String(Math.round(c.pvMedio))]?.color ?? ""}>{c.pvMedio.toFixed(1)}</span>
                                ) : <span className="opacity-30">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Fonte de Conversão */}
                {(data.porConversao ?? []).length >= 2 && (
                  <div className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Layers className="h-3.5 w-3.5 shrink-0 text-[var(--primary)]" />
                        <p className="text-sm font-bold text-[var(--foreground)]">Fonte de Conversão</p>
                      </div>
                      {leadsComConversao > 0 && (
                        <span className="shrink-0 text-[10px] text-[var(--muted-foreground)]">
                          {leadsComConversao.toLocaleString("pt-BR")} de {totalLeads.toLocaleString("pt-BR")}
                        </span>
                      )}
                    </div>
                    <div className="relative mb-2">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-foreground)]" />
                      <input
                        value={convSearch}
                        onChange={(e) => setConvSearch(e.target.value)}
                        placeholder="Buscar fonte de conversão…"
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 py-1.5 pl-8 pr-3 text-[11px] placeholder-[var(--muted-foreground)] focus:border-[var(--primary)] focus:outline-none"
                      />
                    </div>
                    <div className="max-h-[220px] flex-1 space-y-0.5 overflow-y-auto">
                      {porConversao.length === 0 ? (
                        <p className="py-4 text-center text-xs text-[var(--muted-foreground)]">Nenhum resultado</p>
                      ) : (
                        porConversao.map((c) => {
                          const isActive = activeFilter?.type === "conversao" && activeFilter.value === c.conversao;
                          return (
                            <HorizontalBar
                              key={c.conversao}
                              label={c.conversao}
                              value={c.leads}
                              total={leadsComConversao}
                              isActive={isActive}
                              onClick={() => onFilter(isActive ? null : { type: "conversao", value: c.conversao, label: `Conversão: ${c.conversao}` })}
                            />
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Campaign breakdown (by CRM entry portal) */}
          <CampanhaSection data={data} />
        </>
      )}

      {/* Meta hierarchy (campanha → conjunto → anúncio) via dadosMarketing */}
      {!isLoading && data?.configured && (
        (data.porMetaHierarquia?.length ?? 0) > 0
          ? <MetaHierarquiaSection data={data} activeFilter={activeFilter} onFilter={onFilter} isAgencia={isAgencia} />
          : (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="mt-1 h-8 w-1 shrink-0 rounded-full bg-[var(--primary)]" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">CRM × Meta</p>
                  <h2 className="text-xl font-extrabold tracking-tight text-[var(--foreground)]">Campanha → Conjunto → Anúncio</h2>
                </div>
              </div>
              <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] px-5 py-6 text-center">
                <p className="text-sm text-[var(--muted-foreground)]">Nenhum lead com rastreamento de campanha Meta no período selecionado.</p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]/60">Os IDs de campanha são gravados no momento da entrada do lead via formulário Meta. Tente um período mais amplo.</p>
              </div>
            </div>
          )
      )}

      {/* Google UTM hierarchy (campanha UTM → leads) via dadosMarketing.utmCampaign */}
      {!isLoading && data?.configured && (data.porGoogleUtmHier?.length ?? 0) > 0 && (
        <GoogleUtmHierarquiaSection data={data} activeFilter={activeFilter} onFilter={onFilter} isAgencia={isAgencia} />
      )}

      {reconversoesOpen && (data.reconversoesMeta?.length ?? 0) > 0 && (
        <ReconversoesModal
          canal="META"
          metaItems={data.reconversoesMeta}
          onClose={() => setReconversoesOpen(false)}
        />
      )}
      {reconversoesGoogleOpen && (data.reconversoesGoogle?.length ?? 0) > 0 && (
        <ReconversoesModal
          canal="GOOGLE"
          googleItems={data.reconversoesGoogle}
          onClose={() => setReconversoesGoogleOpen(false)}
        />
      )}
    </div>
  );
}

// ─── CrmTab ───────────────────────────────────────────────────────────────────

export function CrmTab({
  clienteId,
  dateRange,
  perfilPanel,
}: {
  clienteId: string;
  dateRange: { from: string; to: string };
  perfilPanel?: string | null;
}) {
  const [page, setPage] = React.useState(1);
  const PAGE_SIZE = 15;
  const [searchInput, setSearchInput] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [selectedLead, setSelectedLead] = React.useState<Lead | null>(null);
  const [leadFilter, setLeadFilter] = React.useState<LeadFilter>(null);
  const queryClient = useQueryClient();

  // Debounce search 300ms
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset to page 1 on dateRange, search, or filter change
  React.useEffect(() => {
    setPage(1);
  }, [dateRange.from, dateRange.to, debouncedSearch, leadFilter?.type, leadFilter?.value]);

  const isAgencia = perfilPanel === "agencia";
  const isMirante = isMiranteIncorporadora({ perfilPanel });

  const filterQs = leadFilter
    ? `&filterType=${encodeURIComponent(leadFilter.type)}&filterValue=${encodeURIComponent(leadFilter.value)}`
    : "";

  const leadsPaidOnlyQs = isAgencia ? "&paidOnly=1" : "";

  const { data: leadsData, isLoading: leadsLoading } = useQuery<LeadsApiResponse>({
    queryKey: ["crm-leads", clienteId, dateRange.from, dateRange.to, page, PAGE_SIZE, debouncedSearch, leadFilter?.type, leadFilter?.value, isAgencia],
    queryFn: () =>
      fetch(
        `/api/clientes/${clienteId}/crm/leads?from=${dateRange.from}&to=${dateRange.to}&page=${page}&pageSize=${PAGE_SIZE}&search=${encodeURIComponent(debouncedSearch)}${filterQs}${leadsPaidOnlyQs}`
      ).then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/clientes/${clienteId}/sync`, { method: "POST" });
      const json = await r.json();
      if (!r.ok) throw new Error(json?.error ?? "Erro ao sincronizar");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-funil", clienteId] });
      queryClient.invalidateQueries({ queryKey: ["crm-leads", clienteId] });
      queryClient.invalidateQueries({ queryKey: ["crm-atribuicao", clienteId] });
    },
  });

  const leads = leadsData?.leads ?? [];
  const total = leadsData?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const isEmptyNoSearch = !leadsLoading && total === 0 && !debouncedSearch;

  function pageNumbers(current: number, total: number): (number | "…")[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, "…", total];
    if (current >= total - 3) return [1, "…", total - 4, total - 3, total - 2, total - 1, total];
    return [1, "…", current - 1, current, current + 1, "…", total];
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="mt-1 h-8 w-1 shrink-0 rounded-full bg-[var(--primary)]" />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">CRM</p>
          <h2 className="text-xl font-extrabold tracking-tight text-[var(--foreground)]">Funil & Leads</h2>
        </div>
      </div>

      {syncMutation.isError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          Erro ao sincronizar. Tente novamente.
        </div>
      )}

      {/* Clear filter banner */}
      {leadFilter && (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--primary)]/20 bg-[var(--primary)]/5 px-4 py-2.5">
          <Filter className="h-3.5 w-3.5 shrink-0 text-[var(--primary)]" />
          <span className="text-[11px] text-[var(--muted-foreground)] flex-1 min-w-0 truncate">
            Filtro ativo: <span className="font-semibold text-[var(--primary)]">{leadFilter.label}</span>
          </span>
          <button
            onClick={() => setLeadFilter(null)}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-2.5 py-1 text-[11px] font-semibold text-[var(--primary)] hover:bg-[var(--primary)]/20 transition-colors shrink-0"
          >
            <X className="h-3 w-3" />
            Limpar filtro
          </button>
        </div>
      )}

      {/* Funil */}
      <FunilCrmSection clienteId={clienteId} dateRange={dateRange} leadFilter={leadFilter} onFilter={setLeadFilter} perfilPanel={perfilPanel} />

      {/* Análise de Origem */}
      <AtribuicaoSection
        clienteId={clienteId}
        dateRange={dateRange}
        activeFilter={leadFilter}
        onFilter={setLeadFilter}
        isAgencia={isAgencia}
        isMirante={isMirante}
      />

      {/* Negociações */}
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-8 w-1 shrink-0 rounded-full bg-[var(--primary)]" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">CRM</p>
            <h2 className="text-xl font-extrabold tracking-tight text-[var(--foreground)]">Detalhamento dos Leads</h2>
          </div>
        </div>

        {/* Active filter chip */}
        {leadFilter && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-[var(--muted-foreground)]">Filtro ativo:</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--primary)]/30 bg-[var(--primary)]/10 py-1 pl-3 pr-2 text-[11px] font-semibold text-[var(--primary)]">
              {leadFilter.label}
              <button
                onClick={() => setLeadFilter(null)}
                className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-[var(--primary)]/20 transition-colors"
                title="Limpar filtro"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
            <span className="text-[10px] text-[var(--muted-foreground)] opacity-60">
              {total.toLocaleString("pt-BR")} resultado{total !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por nome, e-mail ou telefone…"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] py-2.5 pl-10 pr-10 text-sm placeholder-[var(--muted-foreground)] focus:border-[var(--primary)] focus:outline-none transition-colors"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>


        {/* Table */}
        {leadsLoading ? (
          <Card className="overflow-hidden rounded-2xl border-[var(--border)]">
            <CardContent className="flex h-24 items-center justify-center">
              <RefreshCw className="h-4 w-4 animate-spin text-[var(--muted-foreground)]" />
            </CardContent>
          </Card>
        ) : isEmptyNoSearch ? (
          <Card className="overflow-hidden rounded-2xl border-[var(--border)]">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--muted)]">
                <Inbox className="h-5 w-5 text-[var(--muted-foreground)]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">Nenhum lead encontrado</p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  Clique em Sincronizar para importar os leads do CRM.
                </p>
              </div>
              <button
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[var(--primary-foreground)] transition-opacity disabled:opacity-60"
              >
                <RefreshCw className={`h-3 w-3 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                {syncMutation.isPending ? "Sincronizando…" : "Sincronizar agora"}
              </button>
            </CardContent>
          </Card>
        ) : total === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] py-10">
            <Search className="h-6 w-6 text-[var(--muted-foreground)]" />
            <p className="text-sm text-[var(--muted-foreground)]">Nenhum resultado para &quot;{debouncedSearch}&quot;</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
              <table className="min-w-[680px] w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30">
                    {["Etapa", "Contato", "Origem", "Entrada", "Valor"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--muted-foreground)]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead, i) => {
                    const cv = lead.dadosCv ?? null;
                    const mkt = lead.dadosMarketing ?? null;
                    const canal = canalFromMidia(lead.fonte, cv?.midiaOriginal);
                    const canalCfg = CANAL_CFG[canal] ?? CANAL_CFG.OUTRO;
                    const confirmedCampaign = mkt?.metaCampaignName ?? null;
                    return (
                      <tr
                        key={lead.id}
                        onClick={() => setSelectedLead(lead)}
                        className={`cursor-pointer border-b border-[var(--border)]/50 transition-colors hover:bg-[var(--primary)]/5 ${
                          i % 2 === 0 ? "" : "bg-[var(--muted)]/10"
                        }`}
                      >
                        <td className="px-4 py-2.5">
                          <span className="max-w-[180px] block truncate rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--primary)]">
                            {lead.etapa}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="max-w-[200px]">
                            <p className="truncate font-medium text-[var(--foreground)]">
                              {lead.nome ?? lead.email ?? lead.telefone ?? "—"}
                            </p>
                            {lead.nome && lead.email && (
                              <p className="truncate text-[11px] text-[var(--muted-foreground)]">{lead.email}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="inline-block h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: canalCfg.hex }}
                            />
                            <span className={`text-[12px] font-semibold ${canalCfg.color}`}>{canalCfg.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 tabular-nums text-[12px] text-[var(--muted-foreground)]">
                          {formatDateBR(lead.dataEntrada)}
                        </td>
                        <td className="px-4 py-2.5 tabular-nums font-semibold text-emerald-400">
                          {lead.valor != null ? formatCurrencyBR(lead.valor) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1 pt-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] disabled:opacity-30"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                {pageNumbers(page, totalPages).map((n, idx) =>
                  n === "…" ? (
                    <span key={`e-${idx}`} className="flex h-7 w-7 items-center justify-center text-xs text-[var(--muted-foreground)]">…</span>
                  ) : (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className={`flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-semibold transition-all ${
                        page === n
                          ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm"
                          : "border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      {n}
                    </button>
                  )
                )}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] disabled:opacity-30"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Lead Drawer */}
      <LeadDetailDrawer lead={selectedLead} onClose={() => setSelectedLead(null)} clienteId={clienteId} isAgencia={isAgencia} />
    </div>
  );
}
