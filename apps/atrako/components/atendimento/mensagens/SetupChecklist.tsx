"use client";

import { Check, ChevronRight, Loader2 } from "lucide-react";
import { Button, Switch, TextLink } from "@/components/ui";
import { useLpHost } from "@/components/layout/LpHostContext";
import type { Jornada } from "./useJornada";

type Post = { mutate: (body: Record<string, unknown>) => void; isPending: boolean };

function templatesReady(data: Jornada) {
  return data.templates.opening === "approved" || data.templates.opening === "updating";
}

/** Frase curta do estado do robô (ao lado da chave). */
export function robotStatus(data: Jornada): { text: string; tone: "ok" | "warn" | "off" } {
  if (!data.enabled) return { text: "Desligado", tone: "off" };
  if (!data.channels.whatsapp.connected) return { text: "Parado: falta conectar o WhatsApp", tone: "warn" };
  if (!templatesReady(data)) return { text: "Aguardando a Meta aprovar a abertura", tone: "warn" };
  return { text: "Rodando", tone: "ok" };
}

export function RobotSwitch({ data, post, canManage }: { data: Jornada; post: Post; canManage: boolean }) {
  const status = robotStatus(data);
  return (
    <div className="flex items-center gap-3">
      <span className="flex items-center gap-2 type-caption text-[var(--ink-muted-80)]">
        <span className="script-dot" data-tone={status.tone === "off" ? undefined : status.tone} aria-hidden />
        <span className="hidden sm:inline">Robô · </span>
        {status.text}
      </span>
      <Switch
        checked={data.enabled}
        disabled={!canManage || post.isPending}
        onChange={(on) => post.mutate({ action: "toggle", enabled: on })}
        aria-label="Robô de qualificação no WhatsApp"
      />
    </div>
  );
}

/** Passos que faltam para o robô rodar — some quando está tudo pronto. */
export function SetupChecklist({ data, post, canManage }: { data: Jornada; post: Post; canManage: boolean }) {
  const lp = useLpHost();
  const wa = data.channels.whatsapp.connected;
  const tpl = data.templates.opening;
  const steps = [
    {
      key: "wa",
      label: "Conectar o WhatsApp",
      done: wa,
      action: wa ? null : lp ? (
        <span className="type-fine-print text-[var(--ink-muted-48)]">em Conexões</span>
      ) : (
        <TextLink href="/config/conexoes">Conectar</TextLink>
      ),
    },
    {
      key: "tpl",
      label: tpl === "pending" ? "Abertura em análise na Meta" : tpl === "rejected" ? "Abertura reprovada pela Meta" : "Aprovar a abertura na Meta",
      done: templatesReady(data),
      action:
        wa && tpl === "missing" && canManage ? (
          <Button size="toolbar" variant="outline" disabled={post.isPending} onClick={() => post.mutate({ action: "templates" })}>
            {post.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Enviar para aprovação
          </Button>
        ) : null,
    },
    {
      key: "on",
      label: "Ligar o robô",
      done: data.enabled,
      action:
        !data.enabled && canManage ? (
          <Button size="toolbar" disabled={post.isPending} onClick={() => post.mutate({ action: "toggle", enabled: true })}>
            Ligar
          </Button>
        ) : null,
    },
  ];
  if (steps.every((s) => s.done)) return null;

  return (
    <ol className="script-setup" aria-label="Para o robô rodar">
      {steps.map((s, i) => (
        <li key={s.key} className="script-setup-step" data-done={s.done}>
          {i > 0 ? <ChevronRight className="h-3.5 w-3.5 text-[var(--ink-muted-48)]" aria-hidden /> : null}
          <span className="script-setup-mark" data-done={s.done}>
            {s.done ? <Check className="h-3 w-3" strokeWidth={2.5} /> : i + 1}
          </span>
          <span className="type-caption">{s.label}</span>
          {!s.done ? s.action : null}
        </li>
      ))}
    </ol>
  );
}
