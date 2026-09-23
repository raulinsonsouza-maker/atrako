"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ImageIcon,
  KeyRound,
  Plus,
  RefreshCw,
  Shield,
  X,
  Wifi,
} from "lucide-react";
import { LogoUploadField } from "@/app/admin/clientes/LogoUploadField";

function getHeaders(token?: string, includeJson = false): HeadersInit {
  const headers: HeadersInit = {};
  if (includeJson) headers["Content-Type"] = "application/json";
  if (token) headers["x-admin-token"] = token;
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

async function fetchBrandingConfig(token?: string) {
  const res = await fetch("/api/admin/config/branding", {
    headers: getHeaders(token),
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) throw new Error("Falha ao carregar logo do painel");
  return res.json() as Promise<{
    panelLogoUrl: string;
    defaultLogoUrl: string;
  }>;
}

async function updateBrandingConfig(panelLogoUrl: string, token?: string) {
  const res = await fetch("/api/admin/config/branding", {
    method: "PATCH",
    headers: getHeaders(token, true),
    body: JSON.stringify({ panelLogoUrl }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText);
  return data;
}

interface ConexaoItem {
  id: string;
  nome: string;
  plataforma: "META" | "GOOGLE_ADS";
  ativo: boolean;
  contasCount: number;
  hasMetaAccessToken: boolean;
  hasGoogleClientId: boolean;
  hasGoogleRefreshToken: boolean;
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
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl">
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
  const [adminToken, setAdminToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");

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
    queryKey: ["admin", "config", "integracoes", adminToken],
    queryFn: () => fetchIntegrationsConfig(adminToken || undefined),
    enabled: !!adminToken,
  });

  const { data: brandingData } = useQuery({
    queryKey: ["admin", "config", "branding", adminToken],
    queryFn: () => fetchBrandingConfig(adminToken || undefined),
    enabled: !!adminToken,
  });

  const brandingMutation = useMutation({
    mutationFn: (panelLogoUrl: string) =>
      updateBrandingConfig(panelLogoUrl, adminToken || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["panel-branding"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "config", "branding"] });
    },
  });

  const { data: conexoes = [] } = useQuery<ConexaoItem[]>({
    queryKey: ["admin-conexoes-mini", adminToken],
    queryFn: async () => {
      const r = await fetch("/api/admin/conexoes", { headers: getHeaders(adminToken) });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!adminToken,
    staleTime: 30_000,
  });

  const metaBMs = conexoes.filter((c) => c.plataforma === "META");
  const googleMCCs = conexoes.filter((c) => c.plataforma === "GOOGLE_ADS");

  const mutation = useMutation({
    mutationFn: (body: Record<string, string | undefined>) =>
      updateIntegrationsConfigApi(body, adminToken || undefined),
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
      updateIntegrationsConfigApi(body, adminToken || undefined),
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

  const unauthorized = error instanceof Error && error.message === "Unauthorized";

  async function handleTestAlert() {
    setTestAlertLoading(true);
    setTestAlertResult(null);
    try {
      const res = await fetch("/api/gestao/alertas", { headers: getHeaders(adminToken || undefined) });
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
        headers: getHeaders(adminToken, true),
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
        headers: getHeaders(adminToken, true),
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

  if (!adminToken || unauthorized) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-sm overflow-hidden rounded-2xl border-[var(--border)]">
          <div className="flex flex-col items-center gap-3 bg-gradient-to-b from-[var(--primary)]/5 to-transparent px-6 pt-8 pb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)]">
              <Shield className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-bold text-[var(--foreground)]">Configurações protegidas</h2>
            <p className="text-center text-xs text-[var(--muted-foreground)]">
              Informe a senha para acessar as configurações de integração.
            </p>
          </div>
          <CardContent className="px-6 pb-6">
            <div className="space-y-4">
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
                <input
                  type="password"
                  placeholder="Senha"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] py-2.5 pl-10 pr-4 text-sm transition-colors focus:border-[var(--primary)]/40 focus:outline-none"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && setAdminToken(tokenInput)}
                />
              </div>
              <button
                className="w-full rounded-xl bg-[var(--primary)] py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:opacity-90"
                onClick={() => setAdminToken(tokenInput)}
              >
                Entrar
              </button>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="space-y-8 pb-12">
      <section className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-[var(--foreground)] sm:text-3xl">
          Configurações de integrações
        </h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Gerencie os tokens de API utilizados para sincronizar dados do Meta Ads e Google Ads.
        </p>
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

      <Card className="rounded-2xl border-[var(--border)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ImageIcon className="h-4 w-4 text-[var(--primary)]" />
            Logo do painel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-[var(--muted-foreground)]">
            Imagem exibida no topo de todas as páginas (exceto portal do cliente). Use PNG, SVG ou WebP com fundo transparente.
          </p>
          <LogoUploadField
            value={brandingData?.panelLogoUrl ?? ""}
            onChange={(url) => brandingMutation.mutate(url)}
            adminToken={adminToken}
          />
          {brandingData?.panelLogoUrl ? (
            <button
              type="button"
              onClick={() => brandingMutation.mutate("")}
              className="text-xs font-semibold text-[var(--muted-foreground)] underline-offset-2 hover:text-[var(--primary)] hover:underline"
            >
              Restaurar logo padrão (Inout)
            </button>
          ) : (
            <p className="text-[11px] text-[var(--muted-foreground)]">
              Nenhum logo personalizado — usando o padrão Inout.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Meta Ads ── */}
      <Card className="rounded-2xl border-[var(--border)]">
        <CardHeader>
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
        </CardContent>
      </Card>

      {/* ── Google Ads ── */}
      <Card className="rounded-2xl border-[var(--border)]">
        <CardHeader>
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
        </CardContent>
      </Card>

      <section className="flex justify-end">
        <button
          disabled={mutation.isPending || isLoading}
          onClick={handleSaveCredentials}
          className="rounded-xl bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:opacity-90 disabled:opacity-50"
        >
          {mutation.isPending ? "Salvando..." : "Salvar credenciais"}
        </button>
      </section>

      {/* ── Alertas automáticos ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-[var(--foreground)]">Alertas automáticos</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              Notificações de saldo baixo e anomalias de gasto.
            </p>
          </div>
          <button
            onClick={() => { setAlertFormError(""); setAlertFormSuccess(""); setAlertModalOpen(true); }}
            className="flex items-center gap-1.5 rounded-xl bg-[var(--primary)]/10 px-3 py-2 text-xs font-semibold text-[var(--primary)] hover:bg-[var(--primary)]/20 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Configurar alertas
          </button>
        </div>

        {/* Status canais configurados */}
        <div className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          {/* Email */}
          <div className="flex items-center gap-3 px-4 py-3">
            <StatusDot ok={!!data?.alertNotificationEmail} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--foreground)]">E-mail</p>
              <p className="text-[11px] text-[var(--muted-foreground)]">
                {data?.alertNotificationEmail
                  ? data.alertNotificationEmail
                  : "Não configurado"}
              </p>
            </div>
          </div>
          {/* Webhook */}
          <div className="flex items-center gap-3 px-4 py-3">
            <StatusDot ok={!!data?.alertWebhookUrl} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--foreground)]">Webhook</p>
              <p className="truncate text-[11px] text-[var(--muted-foreground)]">
                {data?.alertWebhookUrl
                  ? data.alertWebhookUrl.slice(0, 50) + (data.alertWebhookUrl.length > 50 ? "…" : "")
                  : "Não configurado"}
              </p>
            </div>
          </div>
          {/* Limiares */}
          <div className="flex items-center gap-3 px-4 py-3">
            <StatusDot ok={true} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--foreground)]">Limiares</p>
              <p className="text-[11px] text-[var(--muted-foreground)]">
                Saldo mínimo: {data?.alertBalanceThresholdDays || "7"} dias · Gap de gasto: {data?.alertSpendGapDays || "2"} dia(s)
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-col gap-1">
            <p className="text-xs text-[var(--muted-foreground)]">
              Dispare um alerta agora para testar as configurações.
            </p>
            {testAlertResult && (
              <div className={`flex items-start gap-2 text-xs ${testAlertResult.ok ? "text-emerald-400" : "text-red-400"}`}>
                {testAlertResult.ok
                  ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  : <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                {testAlertResult.message}
              </div>
            )}
          </div>
          <button
            disabled={testAlertLoading}
            onClick={handleTestAlert}
            className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white/[0.03] px-5 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white/[0.06] disabled:opacity-40"
          >
            {testAlertLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
            {testAlertLoading ? "Executando..." : "Disparar alerta agora"}
          </button>
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

            <div className="flex justify-end gap-3 border-t border-[var(--border)] pt-4">
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
    </main>
  );
}
