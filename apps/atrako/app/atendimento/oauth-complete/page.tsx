"use client";

import { OAuthCompleteView } from "@/components/oauth/OAuthCompleteView";
import { useAtendimentoBase } from "@/components/layout/LpHostContext";

export default function AtendimentoOAuthCompletePage() {
  const base = useAtendimentoBase();
  return <OAuthCompleteView hubPath={`${base}/financeiro`} hubLabel="Voltar ao financeiro" />;
}
