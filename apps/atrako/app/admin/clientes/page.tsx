"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PillSelect } from "@/components/ui/pill-select";
import { Button } from "@/components/ui/button";
import { AppPage } from "@/components/layout/AppPage";
import { SegmentoManagerModal, fetchSegmentos, type Segmento } from "./SegmentoManagerModal";
import { LogoUploadField } from "./LogoUploadField";

interface ContaAdmin {
  id: string;
  plataforma: string;
  accountIdPlataforma: string | null;
  googleAdsLoginCustomerId?: string | null;
  nomeConta: string | null;
  conexaoIntegracaoId?: string | null;
  saldoAtual?: number | null;
  saldoAtualizadoAt?: string | null;
}

interface ClienteAdmin {
  id: string;
  nome: string;
  slug: string;
  logoUrl: string | null;
  segmento: string | null;
  ativo: boolean;
  orcamentoMidiaGoogleMensal?: number | null;
  orcamentoMidiaMetaMensal?: number | null;
  portalToken?: string | null;
  leadScoringEnabled?: boolean;
  socialMediaAtivo?: boolean;
  telegramAtivo?: boolean;
  inPilotEnabled?: boolean;
  objetivoMidia?: string;
  produtoServico?: string | null;
  modeloNegocio?: string | null;
  publicoAlvo?: string | null;
  objetivoProjeto?: string | null;
  diferenciais?: string | null;
  observacoesAnaliticas?: string | null;
  perfilPanel?: string | null;
  squad?: number | null;
  ultimoSyncAt?: string | null;
  contas: ContaAdmin[];
}

interface ClientePayload {
  nome: string;
  slug?: string;
  logoUrl?: string;
  segmento?: string;
  ativo?: boolean;
  syncAfterCreate?: boolean;
  syncNow?: boolean;
  ownerEmail?: string;
  orcamentoMidiaGoogleMensal?: number | null;
  orcamentoMidiaMetaMensal?: number | null;
  googleAdsAccountId?: string | null;
  googleAdsLoginCustomerId?: string | null;
  metaAdsAccountId?: string | null;
  instagramBusinessAccountId?: string | null;
  ga4PropertyId?: string | null;
  conexaoMetaId?: string | null;
  conexaoGoogleId?: string | null;
  linkedinAdsAccountId?: string | null;
  conexaoLinkedinId?: string | null;
  leadScoringEnabled?: boolean;
  socialMediaAtivo?: boolean;
  telegramAtivo?: boolean;
  inPilotEnabled?: boolean;
  objetivoMidia?: string;
  perfilPanel?: string | null;
  squad?: number | null;
  produtoServico?: string | null;
  modeloNegocio?: string | null;
  publicoAlvo?: string | null;
  objetivoProjeto?: string | null;
  diferenciais?: string | null;
  observacoesAnaliticas?: string | null;
}

interface ConexaoOpcao {
  id: string;
  nome: string;
  plataforma: "META" | "GOOGLE_ADS" | "LINKEDIN";
  ativo: boolean;
  googleLoginCustomerId?: string | null;
}

function getHeaders(token?: string, includeJson = false): HeadersInit {
  const headers: HeadersInit = {};
  if (includeJson) headers["Content-Type"] = "application/json";
  return headers;
}

async function fetchAdminClientes(token?: string): Promise<ClienteAdmin[]> {
  const res = await fetch("/api/admin/clientes", { headers: getHeaders(token) });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) throw new Error("Falha ao carregar clientes");
  return res.json();
}

