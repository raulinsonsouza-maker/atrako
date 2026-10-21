"use client";

import { OAuthCompleteView } from "@/components/oauth/OAuthCompleteView";

export default function ConexoesOAuthCompletePage() {
  return <OAuthCompleteView hubPath="/config/conexoes" hubLabel="Voltar às conexões" />;
}
