"use client";

import { ChatPhone } from "./phone/ChatPhone";

export type IgPreviewScene = "post" | "comments" | "dm";

export function IgCommentPreview({
  scene,
  onScene,
  username,
  mediaUrl,
  caption,
  commentText,
  welcomeText,
  welcomeButton,
  showWelcome,
}: {
  scene: IgPreviewScene;
  onScene: (scene: IgPreviewScene) => void;
  username: string;
  mediaUrl?: string | null;
  caption?: string;
  commentText: string;
  welcomeText: string;
  welcomeButton: string;
  showWelcome: boolean;
}) {
  const handle = username.replace(/^@/, "") || "seu_perfil";
  const tabs: Array<{ id: IgPreviewScene; label: string }> = [
    { id: "post", label: "Publicar" },
    { id: "comments", label: "Comentários" },
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

  if (scene === "post") {
    return (
      <ChatPhone
        theme="instagram"
        header={{ name: handle, subtitle: "Publicação" }}
        below={below}
        items={[
          {
            kind: "node",
            node: (
              <div className="px-3 pb-4 text-white">
                {mediaUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaUrl} alt="" className="aspect-[4/5] w-full object-cover" />
                ) : (
                  <div className="flex aspect-[4/5] items-center justify-center bg-white/5 type-fine-print text-white/50">
                    Escolha uma publicação
                  </div>
                )}
                <p className="mt-3 type-fine-print leading-snug text-white/90">
                  <span className="type-caption-strong">{handle}</span> {caption || "Sua publicação"}
                </p>
                <p className="mt-2 type-micro-legal text-white/40">Ver todos os comentários</p>
              </div>
            ),
          },
        ]}
      />
    );
  }

  if (scene === "comments") {
    return (
      <ChatPhone
        theme="instagram"
        header={{ name: handle, subtitle: "Comentários" }}
        below={below}
        items={[
          {
            kind: "node",
            node: (
              <div className="px-4 py-3 text-white">
                <p className="type-caption">
                  <span className="type-caption-strong">visitante</span> {commentText || "…"}
                </p>
                <p className="mt-1 type-micro-legal text-white/40">Responder</p>
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
      items={
        showWelcome && welcomeText.trim()
          ? [
              { kind: "received", text: welcomeText },
              ...(welcomeButton.trim()
                ? [{ kind: "sent" as const, text: welcomeButton.trim() }]
                : []),
            ]
          : []
      }
      empty={<p className="type-fine-print text-white/40">A DM aparece quando as boas-vindas estão ligadas.</p>}
    />
  );
}