async function createCliente(body: ClientePayload, token?: string) {
  const res = await fetch("/api/admin/clientes", {
    method: "POST",
    headers: getHeaders(token, true),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

async function updateCliente(id: string, body: ClientePayload, token?: string) {
  const res = await fetch(`/api/admin/clientes/${id}`, {
    method: "PATCH",
    headers: getHeaders(token, true),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

async function syncCliente(clienteId: string) {
  const res = await fetch(`/api/clientes/${clienteId}/sync`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

async function syncAll(token?: string) {
  const res = await fetch("/api/admin/sync-all", {
    method: "POST",
    headers: getHeaders(token),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data as {
    ok: boolean;
    results?: { clienteId: string; nome: string; ok: boolean; error?: string }[];
    summary?: { total: number; ok: number; erros: number };
  };
}


function FormField({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
        {label}
        {required && <span className="ml-1 text-[var(--primary)]">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">{hint}</p>}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm transition-colors focus:border-[var(--primary)]/40 focus:outline-none";

function getConta(cliente: ClienteAdmin, plataforma: "GOOGLE_ADS" | "META" | "GOOGLE_ANALYTICS" | "INSTAGRAM" | "LINKEDIN") {
  return cliente.contas.find((conta) => conta.plataforma === plataforma);
}

function formatBRL(val: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

function formatSaldo(conta: ContaAdmin | undefined): string | null {
  if (!conta) return null;
  if (conta.saldoAtual == null) return null; // nunca sincronizado
  return formatBRL(conta.saldoAtual);
}

function formatSyncDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  if (diff < 60 * 60 * 1000) {
    const mins = Math.max(1, Math.floor(diff / 60000));
    return `há ${mins}min`;
  }
  if (diff < 24 * 60 * 60 * 1000) {
    const hrs = Math.floor(diff / (60 * 60 * 1000));
    return `há ${hrs}h`;
  }
  return (
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) +
    " " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );
}

function SegmentoCombobox({
  value,
  onChange,
  segmentos,
  onOpenManager,
}: {
  value: string;
  onChange: (v: string) => void;
  segmentos: Segmento[];
  onOpenManager: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [inputVal, setInputVal] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setInputVal(value); }, [value]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const filtered = segmentos.filter((s) =>
    s.nome.toLowerCase().includes(inputVal.toLowerCase())
  );

  const selectedSegmento = segmentos.find((s) => s.nome === value);

  function select(nome: string) {
    onChange(nome);
    setInputVal(nome);
    setOpen(false);
  }

  function handleInput(v: string) {
    setInputVal(v);
    onChange(v);
    setOpen(true);
  }

  return (
    <div ref={ref} className="relative flex items-center gap-2">
      <div className="relative flex-1">
        {selectedSegmento && !open && (
          <span
            className="pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 rounded-sm"
            style={{ backgroundColor: selectedSegmento.cor }}
          />
        )}
        <input
          value={inputVal}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Selecionar ou digitar segmento..."
          className={`${inputClass} ${selectedSegmento && !open ? "pl-8" : ""} pr-8`}
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={onOpenManager}
        title="Gerenciar segmentos"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--muted-foreground)] transition hover:border-[var(--primary)]/40 hover:bg-[var(--primary)]/5 hover:text-[var(--primary)]"
      >
        <Plus className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-52 w-[calc(100%-2.75rem)] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl">
          {filtered.length === 0 && (
            <div className="px-4 py-3 text-xs text-[var(--muted-foreground)]">
              {inputVal ? `Pressione + para criar "${inputVal}"` : "Nenhum segmento cadastrado"}
            </div>
          )}
          {value && (
            <button
              type="button"
              onMouseDown={() => select("")}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs text-[var(--muted-foreground)] transition hover:bg-[var(--muted)]"
            >
              <X className="h-3 w-3" /> Limpar seleção
            </button>
          )}
          {filtered.map((s) => (
            <button
              key={s.id}
              type="button"
              onMouseDown={() => select(s.nome)}
              className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition hover:bg-[var(--muted)] ${
                value === s.nome ? "bg-[var(--primary)]/5 font-semibold" : ""
              }`}
            >
              <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: s.cor }} />
              {s.nome}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ClienteForm({
  title,
  submitLabel,
  initialValues,
  segmentos,
  sessionReady,
  clienteId,
  pending,
  error,
  success,
  onClose,
  onSubmit,
}: {
  title: string;
  submitLabel: string;
  initialValues: ClientePayload;
  segmentos: Segmento[];
  sessionReady: boolean;
  clienteId?: string;
  pending: boolean;
  error: string;
  success: string;
  onClose: () => void;
  onSubmit: (body: ClientePayload) => void;
}) {
  const [nome, setNome] = useState(initialValues.nome ?? "");
  const [ownerEmail, setOwnerEmail] = useState(initialValues.ownerEmail ?? "");
  const [logoUrl, setLogoUrl] = useState(initialValues.logoUrl ?? "");
  const [segmento, setSegmento] = useState(initialValues.segmento ?? "");
  const [ativo, setAtivo] = useState(initialValues.ativo ?? true);
  const [googleAdsAccountId, setGoogleAdsAccountId] = useState(initialValues.googleAdsAccountId ?? "");
  const [googleAdsLoginCustomerId, setGoogleAdsLoginCustomerId] = useState(
    initialValues.googleAdsLoginCustomerId ?? ""
  );
  const [metaAdsAccountId, setMetaAdsAccountId] = useState(initialValues.metaAdsAccountId ?? "");
  const [instagramAccountId, setInstagramAccountId] = useState(initialValues.instagramBusinessAccountId ?? "");
  const [conexaoMetaId, setConexaoMetaId] = useState(initialValues.conexaoMetaId ?? "");
  const [conexaoGoogleId, setConexaoGoogleId] = useState(initialValues.conexaoGoogleId ?? "");
  const [linkedinAdsAccountId, setLinkedinAdsAccountId] = useState(initialValues.linkedinAdsAccountId ?? "");
  const [conexaoLinkedinId, setConexaoLinkedinId] = useState(initialValues.conexaoLinkedinId ?? "");

  const { data: todasConexoes = [] } = useQuery<ConexaoOpcao[]>({
    queryKey: ["conexoes-lista"],
    queryFn: async () => {
      const r = await fetch("/api/admin/conexoes", { headers: getHeaders() });
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 60_000,
  });
  const conexoesMeta = todasConexoes.filter((c) => c.plataforma === "META" && c.ativo);
  const conexoesGoogle = todasConexoes.filter((c) => c.plataforma === "GOOGLE_ADS" && c.ativo);
  const conexoesLinkedin = todasConexoes.filter((c) => c.plataforma === "LINKEDIN" && c.ativo);
  const [ga4PropertyId, setGa4PropertyId] = useState(initialValues.ga4PropertyId ?? "");
  const [orcamentoGoogle, setOrcamentoGoogle] = useState(
    initialValues.orcamentoMidiaGoogleMensal != null ? String(initialValues.orcamentoMidiaGoogleMensal) : ""
  );
  const [orcamentoMeta, setOrcamentoMeta] = useState(
    initialValues.orcamentoMidiaMetaMensal != null ? String(initialValues.orcamentoMidiaMetaMensal) : ""
  );
  const [syncAfterSave, setSyncAfterSave] = useState(
    initialValues.syncAfterCreate ?? initialValues.syncNow ?? true
  );
  const [leadScoringEnabled, setLeadScoringEnabled] = useState(
    initialValues.leadScoringEnabled ?? false
  );
  const [socialMediaAtivo, setSocialMediaAtivo] = useState(
    initialValues.socialMediaAtivo ?? false
  );
  const [telegramAtivo, setTelegramAtivo] = useState(
    initialValues.telegramAtivo ?? false
  );
  const [objetivoMidia, setObjetivoMidia] = useState(initialValues.objetivoMidia ?? "leads");
  const [perfilPanel, setPerfilPanel] = useState(initialValues.perfilPanel ?? "");
  const [squad, setSquad] = useState<string>(
    initialValues.squad != null ? String(initialValues.squad) : ""
  );
  const [inPilotEnabled, setInPilotEnabled] = useState(initialValues.inPilotEnabled ?? true);
  const [produtoServico, setProdutoServico] = useState(initialValues.produtoServico ?? "");
  const [modeloNegocio, setModeloNegocio] = useState(initialValues.modeloNegocio ?? "");
  const [publicoAlvo, setPublicoAlvo] = useState(initialValues.publicoAlvo ?? "");
  const [objetivoProjeto, setObjetivoProjeto] = useState(initialValues.objetivoProjeto ?? "");
  const [diferenciais, setDiferenciais] = useState(initialValues.diferenciais ?? "");
  const [observacoesAnaliticas, setObservacoesAnaliticas] = useState(initialValues.observacoesAnaliticas ?? "");
  const [showSegmentoManager, setShowSegmentoManager] = useState(false);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
        <Card className="w-full max-w-2xl overflow-hidden rounded-2xl border-[var(--border)]">
          <CardHeader className="flex flex-row items-center justify-between border-b border-[var(--border)] bg-gradient-to-b from-[var(--primary)]/[0.03] to-transparent pb-5">
            <div>
              <CardTitle>{title}</CardTitle>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Configure os IDs de conta que alimentam o dashboard.
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <X className="h-4 w-4" />
            </button>
          </CardHeader>
          <CardContent className="max-h-[75vh] space-y-5 overflow-y-auto pt-5">
            <FormField label="Nome" required>
              <input value={nome} onChange={(e) => setNome(e.target.value)} className={inputClass} />
            </FormField>
            {!clienteId ? (
              <FormField
                label="E-mail do OWNER"
                hint="Envia convite para o dealer definir senha e acessar só este workspace."
              >
                <input
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder="dono@empresa.com"
                  className={inputClass}
                />
              </FormField>
            ) : null}

            {/* ── Google Ads ── */}
            <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Google Ads</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="ID da conta Google Ads" hint="Pode colar com ou sem hífens.">
                  <input
                    value={googleAdsAccountId}
                    onChange={(e) => setGoogleAdsAccountId(e.target.value)}
                    placeholder="299-043-1301"
                    className={inputClass}
                  />
                </FormField>
                <FormField
                  label="MCC (gerenciadora)"
                  hint={
                    conexoesGoogle.length > 0
                      ? "Selecione de qual MCC cadastrado esta conta é gerenciada."
                      : "Ex.: 3830547260 — ID numérico da conta MCC."
                  }
                >
                  {conexoesGoogle.length > 0 ? (
                    <PillSelect
                      className="w-full"
                      size="field"
                      value={conexaoGoogleId}
                      onChange={(id) => {
                        setConexaoGoogleId(id);
                        if (id) {
                          const conn = conexoesGoogle.find((c) => c.id === id);
                          if (conn?.googleLoginCustomerId) {
                            setGoogleAdsLoginCustomerId(conn.googleLoginCustomerId);
                          }
                        } else {
                          setGoogleAdsLoginCustomerId("");
                        }
                      }}
                      options={[
                        { value: "", label: "(credenciais globais)" },
                        ...conexoesGoogle.map((c) => ({
                          value: c.id,
                          label: `${c.nome}${c.googleLoginCustomerId ? ` — MCC ${c.googleLoginCustomerId}` : ""}`,
                        })),
                      ]}
                      aria-label="MCC (gerenciadora)"
                    />
                  ) : (
                    <input
                      value={googleAdsLoginCustomerId}
                      onChange={(e) => setGoogleAdsLoginCustomerId(e.target.value)}
                      placeholder="3830547260"
                      className={inputClass}
                    />
                  )}
                  {conexaoGoogleId && googleAdsLoginCustomerId && (
                    <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                      MCC: <span className="font-mono text-[var(--primary)]">{googleAdsLoginCustomerId}</span>
                    </p>
                  )}
                </FormField>
              </div>
            </div>

            {/* ── Meta Ads ── */}
            <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Meta Ads</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="ID da conta Meta Ads" hint="Pode colar com ou sem act_.">
                  <input
                    value={metaAdsAccountId}
                    onChange={(e) => setMetaAdsAccountId(e.target.value)}
                    placeholder="320901911416777"
                    className={inputClass}
                  />
                </FormField>
                <FormField
                  label="BM (Business Manager)"
                  hint={
                    conexoesMeta.length > 0
                      ? "Selecione de qual BM cadastrada esta conta é gerenciada."
                      : "Nenhuma BM cadastrada — usando credenciais globais."
                  }
                >
                  {conexoesMeta.length > 0 ? (
                    <PillSelect
                      className="w-full"
                      size="field"
                      value={conexaoMetaId}
                      onChange={setConexaoMetaId}
                      options={[
                        { value: "", label: "(credenciais globais)" },
                        ...conexoesMeta.map((c) => ({ value: c.id, label: c.nome })),
                      ]}
                      aria-label="BM (Business Manager)"
                    />
                  ) : (
                    <input
                      value=""
                      readOnly
                      placeholder="Nenhuma BM cadastrada"
                      className={`${inputClass} cursor-not-allowed opacity-50`}
                    />
                  )}
                </FormField>
              </div>
              <FormField label="Instagram Business Account ID" hint="ID numérico da conta Instagram Business vinculada à página do Facebook. Ex: 17841400000000000.">
                <input
                  value={instagramAccountId}
                  onChange={(e) => setInstagramAccountId(e.target.value)}
                  placeholder="17841400000000000"
                  className={inputClass}
                />
              </FormField>
            </div>

            {/* ── LinkedIn Ads ── */}
            <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">LinkedIn Ads</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="ID da conta LinkedIn Ads" hint="Numérico, pode colar a URN completa (urn:li:sponsoredAccount:...).">
                  <input
                    value={linkedinAdsAccountId}
                    onChange={(e) => setLinkedinAdsAccountId(e.target.value)}
                    placeholder="512345678"
                    className={inputClass}
                  />
                </FormField>
                <FormField
                  label="Conexão LinkedIn"
                  hint={
                    conexoesLinkedin.length > 0
                      ? "Selecione a conexão LinkedIn autorizada (OAuth)."
                      : "Nenhuma conexão LinkedIn — crie em Conexões e conclua o OAuth."
                  }
                >
                  {conexoesLinkedin.length > 0 ? (
                    <PillSelect
                      className="w-full"
                      size="field"
                      value={conexaoLinkedinId}
                      onChange={setConexaoLinkedinId}
                      options={[
                        { value: "", label: "(nenhuma)" },
                        ...conexoesLinkedin.map((c) => ({ value: c.id, label: c.nome })),
                      ]}
                      aria-label="Conexão LinkedIn"
                    />
                  ) : (
                    <input
                      value=""
                      readOnly
                      placeholder="Nenhuma conexão LinkedIn"
                      className={`${inputClass} cursor-not-allowed opacity-50`}
                    />
                  )}
                </FormField>
              </div>
            </div>

            {/* ── Analytics ── */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="GA4 Property ID" hint="ID numérico da propriedade GA4 (Admin > Propriedade).">
                <input
                  value={ga4PropertyId}
                  onChange={(e) => setGa4PropertyId(e.target.value)}
                  placeholder="456789012"
                  className={inputClass}
                />
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Logo do cliente">
                <LogoUploadField
                  value={logoUrl}
                  onChange={setLogoUrl}
                />
              </FormField>
              <FormField label="Segmento">
                <SegmentoCombobox
                  value={segmento}
                  onChange={setSegmento}
                  segmentos={segmentos}
                  onOpenManager={() => setShowSegmentoManager(true)}
                />
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Orçamento mensal Google (R$)">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={orcamentoGoogle}
                  onChange={(e) => setOrcamentoGoogle(e.target.value)}
                  className={inputClass}
                />
              </FormField>
              <FormField label="Orçamento mensal Meta (R$)">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={orcamentoMeta}
                  onChange={(e) => setOrcamentoMeta(e.target.value)}
                  className={inputClass}
                />
              </FormField>
            </div>

            <FormField label="Perfil de painel especial" hint="Define o tipo de dashboard customizado. Imune a mudanças de nome ou slug.">
              <PillSelect
                className="w-full"
                size="field"
                value={perfilPanel}
                onChange={setPerfilPanel}
                options={[
                  { value: "", label: "(padrão — detecta por slug/nome)" },
                  { value: "ecommerce", label: "E-commerce" },
                  { value: "hotel", label: "Hotel / Resort" },
                  { value: "restaurante", label: "Restaurante / Bar" },
                  { value: "clinica", label: "Clínica & Saúde" },
                  { value: "medico", label: "Médico / Especialista" },
                  { value: "imoveis", label: "Imobiliária" },
                  { value: "academia", label: "Escola / Academia" },
                  { value: "concessionaria", label: "Concessionária / Motos" },
                  { value: "instagram-visitas", label: "Visitas ao Perfil (Instagram)" },
                  { value: "social-media", label: "Social Media Only (sem tráfego pago)" },
                ]}
                aria-label="Perfil de painel especial"
              />
            </FormField>

            <FormField label="Squad" hint="Time interno responsável por este cliente. Usado para filtrar a Central de Clientes.">
              <PillSelect
                className="w-full"
                size="field"
                value={squad}
                onChange={setSquad}
                options={[
                  { value: "", label: "(sem squad)" },
                  { value: "1", label: "Squad 1" },
                  { value: "2", label: "Squad 2" },
                  { value: "3", label: "Squad 3" },
                ]}
                aria-label="Squad"
              />
            </FormField>

            <FormField label="Objetivo de mídia" hint="Define quais métricas são exibidas no resumo diário do Telegram e nos alertas automáticos.">
              <PillSelect
                className="w-full"
                size="field"
                value={objetivoMidia}
                onChange={setObjetivoMidia}
                options={[
                  { value: "leads", label: "Geração de Leads (CPL)" },
                  { value: "ecommerce", label: "E-commerce / Vendas (CPA)" },
                ]}
                aria-label="Objetivo de mídia"
              />
            </FormField>

            <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 p-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Contexto comercial do InPilot</p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  Informações administrativas para contextualizar análises. Não substituem os dados observados e não alteram regras ou permissões.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Produto ou serviço" hint="O que este cliente oferece. Até 1.000 caracteres.">
                  <textarea value={produtoServico} onChange={(e) => setProdutoServico(e.target.value)} maxLength={1000} rows={3} className={inputClass} />
                </FormField>
                <FormField label="Modelo de negócio" hint="Como a operação vende e gera receita. Até 1.000 caracteres.">
                  <textarea value={modeloNegocio} onChange={(e) => setModeloNegocio(e.target.value)} maxLength={1000} rows={3} className={inputClass} />
                </FormField>
                <FormField label="Público-alvo" hint="Perfil de público prioritário. Até 1.000 caracteres.">
                  <textarea value={publicoAlvo} onChange={(e) => setPublicoAlvo(e.target.value)} maxLength={1000} rows={3} className={inputClass} />
                </FormField>
                <FormField label="Objetivo do projeto" hint="Resultado comercial esperado. Até 1.000 caracteres.">
                  <textarea value={objetivoProjeto} onChange={(e) => setObjetivoProjeto(e.target.value)} maxLength={1000} rows={3} className={inputClass} />
                </FormField>
                <FormField label="Diferenciais" hint="Vantagens ou posicionamento conhecidos. Até 1.000 caracteres.">
                  <textarea value={diferenciais} onChange={(e) => setDiferenciais(e.target.value)} maxLength={1000} rows={3} className={inputClass} />
                </FormField>
                <FormField label="Observações analíticas" hint="Premissas úteis para leitura dos dados. Até 1.000 caracteres.">
                  <textarea value={observacoesAnaliticas} onChange={(e) => setObservacoesAnaliticas(e.target.value)} maxLength={1000} rows={3} className={inputClass} />
                </FormField>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-5 rounded-xl bg-[var(--muted)]/30 px-4 py-3">
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--border)] accent-[var(--primary)]"
                />
                <span className="text-sm text-[var(--foreground)]">{ativo ? "Ativo" : "Churn"}</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={syncAfterSave}
                  onChange={(e) => setSyncAfterSave(e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--border)] accent-[var(--primary)]"
                />
                <span className="text-sm text-[var(--foreground)]">Sincronizar após salvar</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={leadScoringEnabled}
                  onChange={(e) => setLeadScoringEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--border)] accent-[var(--primary)]"
                />
                <span className="text-sm text-[var(--foreground)]">Lead Scoring ativado</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={socialMediaAtivo}
                  onChange={(e) => setSocialMediaAtivo(e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--border)] accent-[var(--primary)]"
                />
                <span className="text-sm text-[var(--foreground)]">Social Media ativado</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={telegramAtivo}
                  onChange={(e) => setTelegramAtivo(e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--border)] accent-[var(--primary)]"
                />
                <span className="text-sm text-[var(--foreground)]">Resumo diário no Telegram</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={inPilotEnabled}
                  onChange={(e) => setInPilotEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--border)] accent-[var(--primary)]"
                />
                <span className="text-sm text-[var(--foreground)]">{inPilotEnabled ? "InPilot ativado" : "InPilot desativado"}</span>
              </label>
            </div>

            {clienteId && (
              <CrmConfigSection clienteId={clienteId} sessionReady={sessionReady} />
            )}

            {clienteId && (
              <RdMarketingConfigSection clienteId={clienteId} sessionReady={sessionReady} />
            )}

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-[var(--accent)]/10 px-3 py-2 text-sm text-[var(--accent)]">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {error}
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 rounded-lg bg-[var(--success)]/10 px-3 py-2 text-sm text-[var(--success)]">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                {success}
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
              <button
                onClick={onClose}
                className="rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
              >
                Cancelar
              </button>
              <button
                onClick={() =>
                  onSubmit({
                    nome: nome.trim(),
                    ownerEmail: ownerEmail.trim() || undefined,
                    logoUrl: logoUrl.trim() || undefined,
                    segmento: segmento.trim() || undefined,
                    ativo,
                    orcamentoMidiaGoogleMensal: orcamentoGoogle ? Number(orcamentoGoogle) : null,
                    orcamentoMidiaMetaMensal: orcamentoMeta ? Number(orcamentoMeta) : null,
                    googleAdsAccountId: googleAdsAccountId.trim() || null,
                    googleAdsLoginCustomerId: googleAdsLoginCustomerId.trim() || null,
                    metaAdsAccountId: metaAdsAccountId.trim() || null,
                    instagramBusinessAccountId: instagramAccountId.trim() || null,
                    ga4PropertyId: ga4PropertyId.trim() || null,
                    conexaoMetaId: conexaoMetaId || null,
                    conexaoGoogleId: conexaoGoogleId || null,
                    linkedinAdsAccountId: linkedinAdsAccountId.trim() || null,
                    conexaoLinkedinId: conexaoLinkedinId || null,
                    syncAfterCreate: syncAfterSave,
                    syncNow: syncAfterSave,
                    leadScoringEnabled,
                    socialMediaAtivo,
                    telegramAtivo,
                    objetivoMidia,
                    perfilPanel: perfilPanel || null,
                    squad: squad ? Number(squad) : null,
                    inPilotEnabled,
                    produtoServico: produtoServico.trim() || null,
                    modeloNegocio: modeloNegocio.trim() || null,
                    publicoAlvo: publicoAlvo.trim() || null,
                    objetivoProjeto: objetivoProjeto.trim() || null,
                    diferenciais: diferenciais.trim() || null,
                    observacoesAnaliticas: observacoesAnaliticas.trim() || null,
                  })
                }
                disabled={pending}
                className="rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "Salvando..." : submitLabel}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {showSegmentoManager && (
        <SegmentoManagerModal
          onClose={() => setShowSegmentoManager(false)}
        />
      )}
    </>
  );
}

const CRM_TIPOS = [
  { value: "", label: "Nenhum (sem integração CRM)" },
  { value: "CVCRM", label: "CV CRM" },
  { value: "RDSTATION_CRM", label: "RD Station CRM" },
  { value: "KOMMO", label: "Kommo" },
  { value: "EXACT_SPOTTER", label: "Exact Spotter" },
];

function CrmConfigSection({
  clienteId,
  sessionReady,
}: {
  clienteId: string;
  sessionReady: boolean;
}) {
  const [tipo, setTipo] = useState("");
  const [dominio, setDominio] = useState("");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [tagFilterText, setTagFilterText] = useState("");
  const [midiaFilterText, setMidiaFilterText] = useState("");
  const [origemOriginalFilterText, setOrigemOriginalFilterText] = useState("");
  const [origemUltimoFilterText, setOrigemUltimoFilterText] = useState("");
  const [conversaoOriginalFilterText, setConversaoOriginalFilterText] = useState("");
  const [conversaoUltimoFilterText, setConversaoUltimoFilterText] = useState("");
  const [rdClientId, setRdClientId] = useState("");
  const [rdClientSecret, setRdClientSecret] = useState("");
  const [rdConnected, setRdConnected] = useState(false);
  const [spotterToken, setSpotterToken] = useState("");
  const [spotterAllowedSources, setSpotterAllowedSources] = useState("");
  const [spotterAllowedStages, setSpotterAllowedStages] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; msg: string } | null>(null);
  const [initialLoaded, setInitialLoaded] = useState(false);

  useEffect(() => {
    if (initialLoaded) return;
    setInitialLoaded(true);
    fetch(`/api/admin/clientes/${clienteId}/crm`, {
      headers: {},
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data) return;
        setTipo(data.tipo ?? "");
        setDominio(data.dominio ?? "");
        setAtivo(data.ativo ?? true);
        const creds = data.credenciais ?? {};
        setEmail(creds.email ?? "");
        setToken(creds.token ?? "");
        if (Array.isArray(creds.tagFilter) && creds.tagFilter.length > 0) {
          setTagFilterText((creds.tagFilter as string[]).join(", "));
        }
        if (Array.isArray(creds.midiaFilter) && creds.midiaFilter.length > 0) {
          setMidiaFilterText((creds.midiaFilter as string[]).join(", "));
        }
        if (Array.isArray(creds.origemOriginalFilter) && creds.origemOriginalFilter.length > 0) {
          setOrigemOriginalFilterText((creds.origemOriginalFilter as string[]).join(", "));
        }
        if (Array.isArray(creds.origemUltimoFilter) && creds.origemUltimoFilter.length > 0) {
          setOrigemUltimoFilterText((creds.origemUltimoFilter as string[]).join(", "));
        }
        if (
          Array.isArray(creds.conversaoOriginalFilter) &&
          creds.conversaoOriginalFilter.length > 0
        ) {
          setConversaoOriginalFilterText((creds.conversaoOriginalFilter as string[]).join(", "));
        }
        if (Array.isArray(creds.conversaoUltimoFilter) && creds.conversaoUltimoFilter.length > 0) {
          setConversaoUltimoFilterText((creds.conversaoUltimoFilter as string[]).join(", "));
        }
        if (data.tipo === "RDSTATION_CRM") {
          setRdClientId(creds.clientId ?? "");
          setRdConnected(!!creds.connected);
          if (creds.clientSecret) setRdClientSecret("••••••••");
        }
        if (data.tipo === "EXACT_SPOTTER") {
          if (creds.token) setSpotterToken("••••••••");
          if (Array.isArray(creds.allowedSources) && creds.allowedSources.length > 0)
            setSpotterAllowedSources((creds.allowedSources as string[]).join(", "));
          if (Array.isArray(creds.allowedStages) && creds.allowedStages.length > 0)
            setSpotterAllowedStages((creds.allowedStages as string[]).join(", "));
        }
      })
      .catch(() => {});
  }, [clienteId, initialLoaded]);

  async function handleSave() {
    setLoading(true);
    setStatusMsg(null);
    try {
      const credenciais: Record<string, unknown> = {};
      if (tipo === "CVCRM") {
        const parseList = (s: string) =>
          s.split(/[\n,]/).map((t) => t.trim()).filter(Boolean);
        credenciais.email = email.trim();
        credenciais.token = token.trim();
        credenciais.tagFilter = parseList(tagFilterText);
        credenciais.midiaFilter = parseList(midiaFilterText);
        credenciais.origemOriginalFilter = parseList(origemOriginalFilterText);
        credenciais.origemUltimoFilter = parseList(origemUltimoFilterText);
        credenciais.conversaoOriginalFilter = parseList(conversaoOriginalFilterText);
        credenciais.conversaoUltimoFilter = parseList(conversaoUltimoFilterText);
      } else if (tipo === "RDSTATION_CRM") {
        if (rdClientId.trim()) credenciais.clientId = rdClientId.trim();
        if (rdClientSecret && !rdClientSecret.startsWith("•"))
          credenciais.clientSecret = rdClientSecret.trim();
      } else if (tipo === "KOMMO") {
        credenciais.token = token.trim();
      } else if (tipo === "EXACT_SPOTTER") {
        const parseList = (s: string) =>
          s.split(/[\n,]/).map((t) => t.trim()).filter(Boolean);
        if (spotterToken && !spotterToken.startsWith("•"))
          credenciais.token = spotterToken.trim();
        credenciais.allowedSources = parseList(spotterAllowedSources);
        credenciais.allowedStages = parseList(spotterAllowedStages);
      }
      const res = await fetch(`/api/admin/clientes/${clienteId}/crm`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: tipo || undefined,
          dominio: dominio.trim() || null,
          credenciais,
          ativo,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatusMsg({ ok: false, msg: data.error ?? "Erro ao salvar" });
      } else {
        setStatusMsg({
          ok: true,
          msg: tipo ? "Credenciais salvas com sucesso." : "Integração CRM removida.",
        });
      }
    } catch (e) {
      setStatusMsg({ ok: false, msg: e instanceof Error ? e.message : "Erro desconhecido" });
    } finally {
      setLoading(false);
    }
  }

  async function handleTest() {
    setTestLoading(true);
    setStatusMsg(null);
    try {
      const credenciais: Record<string, unknown> = {};
      if (tipo === "CVCRM") {
        credenciais.email = email.trim();
        credenciais.token = token.trim();
      } else if (tipo === "KOMMO") {
        credenciais.token = token.trim();
      } else if (tipo === "EXACT_SPOTTER") {
        if (spotterToken && !spotterToken.startsWith("•"))
          credenciais.token = spotterToken.trim();
      }
      const res = await fetch(`/api/admin/clientes/${clienteId}/crm?action=test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          dominio: dominio.trim() || null,
          credenciais: tipo === "RDSTATION_CRM" ? undefined : credenciais,
        }),
      });
      const data = await res.json().catch(() => ({}));
      setStatusMsg({
        ok: !!data.ok,
        msg: data.ok ? "Conexão testada com sucesso!" : (data.error ?? "Falha na conexão"),
      });
    } catch (e) {
      setStatusMsg({ ok: false, msg: e instanceof Error ? e.message : "Erro desconhecido" });
    } finally {
      setTestLoading(false);
    }
  }

  async function handleRemove() {
    setLoading(true);
    setStatusMsg(null);
    try {
      await fetch(`/api/admin/clientes/${clienteId}/crm`, {
        method: "DELETE",
        headers: {},
      });
      setTipo("");
      setDominio("");
      setEmail("");
      setToken("");
      setRdClientId("");
      setRdClientSecret("");
      setRdConnected(false);
      setSpotterToken("");
      setSpotterAllowedSources("");
      setSpotterAllowedStages("");
      setStatusMsg({ ok: true, msg: "Integração CRM removida." });
    } catch (e) {
      setStatusMsg({ ok: false, msg: e instanceof Error ? e.message : "Erro ao remover" });
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-[var(--primary)]/40 focus:outline-none";

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/10 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-1 w-1 rounded-full bg-[var(--primary)]" />
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
          Integração CRM
        </p>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-[var(--muted-foreground)]">Plataforma CRM</label>
        <PillSelect
          className="w-full"
          size="field"
          value={tipo}
          onChange={setTipo}
          options={CRM_TIPOS.map((t) => ({ value: t.value, label: t.label }))}
          aria-label="Plataforma CRM"
        />
      </div>

      {tipo === "CVCRM" && (
        <>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--muted-foreground)]">
              Domínio CV CRM
            </label>
            <input
              type="text"
              value={dominio}
              onChange={(e) => setDominio(e.target.value)}
              placeholder="Ex.: meuseguro (de meuseguro.cvcrm.com.br)"
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--muted-foreground)]">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--muted-foreground)]">Token de API</label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="••••••••••••••••"
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--muted-foreground)]">
              Filtro por tags{" "}
              <span className="font-normal text-[var(--muted-foreground)]/70">(apenas leads com essas tags — separe por vírgula)</span>
            </label>
            <textarea
              value={tagFilterText}
              onChange={(e) => setTagFilterText(e.target.value)}
              placeholder="Ex.: form_meta_arboreto_inout, lp_arboreto_inout"
              rows={2}
              className={`${inputClass} resize-none`}
            />
            {tagFilterText.trim() && (
              <p className="text-[10px] text-[var(--muted-foreground)]/70">
                Tags ativas:{" "}
                {tagFilterText.split(/[\n,]/).map((t) => t.trim()).filter(Boolean).map((t) => (
                  <code key={t} className="mr-1 rounded bg-[var(--muted)]/60 px-1 py-0.5 font-mono">{t}</code>
                ))}
              </p>
            )}
          </div>

          <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--background)]/40 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
              Filtros de atribuição{" "}
              <span className="font-normal normal-case tracking-normal text-[var(--muted-foreground)]/70">
                — só contam leads cujos campos batem com estes valores. Vazio = sem filtro. Separe por vírgula.
              </span>
            </p>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">
                Mídia original{" "}
                <span className="font-normal text-[var(--muted-foreground)]/70">(canal pago: Meta / Google)</span>
              </label>
              <input
                type="text"
                value={midiaFilterText}
                onChange={(e) => setMidiaFilterText(e.target.value)}
                placeholder="Ex.: Facebook Ads, Google"
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">
                Origens{" "}
                <span className="font-normal text-[var(--muted-foreground)]/70">(origem original do lead — campo &quot;Origens&quot; no CV CRM)</span>
              </label>
              <input
                type="text"
                value={origemOriginalFilterText}
                onChange={(e) => setOrigemOriginalFilterText(e.target.value)}
                placeholder="Ex.: Busca Compartilhada"
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">
                Origem do último{" "}
                <span className="font-normal text-[var(--muted-foreground)]/70">(inclua &quot;Busca Orgânica&quot; p/ contar Google orgânico)</span>
              </label>
              <input
                type="text"
                value={origemUltimoFilterText}
                onChange={(e) => setOrigemUltimoFilterText(e.target.value)}
                placeholder="Ex.: Busca Compartilhada, Facebook, Google, Busca Orgânica"
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--muted-foreground)]">
                  Conversão original
                </label>
                <input
                  type="text"
                  value={conversaoOriginalFilterText}
                  onChange={(e) => setConversaoOriginalFilterText(e.target.value)}
                  placeholder="Ex.: RdStation"
                  className={inputClass}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--muted-foreground)]">
                  Conversão último
                </label>
                <input
                  type="text"
                  value={conversaoUltimoFilterText}
                  onChange={(e) => setConversaoUltimoFilterText(e.target.value)}
                  placeholder="Ex.: RdStation"
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {tipo === "RDSTATION_CRM" && (
        <>
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
              Credenciais do App RD Station
            </p>
            <div className="rounded-lg bg-[var(--muted)]/30 px-3 py-2 text-[11px] text-[var(--muted-foreground)] space-y-1">
              <p>
                Crie um app em{" "}
                <strong>app.rdstation.com.br → App Store → Meus Apps</strong> com a URL de
                callback:
              </p>
              <code className="block break-all rounded bg-[var(--muted)]/60 px-1.5 py-1 font-mono text-[10px] select-all">
                {typeof window !== "undefined"
                  ? `${window.location.origin}/api/auth/rd-station/callback`
                  : "/api/auth/rd-station/callback"}
              </code>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">Client ID</label>
              <input
                type="text"
                value={rdClientId}
                onChange={(e) => setRdClientId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">
                Client Secret
              </label>
              <input
                type="password"
                value={rdClientSecret}
                onChange={(e) => setRdClientSecret(e.target.value)}
                placeholder={rdConnected ? "Deixe em branco para manter" : "••••••••••••••••"}
                className={inputClass}
              />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
              Autenticação OAuth
            </p>
            {rdConnected ? (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" /> Conectado
                </span>
                <a
                  href={`/api/auth/rd-station/start?clienteId=${clienteId}`}
                  className="flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors"
                >
                  <RefreshCw className="h-3 w-3" /> Reconectar
                </a>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-[var(--muted-foreground)]">
                  Salve as credenciais acima e depois clique para autorizar.
                </p>
                <a
                  href={`/api/auth/rd-station/start?clienteId=${clienteId}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1877F2] px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Conectar via RD Station
                </a>
              </div>
            )}
          </div>
        </>
      )}

      {tipo === "KOMMO" && (
        <>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--muted-foreground)]">
              Subdomínio Kommo
            </label>
            <input
              type="text"
              value={dominio}
              onChange={(e) => setDominio(e.target.value)}
              placeholder="Ex.: minhaempresa (de minhaempresa.kommo.com)"
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--muted-foreground)]">
              Access Token
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="••••••••••••••••"
              className={inputClass}
            />
          </div>
        </>
      )}

      {tipo === "EXACT_SPOTTER" && (
        <>
          <div className="rounded-lg bg-[var(--muted)]/30 px-3 py-2 text-[11px] text-[var(--muted-foreground)] space-y-0.5">
            <p>Token gerado em <strong>CONFIGURAÇÕES → INTEGRAÇÕES</strong> no Exact Spotter.</p>
            <p className="text-[10px] opacity-70">O token é enviado no header <code className="font-mono">token_exact</code> em cada requisição.</p>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--muted-foreground)]">Token de API</label>
            <input
              type="password"
              value={spotterToken}
              onChange={(e) => setSpotterToken(e.target.value)}
              placeholder="••••••••••••••••"
              className={inputClass}
            />
          </div>
          <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--background)]/40 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
              Filtros de origem{" "}
              <span className="font-normal normal-case tracking-normal text-[var(--muted-foreground)]/70">
                — deixe vazio para importar todos os leads. Separe por vírgula.
              </span>
            </p>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">
                Origens permitidas{" "}
                <span className="font-normal text-[var(--muted-foreground)]/70">(filtra pelo campo &quot;source&quot; do lead — ex.: Meta Ads, Google Ads)</span>
              </label>
              <input
                type="text"
                value={spotterAllowedSources}
                onChange={(e) => setSpotterAllowedSources(e.target.value)}
                placeholder="Ex.: Meta, Google, Facebook"
                className={inputClass}
              />
              {spotterAllowedSources.trim() && (
                <p className="text-[10px] text-[var(--muted-foreground)]/70">
                  Origens ativas:{" "}
                  {spotterAllowedSources.split(/[\n,]/).map((t) => t.trim()).filter(Boolean).map((t) => (
                    <code key={t} className="mr-1 rounded bg-[var(--muted)]/60 px-1 py-0.5 font-mono">{t}</code>
                  ))}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">
                Etapas permitidas{" "}
                <span className="font-normal text-[var(--muted-foreground)]/70">(filtra pelo campo &quot;stage&quot; — ex.: Entrada, Qualificados)</span>
              </label>
              <input
                type="text"
                value={spotterAllowedStages}
                onChange={(e) => setSpotterAllowedStages(e.target.value)}
                placeholder="Ex.: Entrada, Qualificados, Agendados (vazio = todos)"
                className={inputClass}
              />
            </div>
          </div>
        </>
      )}

      {tipo && (
        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--border)] accent-[var(--primary)]"
          />
          <span className="text-sm text-[var(--foreground)]">Integração ativa</span>
        </label>
      )}

      {statusMsg && (
        <div
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
            statusMsg.ok
              ? "bg-emerald-500/10 text-emerald-600"
              : "bg-[var(--accent)]/10 text-[var(--accent)]"
          }`}
        >
          {statusMsg.ok ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          )}
          {statusMsg.msg}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleSave}
          disabled={loading}
          className="rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Salvando..." : "Salvar CRM"}
        </button>
        {tipo && tipo !== "RDSTATION_CRM" && (
          <button
            onClick={handleTest}
            disabled={testLoading}
            className="rounded-xl border border-[var(--border)] px-4 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--muted)] disabled:opacity-50"
          >
            {testLoading ? "Testando..." : "Testar conexão"}
          </button>
        )}
        {tipo && (
          <button
            onClick={handleRemove}
            disabled={loading}
            className="ml-auto rounded-xl border border-[var(--border)] px-4 py-2 text-xs font-medium text-[var(--muted-foreground)] transition hover:bg-[var(--muted)]"
          >
            Remover CRM
          </button>
        )}
      </div>
    </div>
  );
}

// ─── RD Station Marketing Config ────────────────────────────────────────────

function RdMarketingConfigSection({
  clienteId,
  sessionReady,
}: {
  clienteId: string;
  sessionReady: boolean;
}) {
  const [mktClientId, setMktClientId] = useState("");
  const [mktClientSecret, setMktClientSecret] = useState("");
  const [mktConnected, setMktConnected] = useState(false);
  const [segmentationId, setSegmentationId] = useState("");
  const [segmentations, setSegmentations] = useState<Array<{ id: string; name: string }>>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [rdSyncLoading, setRdSyncLoading] = useState(false);
  const [ativo, setAtivo] = useState(true);
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; msg: string } | null>(null);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const inputClass =
    "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-[var(--primary)]/40 focus:outline-none";

  useEffect(() => {
    if (initialLoaded) return;
    setInitialLoaded(true);
    fetch(`/api/admin/clientes/${clienteId}/rd-marketing`, {
      headers: {},
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data) return;
        setAtivo(data.ativo ?? true);
        const creds = data.credenciais ?? {};
        setMktClientId(creds.clientId ?? "");
        setMktConnected(!!creds.connected);
        if (creds.clientSecretSet) setMktClientSecret("••••••••");
        setSegmentationId(creds.segmentationId ?? "");
      })
      .catch(() => {});
  }, [clienteId, initialLoaded]);

  async function handleSave() {
    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/admin/clientes/${clienteId}/rd-marketing`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: mktClientId.trim() || undefined,
          clientSecret: mktClientSecret && !mktClientSecret.startsWith("•") ? mktClientSecret.trim() : undefined,
          ativo,
          segmentationId: segmentationId.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatusMsg({ ok: false, msg: data.error ?? "Erro ao salvar" });
      } else {
        setStatusMsg({ ok: true, msg: "Credenciais salvas." });
      }
    } catch (e) {
      setStatusMsg({ ok: false, msg: e instanceof Error ? e.message : "Erro desconhecido" });
    } finally {
      setLoading(false);
    }
  }

  async function handleTest() {
    setTestLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/clientes/${clienteId}/crm/enrich`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      setStatusMsg({
        ok: !!data.ok,
        msg: data.ok
          ? `Enriquecimento OK — ${data.enriched ?? 0} leads atualizados, ${data.skipped ?? 0} ignorados.`
          : (data.error ?? "Falha no enriquecimento"),
      });
    } catch (e) {
      setStatusMsg({ ok: false, msg: e instanceof Error ? e.message : "Erro desconhecido" });
    } finally {
      setTestLoading(false);
    }
  }

  async function handleEnrich() {
    setEnrichLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/clientes/${clienteId}/crm/enrich`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      setStatusMsg({
        ok: !!data.ok,
        msg: data.ok
          ? `${data.enriched ?? 0} leads enriquecidos, ${data.skipped ?? 0} sem contato encontrado.`
          : (data.error ?? "Falha no enriquecimento"),
      });
    } catch (e) {
      setStatusMsg({ ok: false, msg: e instanceof Error ? e.message : "Erro desconhecido" });
    } finally {
      setEnrichLoading(false);
    }
  }

  async function handleDiscover() {
    setDiscoverLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/admin/clientes/${clienteId}/rd-marketing/segmentations`, {
        headers: {},
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatusMsg({ ok: false, msg: data.error ?? "Erro ao listar segmentações" });
        return;
      }
      const list: Array<{ id: string; name: string }> = data.segmentations ?? [];
      setSegmentations(list);
      if (list.length === 0) {
        setStatusMsg({ ok: false, msg: "Nenhuma segmentação encontrada na conta." });
      } else {
        // Auto-seleciona segmentação mais provável: nome contém "todos" / "all" / "base de leads"
        if (!segmentationId) {
          const MATCH_PATTERNS = ["todos os contatos", "all contacts", "base de leads", "todos", "all"];
          const autoMatch = list.find((s) =>
            MATCH_PATTERNS.some((p) => s.name.toLowerCase().includes(p))
          );
          if (autoMatch) setSegmentationId(autoMatch.id);
        }
        setStatusMsg({ ok: true, msg: `${list.length} segmentação(ões) encontrada(s). Selecione abaixo.` });
      }
    } catch (e) {
      setStatusMsg({ ok: false, msg: e instanceof Error ? e.message : "Erro desconhecido" });
    } finally {
      setDiscoverLoading(false);
    }
  }

  async function handleRdSync() {
    setRdSyncLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/clientes/${clienteId}/crm/enrich?mode=rd_contacts`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      setStatusMsg({
        ok: !!data.ok,
        msg: data.ok
          ? `Sync RD concluído — ${data.processed ?? 0} processados, ${data.enriched ?? 0} enriquecidos, ${data.created ?? 0} stubs criados, ${data.skipped ?? 0} ignorados.`
          : (data.error ?? "Falha no sync RD"),
      });
    } catch (e) {
      setStatusMsg({ ok: false, msg: e instanceof Error ? e.message : "Erro desconhecido" });
    } finally {
      setRdSyncLoading(false);
    }
  }

  async function handleRemove() {
    if (!confirm("Remover configuração RD Marketing?")) return;
    setLoading(true);
    try {
      await fetch(`/api/admin/clientes/${clienteId}/rd-marketing`, {
        method: "DELETE",
        headers: {},
      });
      setMktClientId("");
      setMktClientSecret("");
      setMktConnected(false);
      setStatusMsg({ ok: true, msg: "Configuração removida." });
    } catch (e) {
      setStatusMsg({ ok: false, msg: e instanceof Error ? e.message : "Erro ao remover" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/10 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-1 w-1 rounded-full bg-[var(--primary)]" />
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
          RD Station Marketing (Enriquecimento de Leads)
        </p>
      </div>

      <div className="rounded-lg bg-[var(--muted)]/30 px-3 py-2 text-[11px] text-[var(--muted-foreground)] space-y-1">
        <p>
          Crie um app em <strong>app.rdstation.com.br → App Store → Meus Apps</strong> com a URL de callback:
        </p>
        <code className="block break-all rounded bg-[var(--muted)]/60 px-1.5 py-1 font-mono text-[10px] select-all">
          {typeof window !== "undefined"
            ? `${window.location.origin}/api/auth/rd-marketing/callback`
            : "/api/auth/rd-marketing/callback"}
        </code>
        <p className="text-[10px]">
          Usado para enriquecer leads com campos de qualificação (faturamento, segmento, cargo, investimento) vindos do Marketing.
        </p>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-[var(--muted-foreground)]">Client ID</label>
        <input
          type="text"
          value={mktClientId}
          onChange={(e) => setMktClientId(e.target.value)}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          className={inputClass}
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-[var(--muted-foreground)]">Client Secret</label>
        <input
          type="password"
          value={mktClientSecret}
          onChange={(e) => setMktClientSecret(e.target.value)}
          placeholder={mktConnected ? "Deixe em branco para manter" : "••••••••••••••••"}
          className={inputClass}
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-[var(--muted-foreground)]">
            ID da Segmentação (fonte primária de leads)
          </label>
          {mktConnected && (
            <button
              onClick={handleDiscover}
              disabled={discoverLoading}
              className="text-[10px] font-semibold text-[var(--primary)] hover:opacity-70 disabled:opacity-40 transition-opacity"
            >
              {discoverLoading ? "Buscando..." : "Descobrir →"}
            </button>
          )}
        </div>
        {segmentations.length > 0 ? (
          <PillSelect
            className="w-full"
            size="field"
            value={segmentationId}
            onChange={setSegmentationId}
            options={[
              { value: "", label: "— selecione —" },
              ...segmentations.map((s) => ({
                value: s.id,
                label: `${s.name} (${s.id})`,
              })),
            ]}
            aria-label="ID da Segmentação"
          />
        ) : (
          <input
            type="text"
            value={segmentationId}
            onChange={(e) => setSegmentationId(e.target.value)}
            placeholder="Ex: 1234567 (use Descobrir para buscar automaticamente)"
            className={inputClass}
          />
        )}
        <p className="text-[10px] text-[var(--muted-foreground)]">
          ID da segmentação RD que contém os leads a importar. Use "Descobrir" para listar as segmentações da conta.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
          Autenticação OAuth
        </p>
        {mktConnected ? (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600">
              <CheckCircle2 className="h-3 w-3" /> Conectado
            </span>
            <a
              href={`/api/auth/rd-marketing/start?clienteId=${clienteId}`}
              className="flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors"
            >
              <RefreshCw className="h-3 w-3" /> Reconectar
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-[var(--muted-foreground)]">
              Salve as credenciais acima e depois clique para autorizar.
            </p>
            <a
              href={`/api/auth/rd-marketing/start?clienteId=${clienteId}`}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1877F2] px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Conectar via RD Station Marketing
            </a>
          </div>
        )}
      </div>

      <label className="flex cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          checked={ativo}
          onChange={(e) => setAtivo(e.target.checked)}
          className="h-4 w-4 rounded border-[var(--border)] accent-[var(--primary)]"
        />
        <span className="text-sm text-[var(--foreground)]">Enriquecimento ativo</span>
      </label>

      {statusMsg && (
        <div
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
            statusMsg.ok
              ? "bg-emerald-500/10 text-emerald-600"
              : "bg-[var(--accent)]/10 text-[var(--accent)]"
          }`}
        >
          {statusMsg.ok ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          )}
          {statusMsg.msg}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleSave}
          disabled={loading}
          className="rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Salvando..." : "Salvar Marketing"}
        </button>
        {mktConnected && segmentationId && (
          <button
            onClick={handleRdSync}
            disabled={rdSyncLoading || enrichLoading || testLoading}
            className="rounded-xl bg-[var(--primary)]/10 border border-[var(--primary)]/20 px-4 py-2 text-xs font-semibold text-[var(--primary)] transition hover:bg-[var(--primary)]/20 disabled:opacity-50"
          >
            {rdSyncLoading ? "Sincronizando..." : "Sync contatos RD →"}
          </button>
        )}
        {mktConnected && (
          <button
            onClick={handleEnrich}
            disabled={enrichLoading || testLoading || rdSyncLoading}
            className="rounded-xl border border-[var(--border)] px-4 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--muted)] disabled:opacity-50"
          >
            {enrichLoading ? "Enriquecendo..." : "Enriquecer leads agora"}
          </button>
        )}
        {mktConnected && (
          <button
            onClick={handleTest}
            disabled={testLoading || enrichLoading || rdSyncLoading}
            className="rounded-xl border border-[var(--border)] px-4 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--muted)] disabled:opacity-50"
          >
            {testLoading ? "Testando..." : "Testar conexão"}
          </button>
        )}
        {(mktClientId || mktConnected) && (
          <button
            onClick={handleRemove}
            disabled={loading}
            className="ml-auto rounded-xl border border-[var(--border)] px-4 py-2 text-xs font-medium text-[var(--muted-foreground)] transition hover:bg-[var(--muted)]"
          >
            Remover
          </button>
        )}
      </div>
    </div>
  );
}

