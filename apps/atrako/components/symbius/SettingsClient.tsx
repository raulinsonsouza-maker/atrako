"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState, type ReactNode } from "react";
import { Instagram, Plug } from "lucide-react";
import {
  AiSettingsPanel,
  InstagramDmSettings,
  IntegrationsSettingsPanel,
  MembersSettingsPanel,
  TagsSettingsPanel,
} from "@/components/symbius/SettingsPanels";
import { PillSelect } from "@/components/ui/pill-select";

type IgAccount = {
  id: string;
  igUserId: string;
  igUsername: string | null;
  igProfilePictureUrl: string | null;
  status: string;
  messagesEnabled: boolean;
  defaultReplyText?: string | null;
};

type SettingsData = {
  orgName: string;
  email: string;
  plan: string;
  maxIgAccounts: number;
  maxFluxos: number;
  maxMembers: number;
  fluxosCount: number;
  membersCount: number;
  igAccounts: IgAccount[];
};

type NavItem = {
  id: string;
  label: string;
  group: string;
  soon?: boolean;
};

const NAV: NavItem[] = [
  { id: "geral", label: "Geral", group: "Principal" },
  { id: "membros", label: "Membros da Equipe", group: "Principal" },
  { id: "assinatura", label: "Assinaturas", group: "Cobrança" },
  { id: "inbox-behavior", label: "Comportamento da caixa de entrada", group: "Caixa de Entrada" },
  { id: "instagram", label: "Instagram", group: "Canais" },
  { id: "tags", label: "Tags", group: "Automação" },
  { id: "api", label: "API", group: "Extensões" },
  { id: "integracoes", label: "Integrações", group: "Extensões" },
  { id: "ai", label: "IA (em breve)", group: "Extensões", soon: true },
  { id: "notificacoes", label: "Notificações", group: "Em breve", soon: true },
  { id: "tiktok", label: "TikTok", group: "Em breve", soon: true },
  { id: "whatsapp", label: "WhatsApp", group: "Em breve", soon: true },
  { id: "messenger", label: "Messenger", group: "Em breve", soon: true },
  { id: "sms", label: "SMS", group: "Em breve", soon: true },
  { id: "email", label: "E-mail", group: "Em breve", soon: true },
  { id: "telegram", label: "Telegram", group: "Em breve", soon: true },
  { id: "campos", label: "Campos", group: "Em breve", soon: true },
];

function SettingRow({
  title,
  description,
  children,
  warning,
}: {
  title: string;
  description: string;
  children?: ReactNode;
  warning?: string;
}) {
  return (
    <div className="border-b border-[var(--hairline)] py-6 last:border-b-0">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 lg:max-w-xs">
          <h3 className="type-body-strong text-[var(--ink)]">{title}</h3>
        </div>
        <div className="flex flex-wrap gap-2 lg:w-56 lg:justify-start">
          {children}
        </div>
        <p className="flex-1 text-sm leading-relaxed text-[var(--ink-muted-48)] lg:max-w-md">
          {description}
        </p>
      </div>
      {warning && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {warning}
        </div>
      )}
    </div>
  );
}

function Btn({
  children,
  onClick,
  href,
  variant = "outline",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: "outline" | "danger" | "primary";
  disabled?: boolean;
}) {
  const cls =
    variant === "danger"
      ? "border-red-200 text-red-600 hover:bg-red-50"
      : variant === "primary"
        ? "border-transparent bg-[#0084ff] text-white hover:bg-[#0073e6]"
        : "border-zinc-300 text-[var(--ink-muted-80)] hover:bg-[var(--canvas-parchment)]";
  const className = `inline-flex items-center justify-center rounded-lg border px-3 py-1.5 type-caption-strong disabled:opacity-50 ${cls}`;
  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={className}>
      {children}
    </button>
  );
}

