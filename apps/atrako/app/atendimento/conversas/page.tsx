"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SegmentedControl } from "@/components/ui";
import { InstagramInbox } from "@/components/atendimento/mensagens/InstagramInbox";
import { WhatsAppInbox } from "@/components/whatsapp/WhatsAppInbox";

type Canal = "whatsapp" | "instagram";

function ConversasInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canal: Canal = searchParams.get("canal") === "instagram" ? "instagram" : "whatsapp";

  function setCanal(next: Canal) {
    const q = new URLSearchParams(searchParams.toString());
    if (next === "whatsapp") q.delete("canal");
    else q.set("canal", "instagram");
    const query = q.toString();
    router.replace(query ? `?${query}` : "?", { scroll: false });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-5 pt-4 md:px-6">
        <SegmentedControl
          value={canal}
          onChange={setCanal}
          options={[
            { value: "whatsapp", label: "WhatsApp" },
            { value: "instagram", label: "Instagram" },
          ]}
          aria-label="Canal das conversas"
          className="self-start"
        />
      </div>
      <div className="min-h-0 flex-1">
        {canal === "instagram" ? (
          <InstagramInbox title="Instagram" className="h-full" />
        ) : (
          <WhatsAppInbox title="WhatsApp" className="h-full" connectHref={null} checkoutLink={false} />
        )}
      </div>
    </div>
  );
}

export default function AtendimentoConversasPage() {
  return (
    <Suspense fallback={null}>
      <ConversasInner />
    </Suspense>
  );
}
