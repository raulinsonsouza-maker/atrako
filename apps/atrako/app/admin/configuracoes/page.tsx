"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CheckCircle2,
  KeyRound,
  Plus,
  RefreshCw,
  Send,
  Shield,
  X,
  Wifi,
  ScrollText,
  Trash2,
  UsersRound,
  ChevronRight,
  CircleCheck,
  CircleAlert,
  LockKeyhole,
} from "lucide-react";

function getHeaders(token?: string, includeJson = false): HeadersInit {
  const headers: HeadersInit = {};
  if (includeJson) headers["Content-Type"] = "application/json";
  return headers;
}

async function fetchIntegrationsConfig(token?: string) {
  const res = await fetch("/api/admin/config/integracoes", {
    headers: getHeaders(token),
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) throw new Error("Falha ao carregar configurações");
  return res.json() as Promise<{
    metaAdAccountId: string;
    hasMetaAccessToken: boolean;
    hasGoogleDeveloperToken: boolean;
    hasGoogleRefreshToken: boolean;
    hasGoogleClientId: boolean;
    hasGoogleClientSecret: boolean;
    googleLoginCustomerId: string;
    alertNotificationEmail: string;
    alertWebhookUrl: string;
    alertSmtpHost: string;
    alertSmtpPort: string;
    alertSmtpUser: string;
    hasAlertSmtpPass: boolean;
    alertSmtpFrom: string;
    alertBalanceThresholdDays: string;
    alertSpendGapDays: string;
    hasTelegramBotToken: boolean;
    telegramChannelId: string;
    globalSyncSuccessAt: string | null;
    globalSyncAttemptAt: string | null;
  }>;
}

async function updateIntegrationsConfigApi(
  body: Record<string, string | undefined>,
  token?: string
) {
  const res = await fetch("/api/admin/config/integracoes", {
    method: "PATCH",
    headers: getHeaders(token, true),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText);
  return data;
}

interface ConexaoItem {
  id: string;
  nome: string;
  plataforma: "META" | "GOOGLE_ADS" | "LINKEDIN";
  ativo: boolean;
  contasCount: number;
  hasMetaAccessToken: boolean;
  hasGoogleClientId: boolean;
  hasGoogleRefreshToken: boolean;
  hasLinkedinAccessToken?: boolean;
  googleLoginCustomerId?: string;
}

function InputField({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm transition-colors focus:border-[var(--primary)]/40 focus:outline-none"
      />
      {hint && <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">{hint}</p>}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-10 w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl ${wide ? "max-w-4xl" : "max-w-lg"}`}>
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <h3 className="text-base font-bold text-[var(--foreground)]">{title}</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--muted-foreground)] hover:bg-white/5 hover:text-[var(--foreground)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full shrink-0 ${ok ? "bg-emerald-500" : "bg-red-500"}`}
    />
  );
}

export default function AdminIntegrationsConfigPage() {
  const queryClient = useQueryClient();
  const sessionReady = true;

  const [metaAccessToken, setMetaAccessToken] = useState("");
  const [metaAdAccountId, setMetaAdAccountId] = useState("");
  const [googleClientId, setGoogleClientId] = useState("");
  const [googleClientSecret, setGoogleClientSecret] = useState("");
  const [googleDeveloperToken, setGoogleDeveloperToken] = useState("");
  const [googleRefreshToken, setGoogleRefreshToken] = useState("");
  const [googleLoginCustomerId, setGoogleLoginCustomerId] = useState("");

  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const [alertNotificationEmail, setAlertNotificationEmail] = useState("");
  const [alertWebhookUrl, setAlertWebhookUrl] = useState("");
  const [alertSmtpHost, setAlertSmtpHost] = useState("");
  const [alertSmtpPort, setAlertSmtpPort] = useState("");
  const [alertSmtpUser, setAlertSmtpUser] = useState("");
  const [alertSmtpPass, setAlertSmtpPass] = useState("");
  const [alertSmtpFrom, setAlertSmtpFrom] = useState("");
  const [alertBalanceThresholdDays, setAlertBalanceThresholdDays] = useState("");
  const [alertSpendGapDays, setAlertSpendGapDays] = useState("");
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [alertFormError, setAlertFormError] = useState("");
  const [alertFormSuccess, setAlertFormSuccess] = useState("");
  const [testAlertLoading, setTestAlertLoading] = useState(false);
  const [testAlertResult, setTestAlertResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChannelId, setTelegramChannelId] = useState("");
  const [telegramFormError, setTelegramFormError] = useState("");
  const [telegramFormSuccess, setTelegramFormSuccess] = useState("");
  const [telegramTestLoading, setTelegramTestLoading] = useState(false);
  const [telegramTestResult, setTelegramTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [telegramSendAllLoading, setTelegramSendAllLoading] = useState(false);
  const [telegramSendAllResult, setTelegramSendAllResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [platformModal, setPlatformModal] = useState<"meta" | "google" | "linkedin" | "alertas" | "telegram" | null>(null);

  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [logsFilter, setLogsFilter] = useState<"ALL" | "WARN" | "ERROR">("ALL");
  const [logsData, setLogsData] = useState<{ id: string; level: string; message: string; context: unknown; createdAt: string }[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState("");

  const [metaBMModalOpen, setMetaBMModalOpen] = useState(false);
  const [bmNome, setBmNome] = useState("");
  const [bmToken, setBmToken] = useState("");
  const [bmAccountId, setBmAccountId] = useState("");
  const [bmSaving, setBmSaving] = useState(false);
  const [bmError, setBmError] = useState("");

  const [googleMCCModalOpen, setGoogleMCCModalOpen] = useState(false);
  const [mccNome, setMccNome] = useState("");
  const [mccClientId, setMccClientId] = useState("");
  const [mccClientSecret, setMccClientSecret] = useState("");
  const [mccDeveloperToken, setMccDeveloperToken] = useState("");
  const [mccRefreshToken, setMccRefreshToken] = useState("");
  const [mccLoginCustomerId, setMccLoginCustomerId] = useState("");
  const [mccSaving, setMccSaving] = useState(false);
  const [mccError, setMccError] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "config", "integracoes"],
    queryFn: () => fetchIntegrationsConfig(),
    enabled: sessionReady,
  });

  const { data: conexoes = [] } = useQuery<ConexaoItem[]>({
    queryKey: ["admin-conexoes-mini"],
    queryFn: async () => {
      const r = await fetch("/api/admin/conexoes", { headers: getHeaders() });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: sessionReady,
    staleTime: 30_000,
  });

  const metaBMs = conexoes.filter((c) => c.plataforma === "META");
  const googleMCCs = conexoes.filter((c) => c.plataforma === "GOOGLE_ADS");
  const linkedinConns = conexoes.filter((c) => c.plataforma === "LINKEDIN");
  const metaReady = Boolean(data?.hasMetaAccessToken) || metaBMs.some((bm) => bm.hasMetaAccessToken);
  const googleReady =
    Boolean(
      data?.hasGoogleClientId &&
      data?.hasGoogleClientSecret &&
      data?.hasGoogleDeveloperToken &&
      data?.hasGoogleRefreshToken
    ) ||
    googleMCCs.some((mcc) => mcc.hasGoogleClientId && mcc.hasGoogleRefreshToken);
  const linkedinReady = linkedinConns.some((connection) => connection.ativo && connection.hasLinkedinAccessToken);
  const telegramReady = Boolean(data?.hasTelegramBotToken && data?.telegramChannelId);
  const alertReady = Boolean(data?.alertNotificationEmail || data?.alertWebhookUrl);

  async function startLinkedinOauth(conexaoId: string) {
    try {
      const r = await fetch("/api/admin/linkedin/oauth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conexaoId }),
      });
      const d = await r.json();
      if (r.ok && d.authUrl) {
        window.location.href = d.authUrl;
      } else {
        alert(d.error ?? "Falha ao iniciar OAuth do LinkedIn");
      }
    } catch {
      alert("Falha ao iniciar OAuth do LinkedIn");
    }
  }

  async function addLinkedinConexao() {
    const nome = window.prompt("Nome da conexão LinkedIn (ex: LinkedIn Inout):");
    if (!nome || !nome.trim()) return;
    try {
      const r = await fetch("/api/admin/conexoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nome.trim(), plataforma: "LINKEDIN", ativo: true }),
      });
      const d = await r.json();
      if (!r.ok) {
        alert(d.error ?? "Erro ao criar conexão");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["admin-conexoes-mini"] });
      if (d.id && window.confirm("Conexão criada! Deseja autorizar no LinkedIn agora?")) {
        await startLinkedinOauth(d.id);
      }
    } catch {
      alert("Erro ao criar conexão");
    }
  }

  const mutation = useMutation({
    mutationFn: (body: Record<string, string | undefined>) =>
      updateIntegrationsConfigApi(body),
    onSuccess: () => {
      setFormError("");
      setFormSuccess("Configurações atualizadas com sucesso.");
      setMetaAccessToken("");
      setGoogleClientId("");
      setGoogleClientSecret("");
      setGoogleDeveloperToken("");
      setGoogleRefreshToken("");
      queryClient.invalidateQueries({ queryKey: ["admin", "config", "integracoes"] });
    },
    onError: (e: Error) => {
      setFormError(e.message);
      setFormSuccess("");
    },
  });

  const alertMutation = useMutation({
    mutationFn: (body: Record<string, string | undefined>) =>
      updateIntegrationsConfigApi(body),
    onSuccess: () => {
      setAlertFormError("");
      setAlertFormSuccess("Notificações salvas com sucesso.");
      setAlertSmtpPass("");
      queryClient.invalidateQueries({ queryKey: ["admin", "config", "integracoes"] });
    },
    onError: (e: Error) => {
      setAlertFormError(e.message);
      setAlertFormSuccess("");
    },
  });

  const telegramMutation = useMutation({
    mutationFn: (body: Record<string, string | undefined>) =>
      updateIntegrationsConfigApi(body),
    onSuccess: () => {
      setTelegramFormError("");
      setTelegramFormSuccess("Telegram salvo com sucesso.");
      setTelegramBotToken("");
      queryClient.invalidateQueries({ queryKey: ["admin", "config", "integracoes"] });
    },
    onError: (e: Error) => {
      setTelegramFormError(e.message);
      setTelegramFormSuccess("");
    },
  });

  const unauthorized = error instanceof Error && error.message === "Unauthorized";

  async function fetchLogs(level: "ALL" | "WARN" | "ERROR" = logsFilter) {
    setLogsLoading(true);
    setLogsError("");
    try {
      const params = level !== "ALL" ? `?level=${level}` : "";
      const res = await fetch(`/api/admin/logs${params}`, { headers: getHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || res.statusText);
      setLogsData(json.logs ?? []);
    } catch (e) {
      setLogsError(e instanceof Error ? e.message : "Erro ao carregar logs.");
    } finally {
      setLogsLoading(false);
    }
  }

  async function clearLogs() {
    if (!confirm("Apagar todos os logs? Esta ação não pode ser desfeita.")) return;
    try {
      await fetch("/api/admin/logs", { method: "DELETE", headers: getHeaders() });
      setLogsData([]);
    } catch {
      // silencioso
    }
  }

  async function handleTestAlert() {
    setTestAlertLoading(true);
    setTestAlertResult(null);
    try {
      const res = await fetch("/api/gestao/alertas", { headers: getHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || res.statusText);
      const msg = `${json.saldosBaixosCount} saldo(s) baixo(s), ${json.anomaliasCount} anomalia(s). Email: ${json.emailEnviado ? "enviado" : "não enviado"}. Webhook: ${json.webhookEnviado ? "enviado" : "não enviado"}.${json.erros?.length ? " Erros: " + json.erros.join("; ") : ""}`;
      setTestAlertResult({ ok: true, message: msg });
    } catch (e) {
      setTestAlertResult({ ok: false, message: e instanceof Error ? e.message : String(e) });
    } finally {
      setTestAlertLoading(false);
    }
  }

  async function handleSaveCredentials() {
    const body: Record<string, string> = {};
    if (metaAccessToken.trim()) body.metaAccessToken = metaAccessToken.trim();
    if (metaAdAccountId.trim()) body.metaAdAccountId = metaAdAccountId.trim();
    if (googleClientId.trim()) body.googleClientId = googleClientId.trim();
    if (googleClientSecret.trim()) body.googleClientSecret = googleClientSecret.trim();
    if (googleDeveloperToken.trim()) body.googleDeveloperToken = googleDeveloperToken.trim();
    if (googleRefreshToken.trim()) body.googleRefreshToken = googleRefreshToken.trim();
    if (googleLoginCustomerId.trim()) body.googleLoginCustomerId = googleLoginCustomerId.trim();
    if (Object.keys(body).length === 0) {
      setFormError("Preencha ao menos um campo para atualizar.");
      setFormSuccess("");
      return;
    }
    setFormError("");
    mutation.mutate(body);
  }

  async function handleSaveAlerts() {
    const body: Record<string, string> = {};
    if (alertNotificationEmail.trim()) body.alertNotificationEmail = alertNotificationEmail.trim();
    if (alertWebhookUrl.trim()) body.alertWebhookUrl = alertWebhookUrl.trim();
    if (alertSmtpHost.trim()) body.alertSmtpHost = alertSmtpHost.trim();
    if (alertSmtpPort.trim()) body.alertSmtpPort = alertSmtpPort.trim();
    if (alertSmtpUser.trim()) body.alertSmtpUser = alertSmtpUser.trim();
    if (alertSmtpPass.trim()) body.alertSmtpPass = alertSmtpPass.trim();
    if (alertSmtpFrom.trim()) body.alertSmtpFrom = alertSmtpFrom.trim();
    if (alertBalanceThresholdDays.trim()) body.alertBalanceThresholdDays = alertBalanceThresholdDays.trim();
    if (alertSpendGapDays.trim()) body.alertSpendGapDays = alertSpendGapDays.trim();
    if (Object.keys(body).length === 0) {
      setAlertFormError("Preencha ao menos um campo para atualizar.");
      return;
    }
    setAlertFormError("");
    alertMutation.mutate(body);
  }

  async function handleAddBM() {
    setBmError("");
    if (!bmNome.trim()) { setBmError("Informe um nome para identificar esta BM."); return; }
    if (!bmToken.trim()) { setBmError("Token de acesso obrigatório."); return; }
    setBmSaving(true);
    try {
      const res = await fetch("/api/admin/conexoes", {
        method: "POST",
        headers: getHeaders(undefined, true),
        body: JSON.stringify({
          nome: bmNome.trim(),
          plataforma: "META",
          metaAccessToken: bmToken.trim(),
          metaAdAccountId: bmAccountId.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || res.statusText);
      queryClient.invalidateQueries({ queryKey: ["admin-conexoes-mini"] });
      setMetaBMModalOpen(false);
      setBmNome(""); setBmToken(""); setBmAccountId("");
    } catch (e) {
      setBmError(e instanceof Error ? e.message : String(e));
    } finally {
      setBmSaving(false);
    }
  }

  async function handleAddMCC() {
    setMccError("");
    if (!mccNome.trim()) { setMccError("Informe um nome para identificar este MCC."); return; }
    if (!mccClientId.trim() || !mccRefreshToken.trim()) {
      setMccError("Client ID e Refresh Token são obrigatórios.");
      return;
    }
    setMccSaving(true);
    try {
      const res = await fetch("/api/admin/conexoes", {
        method: "POST",
        headers: getHeaders(undefined, true),
        body: JSON.stringify({
          nome: mccNome.trim(),
          plataforma: "GOOGLE_ADS",
          googleClientId: mccClientId.trim(),
          googleClientSecret: mccClientSecret.trim() || undefined,
          googleDeveloperToken: mccDeveloperToken.trim() || undefined,
          googleRefreshToken: mccRefreshToken.trim(),
          googleLoginCustomerId: mccLoginCustomerId.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || res.statusText);
      queryClient.invalidateQueries({ queryKey: ["admin-conexoes-mini"] });
      setGoogleMCCModalOpen(false);
      setMccNome(""); setMccClientId(""); setMccClientSecret(""); setMccDeveloperToken(""); setMccRefreshToken(""); setMccLoginCustomerId("");
    } catch (e) {
      setMccError(e instanceof Error ? e.message : String(e));
    } finally {
      setMccSaving(false);
    }
  }

  if (unauthorized) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-[var(--muted-foreground)]">Sua sessão não possui acesso administrativo.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1320px] space-y-7 pb-16">
      <section className="relative overflow-hidden rounded-[28px] border border-[var(--border)] bg-[linear-gradient(120deg,var(--card),rgba(255,106,0,0.07))] p-6 shadow-sm sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[var(--primary)]/10 blur-3xl" />
        <div className="relative flex items-start justify-between gap-6 flex-wrap">
          <div className="max-w-2xl space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">
              <LockKeyhole className="h-4 w-4" />
              Central de controle
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[var(--foreground)] sm:text-4xl">
              Configurações
            </h1>
            <p className="max-w-xl text-sm leading-6 text-[var(--muted-foreground)]">
              Veja rapidamente o que está conectado, resolva pendências e mantenha o InPilot pronto para operar.
              Os detalhes técnicos aparecem apenas quando você precisar deles.
            </p>
          </div>
        <button
          onClick={() => { setLogsModalOpen(true); fetchLogs("ALL"); setLogsFilter("ALL"); }}
          className="flex shrink-0 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)]/90 px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--primary)]/40"
        >
          <ScrollText className="h-4 w-4 text-[var(--muted-foreground)]" />
          Logs do sistema
        </button>
        </div>
        <p className="relative mt-7 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          Plataformas e canais
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-2" aria-label="Outras configurações">
        <Link
          href="/admin/usuarios"
          className="group flex items-start gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 transition-all hover:-translate-y-0.5 hover:border-[var(--primary)]/50 hover:bg-[var(--primary)]/5"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
            <UsersRound className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-[var(--foreground)]">Usuários internos</span>
            <span className="mt-1 block text-xs leading-5 text-[var(--muted-foreground)]">Crie acessos, escolha permissões e desative contas sem apagar o histórico.</span>
          </span>
          <ChevronRight className="ml-auto mt-1 h-5 w-5 text-[var(--muted-foreground)] transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link
          href="/admin/inpilot-usage"
          className="group flex items-start gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 transition-all hover:-translate-y-0.5 hover:border-[var(--primary)]/50 hover:bg-[var(--primary)]/5"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
            <BarChart3 className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-[var(--foreground)]">Uso e acesso do InPilot</span>
            <span className="mt-1 block text-xs leading-5 text-[var(--muted-foreground)]">Escolha usuários e clientes autorizados e acompanhe o consumo da ferramenta.</span>
          </span>
          <ChevronRight className="ml-auto mt-1 h-5 w-5 text-[var(--muted-foreground)] transition-transform group-hover:translate-x-0.5" />
        </Link>
      </section>

      {formError && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/5 px-5 py-3 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
          <span className="text-red-400">{formError}</span>
        </div>
      )}
      {formSuccess && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-5 py-3 text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span className="text-emerald-400">{formSuccess}</span>
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        {[
          { key: "meta" as const, label: "Meta Ads", description: "Conecta contas Meta para acompanhar campanhas e resultados.", ok: metaReady, tone: "blue", action: metaReady ? "Gerenciar Meta Ads" : "Configurar Meta Ads" },
          { key: "google" as const, label: "Google Ads", description: "Importa dados do Google Ads para os clientes e relatórios.", ok: googleReady, tone: "emerald", action: googleReady ? "Gerenciar Google Ads" : "Configurar Google Ads" },
          { key: "linkedin" as const, label: "LinkedIn", description: "Autoriza o acesso às páginas e campanhas do LinkedIn Ads.", ok: linkedinReady, tone: "sky", action: linkedinReady ? "Gerenciar LinkedIn" : "Conectar LinkedIn" },
          { key: "alertas" as const, label: "Alertas", description: "Avisa sobre saldo baixo e mudanças fora do esperado.", ok: alertReady, tone: "amber", action: alertReady ? "Gerenciar alertas" : "Configurar alertas" },
          { key: "telegram" as const, label: "Telegram", description: "Envia o resumo diário dos clientes para um canal interno.", ok: telegramReady, tone: "cyan", action: telegramReady ? "Gerenciar Telegram" : "Configurar Telegram" },
        ].map((item) => (
          <Card key={item.key} className="rounded-[24px] border-[var(--border)] bg-[var(--card)]/90 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--primary)]/40">
            <CardContent className="flex min-h-[190px] flex-col justify-between gap-5 p-6">
              <div className="flex items-start gap-4">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${item.tone === "blue" ? "bg-blue-500/10 text-blue-400" : item.tone === "emerald" ? "bg-emerald-500/10 text-emerald-400" : item.tone === "sky" ? "bg-sky-500/10 text-sky-400" : item.tone === "amber" ? "bg-amber-500/10 text-amber-400" : "bg-cyan-500/10 text-cyan-400"}`}>
                  {item.key === "alertas" ? <Bell className="h-5 w-5" /> : item.key === "telegram" ? <Send className="h-5 w-5" /> : item.key === "google" ? <BarChart3 className="h-5 w-5" /> : item.key === "linkedin" ? <UsersRound className="h-5 w-5" /> : <KeyRound className="h-5 w-5" />}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-bold text-[var(--foreground)]">{item.label}</h2>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${item.ok ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
                      {item.ok ? <CircleCheck className="h-3 w-3" /> : <CircleAlert className="h-3 w-3" />}
                      {isLoading ? "Verificando" : item.ok ? "Pronto" : "Precisa configurar"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-5 text-[var(--muted-foreground)]">{item.description}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (item.key === "alertas") {
                    setAlertFormError("");
                    setAlertFormSuccess("");
                    setAlertModalOpen(true);
                    return;
                  }
                  setPlatformModal(item.key);
                }}
                className="flex w-full items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--background)]/50 px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--primary)]/50 hover:bg-[var(--primary)]/5"
              >
                {item.action}<ChevronRight className="h-4 w-4 text-[var(--muted-foreground)]" />
              </button>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* ── Meta Ads ── */}
      {platformModal === "meta" && <Modal title="Configurar Meta Ads" onClose={() => setPlatformModal(null)} wide>
      <Card id="meta-ads" className="border-0 bg-transparent shadow-none">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-400">Meta</span>
                Meta Ads
              </CardTitle>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Credenciais globais padrão. Clientes sem BM vinculada usam este token.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <InputField
              label="Token de acesso (Meta)"
              type="password"
              value={metaAccessToken}
              onChange={setMetaAccessToken}
              placeholder={data?.hasMetaAccessToken ? "••••••••••••••••••••" : "Cole o token de acesso"}
              hint="Por segurança, o valor atual não é exibido. Preencha apenas se quiser atualizar."
            />
            <InputField
              label="ID da conta padrão (Meta Ads)"
              value={metaAdAccountId}
              onChange={setMetaAdAccountId}
              placeholder={data?.metaAdAccountId || "act_123456789012345"}
            />
          </div>

          {/* BMs conectadas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Business Managers (BMs) conectadas
              </p>
              <button
                onClick={() => { setBmNome(""); setBmToken(""); setBmAccountId(""); setBmError(""); setMetaBMModalOpen(true); }}
                className="flex items-center gap-1 rounded-lg bg-[var(--primary)]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--primary)] hover:bg-[var(--primary)]/20 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Adicionar BM
              </button>
            </div>
            {metaBMs.length === 0 ? (
              <div className="flex items-center gap-2 rounded-xl border border-dashed border-[var(--border)] px-4 py-3">
                <Wifi className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]/40" />
                <p className="text-xs text-[var(--muted-foreground)]">
                  Nenhuma BM cadastrada — usando credenciais globais acima.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)]">
                {metaBMs.map((bm) => {
                  const ok = bm.hasMetaAccessToken;
                  return (
                    <div key={bm.id} className="flex items-center gap-3 bg-[var(--card)] px-4 py-3">
                      <StatusDot ok={ok} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[var(--foreground)]">{bm.nome}</p>
                        <p className="text-[11px] text-[var(--muted-foreground)]">
                          {ok ? "Conectada" : "Token ausente"}
                          {bm.contasCount > 0 && (
                            <> · {bm.contasCount} conta{bm.contasCount !== 1 ? "s" : ""}</>
                          )}
                          {!bm.ativo && <> · <span className="text-amber-500">Inativa</span></>}
                        </p>
                      </div>
                      <a
                        href="/admin/conexoes"
                        className="shrink-0 rounded-lg border border-[var(--border)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-white/5 transition-colors"
                      >
                        Editar
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex justify-end pt-1">
            <button
              disabled={mutation.isPending || isLoading}
              onClick={handleSaveCredentials}
              className="rounded-xl bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:opacity-90 disabled:opacity-50"
            >
              {mutation.isPending ? "Salvando..." : "Salvar credenciais"}
            </button>
          </div>
        </CardContent>
      </Card>
      </Modal>}

      {/* ── Google Ads ── */}
      {platformModal === "google" && <Modal title="Configurar Google Ads" onClose={() => setPlatformModal(null)} wide>
      <Card id="google-ads" className="border-0 bg-transparent shadow-none">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-500">Google</span>
                Google Ads
              </CardTitle>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Credenciais OAuth globais. Clientes sem MCC vinculado usam estas credenciais.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <InputField
              label="Client ID"
              type="password"
              value={googleClientId}
              onChange={setGoogleClientId}
              placeholder={data?.hasGoogleClientId ? "••••••••••••••••••••" : "Client ID OAuth"}
              hint="Por segurança, o valor atual não é exibido. Preencha apenas se quiser atualizar."
            />
            <InputField
              label="Client Secret"
              type="password"
              value={googleClientSecret}
              onChange={setGoogleClientSecret}
              placeholder={data?.hasGoogleClientSecret ? "••••••••••••••••••••" : "Client Secret OAuth"}
              hint="Por segurança, o valor atual não é exibido. Preencha apenas se quiser atualizar."
            />
            <InputField
              label="Developer token"
              type="password"
              value={googleDeveloperToken}
              onChange={setGoogleDeveloperToken}
              placeholder={data?.hasGoogleDeveloperToken ? "••••••••••••••••••••" : "Developer token"}
              hint="Por segurança, o valor atual não é exibido. Preencha apenas se quiser atualizar."
            />
            <InputField
              label="Refresh token"
              type="password"
              value={googleRefreshToken}
              onChange={setGoogleRefreshToken}
              placeholder={data?.hasGoogleRefreshToken ? "••••••••••••••••••••" : "Refresh token OAuth"}
              hint="Por segurança, o valor atual não é exibido. Preencha apenas se quiser atualizar."
            />
            <div className="sm:col-span-2">
              <InputField
                label="Login Customer ID (MCC global)"
                value={googleLoginCustomerId}
                onChange={setGoogleLoginCustomerId}
                placeholder={data?.googleLoginCustomerId || "Ex: 3830547260"}
                hint={`ID da conta MCC gerenciadora padrão.${data?.googleLoginCustomerId ? ` Atual: ${data.googleLoginCustomerId}` : ""}`}
              />
            </div>
          </div>

          {/* MCCs conectados */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                MCCs (gerenciadoras) conectados
              </p>
              <button
                onClick={() => { setMccNome(""); setMccClientId(""); setMccClientSecret(""); setMccDeveloperToken(""); setMccRefreshToken(""); setMccLoginCustomerId(""); setMccError(""); setGoogleMCCModalOpen(true); }}
                className="flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-500 hover:bg-emerald-500/20 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Adicionar MCC
              </button>
            </div>
            {googleMCCs.length === 0 ? (
              <div className="flex items-center gap-2 rounded-xl border border-dashed border-[var(--border)] px-4 py-3">
                <Wifi className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]/40" />
                <p className="text-xs text-[var(--muted-foreground)]">
                  Nenhum MCC cadastrado — usando credenciais globais acima.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)]">
                {googleMCCs.map((mcc) => {
                  const ok = mcc.hasGoogleClientId && mcc.hasGoogleRefreshToken;
                  return (
                    <div key={mcc.id} className="flex items-center gap-3 bg-[var(--card)] px-4 py-3">
                      <StatusDot ok={ok} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[var(--foreground)]">{mcc.nome}</p>
                        <p className="text-[11px] text-[var(--muted-foreground)]">
                          {ok ? "Conectado" : "Credenciais incompletas"}
                          {mcc.googleLoginCustomerId && <> · MCC {mcc.googleLoginCustomerId}</>}
                          {mcc.contasCount > 0 && (
                            <> · {mcc.contasCount} conta{mcc.contasCount !== 1 ? "s" : ""}</>
                          )}
                          {!mcc.ativo && <> · <span className="text-amber-500">Inativo</span></>}
                        </p>
                      </div>
                      <a
                        href="/admin/conexoes"
                        className="shrink-0 rounded-lg border border-[var(--border)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-white/5 transition-colors"
                      >
                        Editar
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex justify-end pt-1">
            <button
              disabled={mutation.isPending || isLoading}
              onClick={handleSaveCredentials}
              className="rounded-xl bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:opacity-90 disabled:opacity-50"
            >
              {mutation.isPending ? "Salvando..." : "Salvar credenciais"}
            </button>
          </div>
        </CardContent>
      </Card>
      </Modal>}

      {/* ── LinkedIn Ads ── */}
      {platformModal === "linkedin" && <Modal title="Configurar LinkedIn" onClose={() => setPlatformModal(null)} wide>
      <Card id="linkedin-ads" className="border-0 bg-transparent shadow-none">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-500">LinkedIn</span>
                LinkedIn Ads
              </CardTitle>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Conexões autorizadas via OAuth do LinkedIn. Cada cliente com LinkedIn Ads é vinculado a uma conexão.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Conexões LinkedIn
              </p>
              <button
                onClick={addLinkedinConexao}
                className="flex items-center gap-1 rounded-lg bg-sky-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-sky-500 hover:bg-sky-500/20 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Adicionar conexão
              </button>
            </div>
            {linkedinConns.length === 0 ? (
              <div className="flex items-center gap-2 rounded-xl border border-dashed border-[var(--border)] px-4 py-3">
                <Wifi className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]/40" />
                <p className="text-xs text-[var(--muted-foreground)]">
                  Nenhuma conexão LinkedIn cadastrada — clique em &quot;Adicionar conexão&quot; e autorize via OAuth.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)]">
                {linkedinConns.map((c) => {
                  const ok = !!c.hasLinkedinAccessToken;
                  return (
                    <div key={c.id} className="flex items-center gap-3 bg-[var(--card)] px-4 py-3">
                      <StatusDot ok={ok} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[var(--foreground)]">{c.nome}</p>
                        <p className="text-[11px] text-[var(--muted-foreground)]">
                          {ok ? "Conectada" : "Aguardando autorização OAuth"}
                          {c.contasCount > 0 && (
                            <> · {c.contasCount} conta{c.contasCount !== 1 ? "s" : ""}</>
                          )}
                          {!c.ativo && <> · <span className="text-amber-500">Inativa</span></>}
                        </p>
                      </div>
                      <button
                        onClick={() => startLinkedinOauth(c.id)}
                        className="shrink-0 rounded-lg border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-[11px] font-medium text-sky-600 hover:bg-sky-500/20 transition-colors"
                      >
                        {ok ? "Reconectar" : "Conectar LinkedIn"}
                      </button>
                      <a
                        href="/admin/conexoes"
                        className="shrink-0 rounded-lg border border-[var(--border)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-white/5 transition-colors"
                      >
                        Editar
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      </Modal>}

      {/* ── Telegram ── */}
      {platformModal === "telegram" && <Modal title="Configurar Telegram" onClose={() => setPlatformModal(null)} wide>
      <Card id="telegram" className="border-0 bg-transparent shadow-none">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-400">Telegram</span>
            Resumo diário no Telegram
          </CardTitle>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Após o sync diário das 05:00 BRT, envia automaticamente um resumo de cada cliente com Telegram ativo para o canal configurado.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <InputField
              label="Bot Token"
              type="password"
              value={telegramBotToken}
              onChange={setTelegramBotToken}
              placeholder={data?.hasTelegramBotToken ? "••••••••••••••••••••" : "1234567890:AAH..."}
              hint="Token do bot criado via @BotFather. Por segurança, o valor atual não é exibido."
            />
            <InputField
              label="Channel ID"
              value={telegramChannelId}
              onChange={setTelegramChannelId}
              placeholder={data?.telegramChannelId || "@meucanal ou -100123456789"}
              hint={`ID ou @username do canal. Atual: ${data?.telegramChannelId || "(não configurado)"}`}
            />
          </div>

          <details className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Como configurar o bot (passo a passo)
            </summary>
            <div className="mt-3 space-y-4 text-xs text-[var(--muted-foreground)]">
              <div>
                <p className="mb-1.5 font-semibold text-[var(--foreground)]">1. Criar o bot</p>
                <ol className="space-y-1 list-decimal pl-4">
                  <li>Abra o Telegram e fale com <strong>@BotFather</strong>.</li>
                  <li>Envie <code>/newbot</code>, escolha um nome e um username (ex: <code>InoutResumos_bot</code>).</li>
                  <li>Copie o <strong>Bot Token</strong> gerado (formato <code>123456789:AAH...</code>) e cole no campo acima.</li>
                </ol>
              </div>
              <div>
                <p className="mb-1.5 font-semibold text-[var(--foreground)]">2. Preparar o canal e descobrir o Channel ID</p>
                <ol className="space-y-1 list-decimal pl-4">
                  <li>Crie um canal no Telegram (pode ser privado) ou use um existente.</li>
                  <li>Adicione o bot ao canal como <strong>Administrador</strong> (permissão de "Enviar Mensagens" é suficiente).</li>
                  <li>
                    Para descobrir o Channel ID numérico: encaminhe qualquer mensagem do canal para o bot{" "}
                    <strong>@userinfobot</strong> — ele retorna o ID no formato <code>-100XXXXXXXXX</code>.
                    Canais públicos podem usar diretamente o username: <code>@meucanal</code>.
                  </li>
                  <li>Cole o ID ou @username no campo <strong>Channel ID</strong> acima.</li>
                </ol>
              </div>
              <div>
                <p className="mb-1.5 font-semibold text-[var(--foreground)]">3. Salvar e testar</p>
                <ol className="space-y-1 list-decimal pl-4">
                  <li>Clique em <strong>Salvar Telegram</strong>.</li>
                  <li>Em <strong>Admin → Clientes</strong>, ative <em>"Resumo diário no Telegram"</em> para cada cliente desejado.</li>
                  <li>Use o botão <strong>Testar Telegram</strong> ao lado de cada cliente para confirmar que a mensagem chegou no canal corretamente.</li>
                </ol>
              </div>
            </div>
          </details>

          {telegramFormError && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-xs text-red-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {telegramFormError}
            </div>
          )}
          {telegramFormSuccess && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              {telegramFormSuccess}
            </div>
          )}

          {telegramTestResult && (
            <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-xs ${telegramTestResult.ok ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400" : "border-red-500/30 bg-red-500/5 text-red-400"}`}>
              {telegramTestResult.ok ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
              {telegramTestResult.msg}
            </div>
          )}

          {telegramSendAllResult && (
            <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-xs ${telegramSendAllResult.ok ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400" : "border-red-500/30 bg-red-500/5 text-red-400"}`}>
              {telegramSendAllResult.ok ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
              {telegramSendAllResult.msg}
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              disabled={telegramTestLoading}
              onClick={async () => {
                setTelegramTestLoading(true);
                setTelegramTestResult(null);
                try {
                  const res = await fetch("/api/admin/telegram-test", { method: "POST", headers: getHeaders() });
                  const json = await res.json();
                  if (json.ok) {
                    setTelegramTestResult({ ok: true, msg: "Mensagem de teste enviada com sucesso! Verifique o canal." });
                  } else {
                    setTelegramTestResult({ ok: false, msg: json.error ?? "Erro desconhecido" });
                  }
                } catch {
                  setTelegramTestResult({ ok: false, msg: "Erro ao chamar o endpoint de teste." });
                } finally {
                  setTelegramTestLoading(false);
                }
              }}
              className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:opacity-80 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {telegramTestLoading ? "Enviando..." : "Enviar mensagem de teste"}
            </button>
            <button
              disabled={telegramSendAllLoading}
              onClick={async () => {
                setTelegramSendAllLoading(true);
                setTelegramSendAllResult(null);
                try {
                  const res = await fetch("/api/admin/telegram-send-all", { method: "POST", headers: getHeaders() });
                  const json = await res.json();
                  if (!res.ok) {
                    setTelegramSendAllResult({ ok: false, msg: json.error ?? "Erro desconhecido" });
                  } else if (json.sent === 0 && json.errors === 0) {
                    setTelegramSendAllResult({ ok: true, msg: json.message ?? "Nenhum cliente ativo para envio." });
                  } else {
                    setTelegramSendAllResult({
                      ok: json.errors === 0,
                      msg: `${json.sent} relatório(s) enviado(s)${json.errors > 0 ? `, ${json.errors} com erro` : ""}.`,
                    });
                  }
                } catch {
                  setTelegramSendAllResult({ ok: false, msg: "Erro ao chamar o endpoint de envio." });
                } finally {
                  setTelegramSendAllLoading(false);
                }
              }}
              className="flex items-center gap-2 rounded-xl border border-sky-500/50 bg-sky-500/10 px-5 py-2.5 text-sm font-semibold text-sky-400 transition hover:opacity-80 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {telegramSendAllLoading ? "Enviando relatórios..." : "Enviar todos os relatórios agora"}
            </button>
            <button
              disabled={telegramMutation.isPending}
              onClick={() => {
                const body: Record<string, string> = {};
                if (telegramBotToken.trim()) body.telegramBotToken = telegramBotToken.trim();
                if (telegramChannelId.trim()) body.telegramChannelId = telegramChannelId.trim();
                if (Object.keys(body).length === 0) {
                  setTelegramFormError("Preencha ao menos um campo para salvar.");
                  return;
                }
                setTelegramFormError("");
                telegramMutation.mutate(body);
              }}
              className="flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {telegramMutation.isPending ? "Salvando..." : "Salvar Telegram"}
            </button>
          </div>
        </CardContent>
      </Card>
      </Modal>}

      {/* ── Status do sync global (sempre visível) ── */}
      <section className="space-y-2">
        <h2 className="text-base font-bold tracking-tight text-[var(--foreground)]">Status do sync global</h2>
        <div className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          {(() => {
            const successAt = data?.globalSyncSuccessAt ? new Date(data.globalSyncSuccessAt) : null;
            const fresh = !!successAt && Date.now() - successAt.getTime() <= 25 * 60 * 60 * 1000;
            return (
              <div className="flex items-center gap-3 px-4 py-3">
                <StatusDot ok={fresh} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--foreground)]">Último sync bem-sucedido</p>
                  <p className="text-[11px] text-[var(--muted-foreground)]">
                    {successAt
                      ? `${successAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}${fresh ? " (recente)" : " (mais de 25h atrás)"}`
                      : "Nunca executado — abra o painel admin ou configure o Scheduled Deployment"}
                  </p>
                </div>
              </div>
            );
          })()}
          {data?.globalSyncAttemptAt && (
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--foreground)]">Última tentativa</p>
                <p className="text-[11px] text-[var(--muted-foreground)]">
                  {new Date(data.globalSyncAttemptAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Modal: Adicionar BM Meta ── */}
      {metaBMModalOpen && (
        <Modal title="Adicionar Business Manager (Meta)" onClose={() => setMetaBMModalOpen(false)}>
          <div className="space-y-4">
            <InputField
              label="Nome (identificação interna)"
              value={bmNome}
              onChange={setBmNome}
              placeholder="Ex: BM Principal, BM Cliente X"
              hint="Nome para controle interno. Não afeta a integração."
            />
            <InputField
              label="Token de acesso Meta"
              type="password"
              value={bmToken}
              onChange={setBmToken}
              placeholder="EAAxxxxx..."
            />
            <InputField
              label="ID da conta de anúncios (opcional)"
              value={bmAccountId}
              onChange={setBmAccountId}
              placeholder="act_123456789012345"
              hint="Se esta BM tiver uma conta padrão diferente da global."
            />
            {bmError && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-xs text-red-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {bmError}
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setMetaBMModalOpen(false)}
                className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                disabled={bmSaving}
                onClick={handleAddBM}
                className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:opacity-90 disabled:opacity-50"
              >
                {bmSaving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                {bmSaving ? "Salvando..." : "Adicionar BM"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal: Adicionar MCC Google Ads ── */}
      {googleMCCModalOpen && (
        <Modal title="Adicionar MCC (Google Ads)" onClose={() => setGoogleMCCModalOpen(false)}>
          <div className="space-y-4">
            <InputField
              label="Nome (identificação interna)"
              value={mccNome}
              onChange={setMccNome}
              placeholder="Ex: MCC Agência, MCC Cliente Y"
              hint="Nome para controle interno. Não afeta a integração."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <InputField
                label="Client ID"
                type="password"
                value={mccClientId}
                onChange={setMccClientId}
                placeholder="xxxxx.apps.googleusercontent.com"
              />
              <InputField
                label="Client Secret"
                type="password"
                value={mccClientSecret}
                onChange={setMccClientSecret}
                placeholder="GOCSPX-..."
              />
            </div>
            <InputField
              label="Developer token"
              type="password"
              value={mccDeveloperToken}
              onChange={setMccDeveloperToken}
              placeholder="Developer token do Google Ads"
            />
            <InputField
              label="Refresh token"
              type="password"
              value={mccRefreshToken}
              onChange={setMccRefreshToken}
              placeholder="1//0g..."
            />
            <InputField
              label="Login Customer ID (MCC)"
              value={mccLoginCustomerId}
              onChange={setMccLoginCustomerId}
              placeholder="Ex: 3830547260"
              hint="ID numérico da conta gerenciadora (sem traços)."
            />
            {mccError && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-xs text-red-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {mccError}
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setGoogleMCCModalOpen(false)}
                className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                disabled={mccSaving}
                onClick={handleAddMCC}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {mccSaving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                {mccSaving ? "Salvando..." : "Adicionar MCC"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal: Configurar alertas ── */}
      {alertModalOpen && (
        <Modal title="Configurar alertas automáticos" onClose={() => setAlertModalOpen(false)}>
          <div className="space-y-5">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Destino das notificações</p>
              <InputField
                label="E-mail de notificação"
                type="email"
                value={alertNotificationEmail}
                onChange={setAlertNotificationEmail}
                placeholder={data?.alertNotificationEmail || "equipe@empresa.com.br"}
                hint={data?.alertNotificationEmail ? `Atual: ${data.alertNotificationEmail}` : undefined}
              />
              <InputField
                label="URL do webhook"
                type="url"
                value={alertWebhookUrl}
                onChange={setAlertWebhookUrl}
                placeholder={data?.alertWebhookUrl || "https://hooks.slack.com/services/..."}
                hint="Compatível com Slack, Google Chat, Discord e qualquer serviço que aceite JSON."
              />
            </div>

            <div className="space-y-4 border-t border-[var(--border)] pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Configuração SMTP (e-mail)</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <InputField
                  label="Host SMTP"
                  value={alertSmtpHost}
                  onChange={setAlertSmtpHost}
                  placeholder={data?.alertSmtpHost || "smtp.gmail.com"}
                />
                <InputField
                  label="Porta"
                  value={alertSmtpPort}
                  onChange={setAlertSmtpPort}
                  placeholder={data?.alertSmtpPort || "587"}
                />
              </div>
              <InputField
                label="Usuário SMTP"
                value={alertSmtpUser}
                onChange={setAlertSmtpUser}
                placeholder={data?.alertSmtpUser || "remetente@empresa.com.br"}
              />
              <InputField
                label="Senha SMTP"
                type="password"
                value={alertSmtpPass}
                onChange={setAlertSmtpPass}
                placeholder={data?.hasAlertSmtpPass ? "••••••••••••••••••••" : "Senha ou app password"}
                hint="Por segurança, o valor atual não é exibido."
              />
              <InputField
                label="E-mail remetente (From)"
                value={alertSmtpFrom}
                onChange={setAlertSmtpFrom}
                placeholder={data?.alertSmtpFrom || "Alertas Inout <alertas@empresa.com.br>"}
              />
            </div>

            <div className="space-y-4 border-t border-[var(--border)] pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Limiares de alerta</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <InputField
                  label="Saldo mínimo (dias restantes)"
                  type="number"
                  value={alertBalanceThresholdDays}
                  onChange={setAlertBalanceThresholdDays}
                  placeholder={data?.alertBalanceThresholdDays || "7"}
                  hint={`Atual: ${data?.alertBalanceThresholdDays || "7"} dias`}
                />
                <InputField
                  label="Gap de gasto (dias sem gasto)"
                  type="number"
                  value={alertSpendGapDays}
                  onChange={setAlertSpendGapDays}
                  placeholder={data?.alertSpendGapDays || "2"}
                  hint={`Atual: ${data?.alertSpendGapDays || "2"} dia(s)`}
                />
              </div>
            </div>

            {alertFormError && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-xs text-red-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {alertFormError}
              </div>
            )}
            {alertFormSuccess && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                {alertFormSuccess}
              </div>
            )}
            {testAlertResult && (
              <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-xs ${testAlertResult.ok ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400" : "border-red-500/30 bg-red-500/5 text-red-400"}`}>
                {testAlertResult.ok
                  ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                {testAlertResult.message}
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--border)] pt-4">
              <button
                disabled={testAlertLoading}
                onClick={handleTestAlert}
                className="flex items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-white/5 disabled:opacity-50"
              >
                {testAlertLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                {testAlertLoading ? "Enviando teste..." : "Testar alertas"}
              </button>
              <button
                onClick={() => setAlertModalOpen(false)}
                className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-white/5 transition-colors"
              >
                Fechar
              </button>
              <button
                disabled={alertMutation.isPending}
                onClick={handleSaveAlerts}
                className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:opacity-90 disabled:opacity-50"
              >
                {alertMutation.isPending && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                {alertMutation.isPending ? "Salvando..." : "Salvar alertas"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal: Logs do sistema ── */}
      {logsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setLogsModalOpen(false)} />
          <div className="relative z-10 flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl" style={{ maxHeight: "90vh" }}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4 shrink-0">
              <div className="flex items-center gap-3">
                <ScrollText className="h-5 w-5 text-[var(--muted-foreground)]" />
                <h3 className="text-base font-bold text-[var(--foreground)]">Logs do sistema</h3>
                <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--muted-foreground)]">
                  últimas 300 entradas · 7 dias
                </span>
              </div>
              <button
                onClick={() => setLogsModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--muted-foreground)] hover:bg-white/5 hover:text-[var(--foreground)] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-6 py-3 shrink-0 flex-wrap">
              <div className="flex items-center gap-2">
                {(["ALL", "ERROR", "WARN"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => { setLogsFilter(f); fetchLogs(f); }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      logsFilter === f
                        ? f === "ERROR"
                          ? "bg-red-500/15 text-red-400 border border-red-500/30"
                          : f === "WARN"
                          ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                          : "bg-[var(--primary)]/15 text-[var(--primary)] border border-[var(--primary)]/30"
                        : "border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {f === "ALL" ? "Todos" : f === "ERROR" ? "Erros" : "Warnings"}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchLogs(logsFilter)}
                  disabled={logsLoading}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${logsLoading ? "animate-spin" : ""}`} />
                  Atualizar
                </button>
                <button
                  onClick={clearLogs}
                  className="flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/5 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Limpar
                </button>
              </div>
            </div>

            {/* Log list */}
            <div className="flex-1 overflow-y-auto font-mono text-xs">
              {logsLoading && (
                <div className="flex items-center justify-center gap-2 py-12 text-[var(--muted-foreground)]">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Carregando…
                </div>
              )}
              {logsError && (
                <div className="flex items-center gap-2 px-6 py-4 text-red-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {logsError}
                </div>
              )}
              {!logsLoading && !logsError && logsData.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-[var(--muted-foreground)]">
                  <ScrollText className="h-8 w-8 opacity-30" />
                  <p>Nenhum log encontrado.</p>
                  <p className="text-[10px]">Os logs aparecem aqui após o próximo sync.</p>
                </div>
              )}
              {!logsLoading && logsData.map((log) => {
                const brt = new Date(log.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
                const levelColor =
                  log.level === "ERROR"
                    ? "text-red-400"
                    : log.level === "WARN"
                    ? "text-amber-400"
                    : "text-sky-400";
                const rowBg =
                  log.level === "ERROR"
                    ? "bg-red-500/5 border-l-2 border-red-500/40"
                    : log.level === "WARN"
                    ? "bg-amber-500/5 border-l-2 border-amber-500/30"
                    : "";
                const ctx = log.context
                  ? Object.entries(log.context as Record<string, unknown>)
                      .filter(([k]) => k !== "plataforma")
                      .map(([k, v]) => `${k}=${String(v)}`)
                      .join(" ")
                  : "";
                return (
                  <div key={log.id} className={`flex gap-3 px-5 py-2 hover:bg-white/[0.02] transition-colors ${rowBg}`}>
                    <span className="shrink-0 text-[var(--muted-foreground)] opacity-60 tabular-nums">{brt}</span>
                    <span className={`shrink-0 w-12 font-bold ${levelColor}`}>{log.level}</span>
                    <span className="flex-1 break-all text-[var(--foreground)] opacity-90">{log.message}</span>
                    {ctx && <span className="shrink-0 text-[var(--muted-foreground)] opacity-50 hidden sm:block">{ctx}</span>}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="border-t border-[var(--border)] px-6 py-3 shrink-0">
              <p className="text-[11px] text-[var(--muted-foreground)]">
                {logsData.length > 0
                  ? `${logsData.length} entrada(s) exibida(s) · ordenadas da mais recente para a mais antiga`
                  : "Nenhuma entrada"}
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
