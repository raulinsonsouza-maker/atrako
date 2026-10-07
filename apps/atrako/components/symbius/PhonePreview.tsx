"use client";

import { ChatPhone, type ChatItem } from "./phone/ChatPhone";

type PhonePreviewProps = {
  mediaUrl?: string | null;
  caption?: string;
  commentText?: string;
  username?: string;
  profilePictureUrl?: string | null;
  tab?: "post" | "comment" | "dm";
  onTabChange?: (tab: "post" | "comment" | "dm") => void;
  welcomeText?: string;
  welcomeButton?: string;
  followText?: string;
  followButton?: string;
  showFollowConfirmed?: boolean;
  followerHandle?: string;
  emailText?: string;
  emailPreview?: string;
  rewardText?: string;
  rewardButton?: string;
  reminderText?: string;
  reminderMinutes?: number;
  showReward?: boolean;
};

export function PhonePreview({
  mediaUrl,
  caption = "Sua publicação",
  commentText = "Eu quero",
  username = "seu_perfil",
  profilePictureUrl,
  tab = "comment",
  onTabChange,
  welcomeText = "Olá! Obrigado pelo interesse 😊",
  welcomeButton = "Me envie o link",
  followText = "",
  followButton = "Já sigo",
  showFollowConfirmed = false,
  followerHandle = "seguidor",
  emailText = "",
  emailPreview = "follower@gmail.com",
  rewardText = "Aqui está o seu acesso",
  rewardButton = "Acessar",
  reminderText = "",
  reminderMinutes = 30,
  showReward = true,
}: PhonePreviewProps) {
  const handle = username.replace(/^@/, "");
  const items: ChatItem[] = [];

  if (tab === "post" || tab === "comment") {
    items.push({
      kind: "node",
      node: (
        <>
          <div className="feed-media">
            {mediaUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl} alt="" />
            ) : (
              <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#737373", fontSize: 13 }}>
                Publicação
              </div>
            )}
          </div>
          <p className="feed-caption">
            <strong>@{handle}</strong> {caption}
          </p>
          {tab === "comment" && (
            <div className="comment-card">
              <div className="label">Comentário</div>
              <div className="body">
                <span className="handle">@seguidor</span> {commentText || "…"}
              </div>
            </div>
          )}
        </>
      ),
    });
  } else {
    items.push({ kind: "system", tone: "label", text: "DIRECT" });
    if (welcomeText.trim()) items.push({ kind: "received", text: welcomeText });
    if (welcomeButton) {
      items.push({ kind: "action", label: welcomeButton });
      items.push({ kind: "sent", text: welcomeButton });
    }
    if (followText.trim()) items.push({ kind: "received", text: followText });
    if (followButton) {
      items.push({ kind: "action", label: followButton });
      items.push({ kind: "sent", text: followButton });
    }
    if (showFollowConfirmed && followText.trim()) {
      items.push({
        kind: "system",
        text: (
          <>
            <strong>{followerHandle.replace(/^@/, "")}</strong> começou a seguir você. · agora
          </>
        ),
      });
    }
    if (emailText.trim()) {
      items.push({ kind: "received", text: emailText });
      items.push({ kind: "sent", text: emailPreview });
    }
    if (showReward && rewardText.trim()) items.push({ kind: "received", text: rewardText });
    if (showReward && rewardButton) items.push({ kind: "action", variant: "link", label: rewardButton });
    if (reminderText.trim()) {
      items.push({ kind: "system", text: `${reminderMinutes} minutos depois` });
      items.push({ kind: "received", text: reminderText, dim: true });
      if (rewardButton) items.push({ kind: "action", variant: "link", label: rewardButton, dim: true });
    }
  }

  return (
    <ChatPhone
      theme="instagram"
      header={{ name: `@${handle}`, subtitle: tab === "dm" ? "Direct" : "Instagram", avatarUrl: profilePictureUrl }}
      items={items}
      below={
        <div className="symbius-iphone-tabs">
          {(
            [
              ["post", "Publicar"],
              ["comment", "Comentários"],
              ["dm", "DM"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" onClick={() => onTabChange?.(id)} className={tab === id ? "active" : undefined}>
              {label}
            </button>
          ))}
        </div>
      }
    />
  );
}
