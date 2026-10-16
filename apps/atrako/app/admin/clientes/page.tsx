"use client";

import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PillSelect } from "@/components/ui/pill-select";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Switch } from "@/components/ui/switch";
import { AppPage } from "@/components/layout/AppPage";
import { SegmentoManagerModal, fetchSegmentos, type Segmento } from "./SegmentoManagerModal";
import { LogoUploadField } from "./LogoUploadField";
import { ClienteAcessoSection } from "./ClienteAcessoSection";

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
  edition?: string | null;
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
  edition?: string | null;
  squad?: number | null;
  produtoServico?: string | null;
  modeloNegocio?: string | null;
  publicoAlvo?: string | null;
  objetivoProjeto?: string | null;
  diferenciais?: string | null;
  observacoesAnaliticas?: string | null;
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
      <label className="mb-1.5 block type-caption-strong uppercase text-[var(--muted-foreground)]">
        {label}
        {required && <span className="ml-1 text-[var(--primary)]">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 type-fine-print text-[var(--muted-foreground)]">{hint}</p>}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 type-caption transition-colors focus:border-[var(--primary)]/40 focus:outline-none";

function SegmentoField({
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
  const options = [
    { value: "", label: "Sem segmento" },
    ...segmentos.map((s) => ({ value: s.nome, label: s.nome, color: s.cor })),
  ];
  if (value && !options.some((item) => item.value === value)) {
    options.splice(1, 0, { value, label: value });
  }

  return (
    <div className="flex items-center gap-2">
      <PillSelect
        className="min-w-0 flex-1"
        size="field"
        value={value}
        onChange={onChange}
        options={options}
        aria-label="Segmento"
      />
      <IconButton onClick={onOpenManager} aria-label="Gerenciar segmentos" title="Gerenciar segmentos">
        <Plus className="h-4 w-4" strokeWidth={1.75} />
      </IconButton>
    </div>
  );
}

const EDITIONS = [
  { value: "custom", label: "Personalizado" },
  { value: "food", label: "Food" },
  { value: "stay", label: "Aluguel por temporada" },
  { value: "inside_sales", label: "Inside sales" },
  { value: "ecommerce", label: "E-commerce" },
];

function editionLabel(value: string | null | undefined) {
  return EDITIONS.find((item) => item.value === value)?.label ?? "Personalizado";
}

function ClienteForm({
  title,
  submitLabel,
  initialValues,
  segmentos,
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
  const [edition, setEdition] = useState(initialValues.edition ?? "custom");
  const [showSegmentoManager, setShowSegmentoManager] = useState(false);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
        <Card className="w-full max-w-2xl overflow-hidden rounded-2xl border-[var(--border)]">
          <CardHeader className="flex flex-row items-center justify-between border-b border-[var(--border)] pb-5">
            <div>
              <CardTitle>{title}</CardTitle>
              <p className="mt-1 type-fine-print text-[var(--muted-foreground)]">
                A versão escolhe os módulos deste workspace. Contas e tokens ficam em Config → Conexões.
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
              type="button"
              aria-label="Fechar"
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
                hint="Gera um link de convite para o dono definir a senha e acessar só este workspace."
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

            <FormField
              label="Versão"
              hint="Food abre o cardápio. Aluguel por temporada abre a estadia. Personalizado mantém os módulos como estão."
            >
              <div className="max-w-xs">
                <PillSelect
                  size="field"
                  value={edition}
                  onChange={setEdition}
                  options={EDITIONS.map((item) => ({ value: item.value, label: item.label }))}
                  aria-label="Versão"
                />
              </div>
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Logo">
                <LogoUploadField value={logoUrl} onChange={setLogoUrl} />
              </FormField>
              <FormField label="Segmento">
                <SegmentoField
                  value={segmento}
                  onChange={setSegmento}
                  segmentos={segmentos}
                  onOpenManager={() => setShowSegmentoManager(true)}
                />
              </FormField>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-[var(--radius-xs)] border border-[var(--hairline)] px-4 py-3">
              <div>
                <p className="type-caption-strong text-[var(--ink)]">{ativo ? "Ativo" : "Churn"}</p>
                <p className="type-fine-print text-[var(--ink-muted-48)]">
                  {ativo ? "A equipe e o cliente entram neste workspace." : "O workspace fica fora da operação."}
                </p>
              </div>
              <Switch checked={ativo} onChange={setAtivo} aria-label="Workspace ativo" />
            </div>

            {clienteId ? <ClienteAcessoSection clienteId={clienteId} /> : null}

            {error ? (
              <div className="flex items-center gap-2 rounded-lg bg-[var(--accent)]/10 px-3 py-2 type-caption text-[var(--accent)]">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {error}
              </div>
            ) : null}
            {success ? (
              <div className="flex items-center gap-2 rounded-lg bg-[var(--success)]/10 px-3 py-2 type-caption text-[var(--success)]">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                {success}
              </div>
            ) : null}

            <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={pending || !nome.trim()}
                onClick={() =>
                  onSubmit({
                    nome: nome.trim(),
                    ownerEmail: ownerEmail.trim() || undefined,
                    logoUrl: logoUrl.trim(),
                    segmento: segmento.trim(),
                    ativo,
                    edition,
                  })
                }
              >
                {pending ? "Salvando..." : submitLabel}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {showSegmentoManager ? (
        <SegmentoManagerModal onClose={() => setShowSegmentoManager(false)} />
      ) : null}
    </>
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
      const invitePath = data.ownerInvite?.acceptPath as string | undefined;
      setFormSuccess(
        invitePath
          ? `Cliente criado. Link para o dono definir a senha (válido por 14 dias): ${window.location.origin}${invitePath}`
          : data.sync
            ? ""
            : "Cliente criado.",
      );
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

  const ativos = clientes?.filter((c) => c.ativo).length ?? 0;
  const churn = (clientes?.length ?? 0) - ativos;

  return (
    <AppPage
      title="Workspaces"
      actions={
        <Button type="button" onClick={() => setShowCreateForm(true)} className="!px-4 !py-2">
          <Plus className="h-3.5 w-3.5" />
          Novo
        </Button>
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
          <span className="break-all text-[var(--success)]">{formSuccess}</span>
        </div>
      )}

      <div className="flex items-center gap-1 rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)] p-0.5 w-fit">
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
            const initials = cliente.nome
              .split(" ")
              .slice(0, 2)
              .map((part) => part[0])
              .join("")
              .toUpperCase();
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
                      {` · ${editionLabel(cliente.edition)}`}
                      {cliente.segmento ? ` · ${cliente.segmento}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
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
                    Abrir
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
            edition: editing.edition ?? "custom",
          }}
          segmentos={segmentos}
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
