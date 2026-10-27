"use client";

import type { ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Instagram, Mail } from "lucide-react";
import { SegmentedControl } from "@/components/ui";
import { AppPage } from "@/components/layout/AppPage";
import { MensagensView } from "./MensagensView";
import { InstagramMensagensView } from "./InstagramMensagensView";
import { EmailMensagensView } from "./EmailMensagensView";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";

type Canal = "whatsapp" | "email" | "instagram";

function WhatsAppMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path strokeLinejoin="round" d="M12 20.5a8.5 8.5 0 1 0-7.4-4.3L3.5 20.5l4.4-1.2A8.5 8.5 0 0 0 12 20.5Z" />
      <path strokeLinejoin="round" d="M9 10.4c.3 2 2.2 3.6 3.8 3.8.3 0 .6-.1.8-.4l.5-.7c.2-.2.4-.3.7-.2l1.4.5c.3.1.5.4.4.7-.3 1.2-1.4 2-2.6 1.8-2.6-.5-5-2.9-5.5-5.5-.2-1.1.5-2.2 1.7-2.4.3-.1.5 0 .7.3l.5 1.3c.1.3 0 .6-.2.8l-.6.6c-.2.2-.2.4 0 .6Z" />
    </svg>
  );
}

const CANAIS: ReadonlyArray<{ value: Canal; label: string; icon: ReactNode }> = [
  { value: "whatsapp", label: "WhatsApp", icon: <WhatsAppMark /> },
  { value: "email", label: "E-mail", icon: <Mail strokeWidth={1.75} /> },
  { value: "instagram", label: "Instagram", icon: <Instagram strokeWidth={1.75} /> },
];

export function AutomacoesView() {
  const { workspaceId } = useActiveWorkspace();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromQuery = searchParams.get("canal");
  const canal: Canal = fromQuery === "instagram" || fromQuery === "email" ? fromQuery : "whatsapp";

  function setCanal(next: Canal) {
    const q = new URLSearchParams(searchParams.toString());
    q.delete("aba");
    q.delete("fluxo");
    q.delete("recipe");
    if (next === "whatsapp") q.delete("canal");
    else q.set("canal", next);
    const query = q.toString();
    router.replace(query ? `?${query}` : "?", { scroll: false });
  }

  if (!workspaceId) {
    return (
      <AppPage title="Mensagens" className="md:pt-5">
        <p className="type-caption text-[var(--ink-muted-48)]">Carregando…</p>
      </AppPage>
    );
  }

  return (
    <AppPage
      className="md:pt-5"
      title="Mensagens"
      actions={
        <SegmentedControl
          value={canal}
          onChange={setCanal}
          options={CANAIS}
          aria-label="Canal de automação"
        />
      }
    >
      {canal === "whatsapp" ? <MensagensView workspaceId={workspaceId} embedded /> : null}
      {canal === "email" ? <EmailMensagensView workspaceId={workspaceId} /> : null}
      {canal === "instagram" ? <InstagramMensagensView workspaceId={workspaceId} /> : null}
    </AppPage>
  );
}
