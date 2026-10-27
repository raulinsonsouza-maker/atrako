"use client";

import { ChatPhone } from "./phone/ChatPhone";

export type IgStoryScene = "story" | "dm";

export function IgStoryPreview({
  scene,
  onScene,
  username,
  mediaUrl,
  replyText,
  dmText,
  dmButton,
}: {
  scene: IgStoryScene;
  onScene: (scene: IgStoryScene) => void;
  username: string;
  mediaUrl?: string | null;
  replyText: string;
  dmText: string;
  dmButton: string;
}) {
  const handle = username.replace(/^@/, "") || "seu_perfil";
  const tabs: Array<{ id: IgStoryScene; label: string }> = [
    { id: "story", label: "Story" },
    { id: "dm", label: "DM" },
  ];

  const below = (
    <div className="mt-3 flex justify-center gap-1" role="tablist" aria-label="Visualização">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={scene === tab.id}
          onClick={() => onScene(tab.id)}
          className={`rounded-[var(--radius-xs)] px-3 py-1.5 type-fine-print ${
            scene === tab.id
              ? "bg-[var(--canvas)] type-caption-strong text-[var(--ink)]"
              : "text-[var(--ink-muted-48)]"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  if (scene === "story") {
    return (
      <ChatPhone
        theme="instagram"
        header={{ name: handle, subtitle: "Story" }}
        below={below}
        items={[
          {
            kind: "node",
            node: (
              <div className="relative -mx-6 -my-5 min-h-[520px] flex-1 self-stretch overflow-hidden bg-black text-white">
                {mediaUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-[var(--surface-black)]" />
                )}
                <div className="absolute inset-x-0 top-0 h-12 bg-black/40" />
                <p className="absolute left-4 top-3 type-fine-print">{handle}</p>
                <div className="absolute bottom-16 right-4 max-w-[70%] rounded-2xl bg-white/20 px-3 py-2 type-fine-print">
                  {replyText || "…"}
                </div>
                <div className="absolute inset-x-4 bottom-4 rounded-full border border-white/30 px-3 py-2 type-fine-print text-white/70">
                  Enviar mensagem…
                </div>
              </div>
            ),
          },
        ]}
      />
    );
  }

  return (
    <ChatPhone
      theme="instagram"
      header={{ name: handle, subtitle: "Direct" }}
      below={below}
      items={[
        { kind: "sent", text: replyText || "…" },
        ...(dmText.trim()
          ? [
              { kind: "received" as const, text: dmText },
              ...(dmButton.trim() ? [{ kind: "action" as const, label: dmButton.trim(), variant: "link" as const }] : []),
            ]
          : []),
      ]}
    />
  );
}
