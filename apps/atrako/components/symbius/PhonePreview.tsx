"use client";

import { ChatPhone, type ChatItem } from "./phone/ChatPhone";

export type IgPreviewSection =
  | "post"
  | "keyword"
  | "welcome"
  | "follow"
  | "email"
  | "reward"
  | "reminder";

type PhonePreviewProps = {
  scene?: "comment" | "story";
  section?: IgPreviewSection | null;
  onSection?: (section: IgPreviewSection) => void;
  mediaUrl?: string | null;
  caption?: string;
  commentText?: string;
  username?: string;
  profilePictureUrl?: string | null;
  welcomeText?: string;
  welcomeButton?: string;
  followText?: string;
  followButton?: string;
  emailText?: string;
  emailPreview?: string;
  rewardText?: string;
  rewardButton?: string;
  reminderText?: string;
  reminderMinutes?: number;
  showReward?: boolean;
};

function focus(
  section: IgPreviewSection,
  active: IgPreviewSection | null | undefined,
  onSection?: (section: IgPreviewSection) => void,
) {
  return {
    id: section,
    highlight: active === section,
    dim: Boolean(active) && active !== section,
    onClick: onSection ? () => onSection(section) : undefined,
  };
}

/** Conversa da automação no mesmo celular das automações de WhatsApp. */
export function PhonePreview({
  scene = "comment",
  section = null,
  onSection,
  mediaUrl,
  caption = "Sua publicação",
  commentText = "Eu quero",
  username = "seu_perfil",
  profilePictureUrl,
  welcomeText = "",
  welcomeButton = "",
  followText = "",
  followButton = "",
  emailText = "",
  emailPreview = "seguidor@email.com",
  rewardText = "",
  rewardButton = "",
  reminderText = "",
  reminderMinutes = 30,
  showReward = true,
}: PhonePreviewProps) {
  const handle = username.replace(/^@/, "");
  const story = scene === "story";
  const items: ChatItem[] = [
    {
      kind: "system",
      tone: "trigger",
      text: story ? "Quando respondem o story" : "Quando comentam na publicação",
    },
  ];

  if (!story) {
    items.push({
      kind: "received",
      ...focus("post", section, onSection),
      headerText: `@${handle}`,
      text: caption,
      image: mediaUrl || undefined,
    });
  }

  items.push({
    kind: "sent",
    ...focus("keyword", section, onSection),
    text: commentText || "…",
  });

  if (welcomeText.trim()) {
    items.push({
      kind: "received",
      ...focus("welcome", section, onSection),
      text: welcomeText,
      buttons: welcomeButton.trim()
        ? [{ text: welcomeButton.trim(), kind: "reply" }]
        : undefined,
    });
  }

  if (followText.trim()) {
    items.push({
      kind: "received",
      ...focus("follow", section, onSection),
      text: followText,
      buttons: followButton.trim()
        ? [{ text: followButton.trim(), kind: "reply" }]
        : undefined,
    });
  }

  if (emailText.trim()) {
    items.push({
      kind: "received",
      ...focus("email", section, onSection),
      text: emailText,
    });
    items.push({ kind: "sent", text: emailPreview });
  }

  if (showReward && rewardText.trim()) {
    items.push({
      kind: "received",
      ...focus("reward", section, onSection),
      text: rewardText,
      buttons: rewardButton.trim()
        ? [{ text: rewardButton.trim(), kind: "url" }]
        : undefined,
    });
  }

  if (reminderText.trim()) {
    items.push({
      kind: "system",
      text: `${reminderMinutes} minutos depois, se o link não foi aberto`,
    });
    items.push({
      kind: "received",
      ...focus("reminder", section, onSection),
      text: reminderText,
      buttons: rewardButton.trim()
        ? [{ text: rewardButton.trim(), kind: "url" }]
        : undefined,
    });
  }

  return (
    <div className="script-phone">
      <ChatPhone
        theme="whatsapp"
        header={{
          name: `@${handle}`,
          subtitle: story ? "Resposta ao story" : "Comentário no Instagram",
          avatarUrl: profilePictureUrl,
        }}
        items={items}
        focusId={section}
      />
    </div>
  );
}
