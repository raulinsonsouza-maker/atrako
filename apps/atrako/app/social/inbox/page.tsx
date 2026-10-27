"use client";

import { Suspense } from "react";
import { InstagramInbox } from "@/components/atendimento/mensagens/InstagramInbox";

export default function InboxPage() {
  return (
    <Suspense fallback={null}>
      <InstagramInbox title="Instagram" className="h-full" />
    </Suspense>
  );
}