export default function AdminClientesPage() {
  const sessionReady = true;
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editing, setEditing] = useState<ClienteAdmin | null>(null);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ativos" | "churn">("ativos");
  const [copiedPortalId, setCopiedPortalId] = useState<string | null>(null);
  const [confirmRegenId, setConfirmRegenId] = useState<string | null>(null);
  const [telegramTestingId, setTelegramTestingId] = useState<string | null>(null);
  const [telegramTestResult, setTelegramTestResult] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [rdNotification, setRdNotification] = useState<{ ok: boolean; msg: string } | null>(null);

  const queryClient = useQueryClient();

  const { data: clientes, isLoading, error } = useQuery({
    queryKey: ["admin", "clientes"],
    queryFn: () => fetchAdminClientes(),
    retry: (_, err) => (err instanceof Error && err.message === "Unauthorized" ? false : true),
    enabled: sessionReady,
  });

  const { data: segmentos = [] } = useQuery({
    queryKey: ["segmentos"],
    queryFn: fetchSegmentos,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const rdConnected = params.get("rdConnected");
    const rdError = params.get("rdError");
    const rdMktConnected = params.get("rdMktConnected");
    const rdMktError = params.get("rdMktError");
    const connectedClienteId = params.get("clienteId");
    if (rdConnected === "1") {
      setRdNotification({ ok: true, msg: "RD Station CRM conectado com sucesso!" });
      if (connectedClienteId && clientes) {
        const c = clientes.find((x) => x.id === connectedClienteId);
        if (c) setEditing(c);
      }
      window.history.replaceState({}, "", "/admin/clientes");
    } else if (rdError) {
      setRdNotification({ ok: false, msg: `Erro ao conectar RD Station CRM: ${decodeURIComponent(rdError)}` });
      window.history.replaceState({}, "", "/admin/clientes");
    } else if (rdMktConnected === "1") {
      setRdNotification({ ok: true, msg: "RD Station Marketing conectado com sucesso!" });
      if (connectedClienteId && clientes) {
        const c = clientes.find((x) => x.id === connectedClienteId);
        if (c) setEditing(c);
      }
      window.history.replaceState({}, "", "/admin/clientes");
    } else if (rdMktError) {
      setRdNotification({ ok: false, msg: `Erro ao conectar RD Station Marketing: ${decodeURIComponent(rdMktError)}` });
      window.history.replaceState({}, "", "/admin/clientes");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientes]);

  const createMutation = useMutation({
    mutationFn: (body: ClientePayload) => createCliente(body),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "clientes"] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      setFormError("");
      setFormSuccess(data.sync ? "" : "Cliente criado.");
      setShowCreateForm(false);
    },
    onError: (e: Error) => {
      setFormError(e.message);
      setFormSuccess("");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; body: ClientePayload }) =>
      updateCliente(payload.id, payload.body),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "clientes"] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      setEditError("");
      setEditSuccess(data.sync ? "Cliente atualizado e sincronizado." : "Cliente atualizado.");
      setTimeout(() => setEditing(null), 700);
    },
    onError: (e: Error) => setEditError(e.message),
  });

  const syncMutation = useMutation({
    mutationFn: (clienteId: string) => syncCliente(clienteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "clientes"] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      setFormError("");
      setFormSuccess("Sincronização concluída.");
    },
    onError: (e: Error) => {
      setFormError(e.message);
      setFormSuccess("");
    },
  });

  const syncAllMutation = useMutation({
    mutationFn: () => syncAll(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "clientes"] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      const total = data.summary?.total ?? data.results?.length ?? 0;
      const erros = data.summary?.erros ?? 0;
      setFormError("");
      setFormSuccess(`Atualização concluída. ${total} cliente(s) sincronizado(s)${erros > 0 ? ` · ${erros} com erro` : ""}.`);
    },
    onError: (e: Error) => {
      setFormError(e.message);
      setFormSuccess("");
    },
  });

  const demoMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/demo/incorporadora", {
        method: "POST",
        headers: getHeaders(),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? `Erro ${response.status} ao atualizar demo`);
      return body;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "clientes"] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      setFormError("");
      setFormSuccess(
        `Cliente-demo atualizado até ${data.result.endDate}: ${data.result.crmLeads} leads integrados e validados.`,
      );
    },
    onError: (e: Error) => {
      setFormError(e.message);
      setFormSuccess("");
    },
  });


  const regenTokenMutation = useMutation({
    mutationFn: async (clienteId: string) => {
      const r = await fetch(`/api/admin/clientes/${clienteId}/regenerate-token`, {
        method: "POST",
        headers: getHeaders(),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? `Erro ${r.status} ao gerar novo link`);
      }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "clientes"] });
      setConfirmRegenId(null);
    },
    onError: (e: Error) => {
      setFormError(e.message);
      setConfirmRegenId(null);
    },
  });

  const unauthorized = error instanceof Error && error.message === "Unauthorized";

  const filteredClientes = useMemo(() => {
    if (!clientes) return [];
    const base =
      filterStatus === "ativos"
        ? clientes.filter((c) => c.ativo)
        : clientes.filter((c) => !c.ativo);
    return [...base].sort((a, b) => {
      if (a.ativo !== b.ativo) return a.ativo ? -1 : 1;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
  }, [clientes, filterStatus]);

  if (unauthorized) {
    return (
      <AppPage title="Workspaces">
        <p className="type-body text-[var(--ink-muted-48)]">Sua sessão não possui acesso administrativo.</p>
      </AppPage>
    );
  }

  const total = clientes?.length ?? 0;
  const ativos = clientes?.filter((c) => c.ativo).length ?? 0;
  const churn = total - ativos;

  return (
    <AppPage
      title={
        <div>
          <h1 className="type-tagline text-[var(--ink)]">Workspaces</h1>
          <p className="type-fine-print mt-1 text-[var(--ink-muted-48)]">
            {ativos} ativos · {churn} churn · {total} no total
          </p>
        </div>
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            className="!px-2 !py-1.5"
            onClick={() => syncAllMutation.mutate()}
            disabled={syncAllMutation.isPending}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncAllMutation.isPending ? "animate-spin" : ""}`} />
            Sync
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="!px-2 !py-1.5"
            onClick={() => demoMutation.mutate()}
            disabled={demoMutation.isPending}
            title="Cria ou recria o workspace demo"
          >
            Demo
          </Button>
          <Button type="button" onClick={() => setShowCreateForm(true)} className="!px-4 !py-2">
            <Plus className="h-3.5 w-3.5" />
            Novo
          </Button>
        </div>
      }
    >
      {rdNotification && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-[var(--radius-xs)] px-4 py-3 type-body ${
            rdNotification.ok
              ? "bg-[var(--success)] text-[var(--on-primary)]"
              : "bg-[var(--accent)] text-[var(--on-primary)]"
          }`}
        >
          {rdNotification.ok ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          {rdNotification.msg}
          <button
            onClick={() => setRdNotification(null)}
            className="ml-2 opacity-80 hover:opacity-100"
            type="button"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {formError && (
        <div className="flex items-center gap-3 rounded-[var(--radius-xs)] border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-4 py-3 type-body">
          <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--accent)]" />
          <span className="text-[var(--accent)]">{formError}</span>
        </div>
      )}
      {formSuccess && (
        <div className="flex items-center gap-3 rounded-[var(--radius-xs)] border border-[var(--success)]/30 bg-[var(--success)]/5 px-4 py-3 type-body">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--success)]" />
          <span className="text-[var(--success)]">{formSuccess}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)] p-0.5">
          {(["ativos", "churn"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilterStatus(f)}
              className={`rounded-[var(--radius-xs)] px-3 py-1.5 type-button-utility transition ${
                filterStatus === f
                  ? "bg-[var(--primary)] text-[var(--on-primary)]"
                  : "text-[var(--ink-muted-48)] hover:text-[var(--ink)]"
              }`}
            >
              {f === "ativos" ? `Ativos (${ativos})` : `Churn (${churn})`}
            </button>
          ))}
        </div>
        <p className="type-fine-print text-[var(--ink-muted-48)]">
          Tokens OAuth ficam em Config → Conexões do dealer
        </p>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)]"
            />
          ))}
        </div>
      )}

      {!isLoading && filteredClientes.length === 0 && (
        <div className="rounded-[var(--radius-xs)] border border-dashed border-[var(--hairline)] px-6 py-12 text-center">
          <p className="type-body text-[var(--ink)]">
            {filterStatus === "ativos" ? "Nenhum workspace ativo" : "Nenhum workspace em churn"}
          </p>
          <p className="type-fine-print mt-1 text-[var(--ink-muted-48)]">
            Crie um workspace e convide o OWNER por e-mail.
          </p>
          {filterStatus === "ativos" ? (
            <Button type="button" className="mt-4 !px-4 !py-2" onClick={() => setShowCreateForm(true)}>
              <Plus className="h-3.5 w-3.5" />
              Novo workspace
            </Button>
          ) : null}
        </div>
      )}

      {clientes && filteredClientes.length > 0 && (
        <ul className="divide-y divide-[var(--hairline)] rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)]">
          {filteredClientes.map((cliente) => {
            const googleConta = getConta(cliente, "GOOGLE_ADS");
            const metaConta = getConta(cliente, "META");
            const analyticsConta = getConta(cliente, "GOOGLE_ANALYTICS");
            const initials = cliente.nome
              .split(" ")
              .slice(0, 2)
              .map((part) => part[0])
              .join("")
              .toUpperCase();
            const syncing = syncMutation.isPending && syncMutation.variables === cliente.id;

            const channels = [
              googleConta?.accountIdPlataforma
                ? `Google ${googleConta.accountIdPlataforma}`
                : null,
              metaConta?.accountIdPlataforma ? `Meta ${metaConta.accountIdPlataforma}` : null,
              analyticsConta?.accountIdPlataforma
                ? `GA4 ${analyticsConta.accountIdPlataforma}`
                : null,
            ].filter(Boolean);

            return (
              <li
                key={cliente.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  {cliente.logoUrl ? (
                    <Image
                      src={cliente.logoUrl}
                      alt={cliente.nome}
                      width={40}
                      height={40}
                      className="h-10 w-10 shrink-0 rounded-[var(--radius-xs)] object-contain"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-xs)] bg-[var(--surface-pearl)] type-nav-link text-[var(--ink-muted-48)]">
                      {initials}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="type-nav-link truncate text-[var(--ink)]">{cliente.nome}</p>
                    <p className="type-fine-print mt-0.5 text-[var(--ink-muted-48)]">
                      {cliente.slug}
                      {cliente.segmento ? ` · ${cliente.segmento}` : ""}
                      {cliente.squad ? ` · Squad ${cliente.squad}` : ""}
                      {cliente.ultimoSyncAt
                        ? ` · sync ${formatSyncDate(cliente.ultimoSyncAt)}`
                        : ""}
                    </p>
                    <p className="type-fine-print mt-1 text-[var(--ink-muted-48)]">
                      {channels.length > 0 ? channels.join(" · ") : "Sem IDs de mídia"}
                      {formatSaldo(googleConta) ? ` · Google ${formatSaldo(googleConta)}` : ""}
                      {formatSaldo(metaConta) ? ` · Meta ${formatSaldo(metaConta)}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    className="!px-2 !py-1.5"
                    onClick={() => syncMutation.mutate(cliente.id)}
                    disabled={!cliente.ativo || syncing}
                    title="Atualiza mídia, GA4 e CRM"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                  </Button>
                  {cliente.telegramAtivo && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="!px-2 !py-1.5"
                      disabled={telegramTestingId === cliente.id}
                      title="Testar Telegram"
                      onClick={async () => {
                        setTelegramTestingId(cliente.id);
                        try {
                          const r = await fetch(`/api/admin/clientes/${cliente.id}/telegram-test`, {
                            method: "POST",
                            headers: getHeaders(),
                          });
                          const j = await r.json();
                          setTelegramTestResult((p) => ({
                            ...p,
                            [cliente.id]: {
                              ok: r.ok,
                              msg: r.ok ? "Enviado!" : (j.error ?? r.statusText),
                            },
                          }));
                        } catch (e) {
                          setTelegramTestResult((p) => ({
                            ...p,
                            [cliente.id]: {
                              ok: false,
                              msg: e instanceof Error ? e.message : String(e),
                            },
                          }));
                        } finally {
                          setTelegramTestingId(null);
                        }
                      }}
                    >
                      {telegramTestingId === cliente.id ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}
                  {confirmRegenId === cliente.id ? (
                    <span className="flex items-center gap-1 type-fine-print text-[var(--ink-muted-48)]">
                      Substituir link?
                      <button
                        type="button"
                        className="text-[var(--primary)]"
                        disabled={regenTokenMutation.isPending}
                        onClick={() => regenTokenMutation.mutate(cliente.id)}
                      >
                        Confirmar
                      </button>
                      <button type="button" onClick={() => setConfirmRegenId(null)}>
                        Cancelar
                      </button>
                    </span>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        className="!px-2 !py-1.5"
                        disabled={!cliente.portalToken}
                        title="Copiar link do portal"
                        onClick={() => {
                          const origin = window.location.origin;
                          navigator.clipboard.writeText(`${origin}/portal/${cliente.portalToken}`);
                          setCopiedPortalId(cliente.id);
                          setTimeout(() => setCopiedPortalId(null), 2000);
                        }}
                      >
                        {copiedPortalId === cliente.id ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-[var(--success)]" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="!px-2 !py-1.5"
                        title="Gerar novo link do portal"
                        onClick={() => setConfirmRegenId(cliente.id)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    className="!px-3 !py-1.5"
                    onClick={() => {
                      setEditing(cliente);
                      setEditError("");
                      setEditSuccess("");
                    }}
                  >
                    Editar
                  </Button>
                  <Link
                    href={`/clientes/${cliente.id}`}
                    className="inline-flex items-center rounded-[var(--radius-xs)] px-3 py-1.5 type-button-utility text-[var(--primary)]"
                  >
                    Dashboard
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {showCreateForm && (
        <ClienteForm
          title="Novo workspace"
          submitLabel="Criar workspace"
          initialValues={{ nome: "", ativo: true, syncAfterCreate: true }}
          segmentos={segmentos}
          sessionReady={sessionReady}
          pending={createMutation.isPending}
          error={formError}
          success=""
          onClose={() => setShowCreateForm(false)}
          onSubmit={(body) => {
            if (!body.nome?.trim()) {
              setFormError("Nome é obrigatório.");
              return;
            }
            setFormError("");
            createMutation.mutate(body);
          }}
        />
      )}

      {editing && (
        <ClienteForm
          title={`Editar · ${editing.nome}`}
          submitLabel="Salvar alterações"
          initialValues={{
            nome: editing.nome,
            logoUrl: editing.logoUrl ?? undefined,
            segmento: editing.segmento ?? undefined,
            ativo: editing.ativo,
            syncNow: true,
            googleAdsAccountId: getConta(editing, "GOOGLE_ADS")?.accountIdPlataforma ?? null,
            googleAdsLoginCustomerId:
              getConta(editing, "GOOGLE_ADS")?.googleAdsLoginCustomerId ?? null,
            metaAdsAccountId: getConta(editing, "META")?.accountIdPlataforma ?? null,
            instagramBusinessAccountId: getConta(editing, "INSTAGRAM")?.accountIdPlataforma ?? null,
            ga4PropertyId: getConta(editing, "GOOGLE_ANALYTICS")?.accountIdPlataforma ?? null,
            conexaoMetaId: getConta(editing, "META")?.conexaoIntegracaoId ?? null,
            conexaoGoogleId: getConta(editing, "GOOGLE_ADS")?.conexaoIntegracaoId ?? null,
            linkedinAdsAccountId: getConta(editing, "LINKEDIN")?.accountIdPlataforma ?? null,
            conexaoLinkedinId: getConta(editing, "LINKEDIN")?.conexaoIntegracaoId ?? null,
            leadScoringEnabled: editing.leadScoringEnabled,
            socialMediaAtivo: editing.socialMediaAtivo,
            telegramAtivo: editing.telegramAtivo,
            inPilotEnabled: editing.inPilotEnabled,
            objetivoMidia: editing.objetivoMidia,
            perfilPanel: editing.perfilPanel ?? null,
            squad: editing.squad ?? null,
            produtoServico: editing.produtoServico ?? null,
            modeloNegocio: editing.modeloNegocio ?? null,
            publicoAlvo: editing.publicoAlvo ?? null,
            objetivoProjeto: editing.objetivoProjeto ?? null,
            diferenciais: editing.diferenciais ?? null,
            observacoesAnaliticas: editing.observacoesAnaliticas ?? null,
          }}
          segmentos={segmentos}
          sessionReady={sessionReady}
          clienteId={editing.id}
          pending={updateMutation.isPending}
          error={editError}
          success={editSuccess}
          onClose={() => setEditing(null)}
          onSubmit={(body) => {
            if (!body.nome?.trim()) {
              setEditError("Nome é obrigatório.");
              return;
            }
            setEditError("");
            updateMutation.mutate({ id: editing.id, body });
          }}
        />
      )}
    </AppPage>
  );
}