function SettingsInner({ data }: { data: SettingsData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = searchParams.get("section") ?? "instagram";
  const [busy, setBusy] = useState(false);
  const account = data.igAccounts[0] ?? null;

  const groups = useMemo(() => {
    const map = new Map<string, NavItem[]>();
    for (const item of NAV) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return Array.from(map.entries());
  }, []);

  function go(id: string) {
    router.push(`/social/settings?section=${id}`);
  }

  async function setStatus(status: "CONNECTED" | "DISABLED") {
    if (!account) return;
    setBusy(true);
    await fetch("/api/symbius/connect/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: account.id, status }),
    });
    setBusy(false);
    router.refresh();
  }

  async function deleteAccount() {
    if (!account) return;
    if (
      !confirm(
        "Excluir a conta Instagram? Automações vinculadas deixam de receber eventos.",
      )
    ) {
      return;
    }
    setBusy(true);
    await fetch(`/api/symbius/connect/account?id=${account.id}`, {
      method: "DELETE",
    });
    setBusy(false);
    router.refresh();
    router.push("/social/connect");
  }

  async function refreshPermissions() {
    if (!account) return;
    setBusy(true);
    await fetch("/api/symbius/connect/refresh-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: account.id }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="symbius-light flex min-h-[calc(100vh)] bg-[#f4f5f7] text-[var(--ink)]">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--hairline)] bg-white lg:flex">
        <div className="border-b border-[var(--hairline)] px-4 py-4">
          <h1 className="type-tagline">Configurações</h1>
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          {groups.map(([group, items]) => (
            <div key={group} className="mb-5">
              <p className="mb-1.5 px-2 type-micro-legal uppercase tracking-wide text-[var(--ink-muted-48)]">
                {group}
              </p>
              <div className="space-y-0.5">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => go(item.id)}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm ${
                      section === item.id
                        ? "bg-[var(--primary-glow)] type-body-strong text-[var(--primary)]"
                        : "text-[var(--ink-muted-48)] hover:bg-[var(--canvas-parchment)]"
                    }`}
                  >
                    <span className="truncate">{item.label}</span>
                    {item.soon && (
                      <span className="ml-2 shrink-0 type-micro-legal text-amber-500">
                        EM BREVE
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="border-b border-[var(--hairline)] bg-white px-4 py-3 lg:hidden">
          <PillSelect
            className="w-full"
            size="field"
            value={section}
            onChange={go}
            options={NAV.map((n) => ({
              value: n.id,
              label: `${n.group}: ${n.label}${n.soon ? " (em breve)" : ""}`,
            }))}
            aria-label="Seção de configurações"
          />
        </div>

        <div className="mx-auto max-w-5xl p-6 md:p-10">
          {section === "geral" && (
            <div className="rounded-2xl border border-[var(--hairline)] bg-white p-6">
              <h2 className="type-tagline">Geral</h2>
              <div className="mt-6 space-y-4 text-sm">
                <div>
                  <p className="text-[var(--ink-muted-48)]">Organização</p>
                  <p className="mt-1 type-body-strong">{data.orgName}</p>
                  <p className="text-[var(--ink-muted-48)]">{data.email}</p>
                </div>
                <div>
                  <p className="text-[var(--ink-muted-48)]">Plano</p>
                  <p className="mt-1 type-tagline">{data.plan}</p>
                </div>
              </div>
            </div>
          )}

          {section === "assinatura" && (
            <div className="rounded-2xl border border-[var(--hairline)] bg-white p-6">
              <h2 className="type-tagline">Assinaturas</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-[var(--hairline)] p-4">
                  <p className="text-xs text-[var(--ink-muted-48)]">Contas IG</p>
                  <p className="mt-1 text-2xl type-body-strong">
                    {data.igAccounts.length}/{data.maxIgAccounts}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--hairline)] p-4">
                  <p className="text-xs text-[var(--ink-muted-48)]">Automações</p>
                  <p className="mt-1 text-2xl type-body-strong">
                    {data.fluxosCount}/
                    {data.maxFluxos >= 999 ? "∞" : data.maxFluxos}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--hairline)] p-4">
                  <p className="text-xs text-[var(--ink-muted-48)]">Membros</p>
                  <p className="mt-1 text-2xl type-body-strong">
                    {data.membersCount}/{data.maxMembers}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm text-[var(--ink-muted-48)]">
                Plano atual: <strong>{data.plan}</strong>. Upgrade e cobrança
                automática em breve.
              </p>
            </div>
          )}

          {section === "inbox-behavior" && (
            <div className="rounded-2xl border border-[var(--hairline)] bg-white p-6">
              <h2 className="type-tagline">
                Comportamento da caixa de entrada
              </h2>
              <SettingRow
                title="Pausar bot ao responder manualmente"
                description="Ativo: quando um humano responde na Inbox, o bot é pausado automaticamente para esse contato."
              >
                <span className="rounded-lg bg-emerald-50 px-3 py-1.5 type-caption-strong text-emerald-700">
                  Ativo
                </span>
              </SettingRow>
              <SettingRow
                title="Atribuição automática"
                description="Round-robin entre membros no handoff — já usado nas automações com nó de handoff."
              >
                <span className="rounded-lg bg-emerald-50 px-3 py-1.5 type-caption-strong text-emerald-700">
                  Ativo no handoff
                </span>
              </SettingRow>
            </div>
          )}

          {section === "api" && (
            <div className="rounded-2xl border border-[var(--hairline)] bg-white p-6 space-y-3">
              <h2 className="type-tagline">API pública</h2>
              <p className="text-sm text-[var(--ink-muted-48)]">
                Use a API key em Integrações com os headers{" "}
                <code className="text-xs">x-api-key</code> e{" "}
                <code className="text-xs">x-organization-id</code>.
              </p>
              <ul className="list-disc pl-5 text-sm text-[var(--ink-muted-80)] space-y-1">
                <li>POST /api/v1/identify</li>
                <li>POST /api/v1/events</li>
                <li>POST /api/v1/purchases</li>
                <li>GET/POST /api/v1/symbius</li>
              </ul>
              <Btn href="/social/settings?section=integracoes" variant="primary">
                Ir para Integrações
              </Btn>
            </div>
          )}

          {section === "membros" && <MembersSettingsPanel />}

          {section === "tags" && <TagsSettingsPanel />}

          {section === "integracoes" && <IntegrationsSettingsPanel />}

          {section === "ai" && <AiSettingsPanel />}

          {section === "tags_old" && (
            <div className="rounded-2xl border border-[var(--hairline)] bg-white p-6">
              <h2 className="type-tagline">Tags</h2>
              <p className="mt-2 text-sm text-[var(--ink-muted-48)]">
                Tags são aplicadas nos contatos pelas automações (nó “Adicionar
                tag”) e aparecem em Contatos. Gestão visual de tags em breve.
              </p>
              <Btn href="/social/contacts">Ver contatos</Btn>
            </div>
          )}

          {section === "instagram" && (
            <div className="rounded-2xl border border-[var(--hairline)] bg-white p-6">
              <div className="mb-6 flex items-center gap-3 border-b border-[var(--divider-soft)] pb-6">
                {account?.igProfilePictureUrl ? (
                  <Image
                    src={account.igProfilePictureUrl}
                    alt=""
                    width={48}
                    height={48}
                    className="rounded-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-100">
                    <Instagram className="h-6 w-6 text-pink-500" />
                  </div>
                )}
                <div>
                  <h2 className="type-tagline">Instagram</h2>
                  <p className="text-sm text-[var(--ink-muted-48)]">
                    {account
                      ? `@${account.igUsername ?? "instagram"} · ${account.status}`
                      : "Nenhuma conta conectada"}
                  </p>
                </div>
                {!account && (
                  <Btn href="/social/connect" variant="primary">
                    Conectar
                  </Btn>
                )}
              </div>

              {!account ? (
                <p className="text-sm text-[var(--ink-muted-48)]">
                  Conecte uma conta Professional para configurar o canal.
                </p>
              ) : (
                <>
                  <InstagramDmSettings
                    accountId={account.id}
                    defaultReply={account.defaultReplyText ?? ""}
                    onSaved={() => router.refresh()}
                  />

                  <SettingRow
                    title="Menu Principal"
                    description='Menu do ícone “hambúrguer” no Direct do Instagram, sempre disponível para navegação no bot.'
                    warning="Em breve — persistent menu via API do Instagram."
                  >
                    <Btn disabled>Editar</Btn>
                  </SettingRow>

                  <SettingRow
                    title="Cumprimente os novos seguidores"
                    description="Quando alguém começar a te seguir, uma mensagem automática será enviada pela API oficial da Meta (só na primeira vez)."
                    warning="Indisponível no momento. Para utilizar, atualize as permissões do Instagram (escopo de follows)."
                  >
                    <Btn disabled>Configurar</Btn>
                    <Btn disabled>Selecionar existente</Btn>
                  </SettingRow>

                  <SettingRow
                    title="Iniciadores de conversa"
                    description="Lista de perguntas frequentes ou tópicos para o usuário iniciar o chat com a empresa."
                    warning="Em breve — ice breakers / conversation starters."
                  >
                    <Btn disabled>Editar</Btn>
                  </SettingRow>

                  <SettingRow
                    title="Automação Opt-in"
                    description='Dispara quando o usuário digita "Começar" ou "Inscrever". Palavras-chave de sistema.'
                  >
                    <Btn href="/social/flows/new">Editar</Btn>
                  </SettingRow>

                  <SettingRow
                    title="Automação Opt-out"
                    description='Dispara quando o usuário digita "Parar" ou "Cancelar Inscrição".'
                  >
                    <Btn href="/social/flows/new">Editar</Btn>
                  </SettingRow>

                  <SettingRow
                    title="Resposta da Menção ao Story"
                    description="Inicie uma automação se alguém mencionar sua conta em um Story."
                  >
                    <Btn href="/social/flows/new">Criar nova resposta</Btn>
                  </SettingRow>

                  <SettingRow
                    title="API de Conversões da Meta"
                    description="Envie eventos de conversão (cliques, leads) para o Gerenciador de Eventos e otimize anúncios. Nenhum PII além do permitido pela Meta."
                    warning="Configure Pixel e CAPI em Integrações para enviar Lead/Purchase."
                  >
                    <Btn disabled>Conectar</Btn>
                  </SettingRow>

                  <SettingRow
                    title="Alterar conexão do Instagram"
                    description="Sua conta está vinculada via Instagram Login. Reconecte para renovar o token e permissões."
                  >
                    <Btn href="/social/connect">Entrar pelo Instagram</Btn>
                  </SettingRow>

                  <SettingRow
                    title="Atualizar Permissões do Instagram"
                    description="Se conteúdo não envia ou a conexão falha, atualize o perfil e as permissões primeiro."
                  >
                    <Btn disabled={busy} onClick={refreshPermissions}>
                      Atualizar Permissões
                    </Btn>
                  </SettingRow>

                  <SettingRow
                    title="Desativar Canal do Instagram"
                    description="Interrompe automações temporariamente, com opção de reativar depois."
                  >
                    {account.status === "DISABLED" ? (
                      <Btn
                        disabled={busy}
                        onClick={() => setStatus("CONNECTED")}
                      >
                        Reativar
                      </Btn>
                    ) : (
                      <Btn
                        disabled={busy}
                        onClick={() => setStatus("DISABLED")}
                      >
                        Desabilitar
                      </Btn>
                    )}
                  </SettingRow>

                  <SettingRow
                    title="Excluir conta do Instagram"
                    description="Remove completamente a conta do Symbius Flow. Você poderá conectar outra depois."
                  >
                    <Btn
                      variant="danger"
                      disabled={busy}
                      onClick={deleteAccount}
                    >
                      Excluir
                    </Btn>
                  </SettingRow>
                </>
              )}
            </div>
          )}

          {[
            "notificacoes",
            "tiktok",
            "whatsapp",
            "messenger",
            "sms",
            "email",
            "telegram",
            "campos",
          ].includes(section) && (
            <div className="rounded-2xl border border-[var(--hairline)] bg-white p-10 text-center">
              <Plug className="mx-auto h-10 w-10 text-zinc-300" />
              <h2 className="mt-4 type-tagline">Em breve</h2>
              <p className="mt-2 text-sm text-[var(--ink-muted-48)]">
                Esta funcionalidade ainda não está disponível. O núcleo
                Instagram + Attribution já está ativo.
              </p>
              <Btn href="/social/settings?section=instagram">
                Ir para Instagram
              </Btn>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export function SettingsClient(props: { data: SettingsData }) {
  return (
    <Suspense
      fallback={
        <div className="p-10 text-[var(--ink-muted-48)]">Carregando configurações…</div>
      }
    >
      <SettingsInner data={props.data} />
    </Suspense>
  );
}
