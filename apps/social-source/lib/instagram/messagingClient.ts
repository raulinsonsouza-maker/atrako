const IG_GRAPH = "https://graph.instagram.com/v21.0";

export interface MessageButton {
  type: "postback" | "web_url";
  title: string;
  payload?: string;
  url?: string;
}

export interface SendMessageParams {
  igUserId: string;
  accessToken: string;
  recipientIgsid: string;
  text?: string;
  buttons?: MessageButton[];
  tag?: "HUMAN_AGENT";
}

export async function sendInstagramMessage(
  params: SendMessageParams,
): Promise<{ message_id?: string }> {
  const buttons = (params.buttons ?? []).filter((b) => b.title.trim());
  let message: Record<string, unknown>;

  if (buttons.length > 0) {
    message = {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: (params.text ?? "").slice(0, 640) || " ",
          buttons: buttons.slice(0, 3).map((b) => {
            if (b.type === "web_url" && b.url) {
              return { type: "web_url", title: b.title.slice(0, 20), url: b.url };
            }
            return {
              type: "postback",
              title: b.title.slice(0, 20),
              payload: b.payload ?? b.title,
            };
          }),
        },
      },
    };
  } else {
    message = { text: params.text ?? "" };
  }

  const body: Record<string, unknown> = {
    recipient: { id: params.recipientIgsid },
    message,
  };
  if (params.tag) {
    body.messaging_type = "MESSAGE_TAG";
    body.tag = params.tag;
  }

  const res = await fetch(`${IG_GRAPH}/${params.igUserId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as {
    message_id?: string;
    error?: { message: string };
  };
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `Send failed ${res.status}`);
  }
  return json;
}

export async function sendInstagramImageMessage(params: {
  igUserId: string;
  accessToken: string;
  recipientIgsid: string;
  imageUrl: string;
  text?: string;
}): Promise<{ message_id?: string }> {
  return sendInstagramMediaMessage({
    ...params,
    mediaType: "image",
    mediaUrl: params.imageUrl,
  });
}

export async function sendInstagramMediaMessage(params: {
  igUserId: string;
  accessToken: string;
  recipientIgsid: string;
  mediaType: "image" | "video" | "audio" | "file";
  mediaUrl: string;
  text?: string;
  tag?: "HUMAN_AGENT";
}): Promise<{ message_id?: string }> {
  const message: Record<string, unknown> = {
    attachment: {
      type: params.mediaType,
      payload: { url: params.mediaUrl, is_reusable: true },
    },
  };

  const body: Record<string, unknown> = {
    recipient: { id: params.recipientIgsid },
    message,
  };
  if (params.tag) {
    body.messaging_type = "MESSAGE_TAG";
    body.tag = params.tag;
  }

  const res = await fetch(`${IG_GRAPH}/${params.igUserId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as {
    message_id?: string;
    error?: { message: string };
  };
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `Media send failed ${res.status}`);
  }

  // Meta não envia caption junto com attachment em um único payload;
  // se houver texto, envia em seguida.
  if (params.text?.trim()) {
    await sendInstagramMessage({
      igUserId: params.igUserId,
      accessToken: params.accessToken,
      recipientIgsid: params.recipientIgsid,
      text: params.text,
      tag: params.tag,
    });
  }

  return json;
}

/** Responde publicamente a um comentário no post. */
export async function replyToInstagramComment(params: {
  commentId: string;
  accessToken: string;
  message: string;
}): Promise<void> {
  const res = await fetch(`${IG_GRAPH}/${params.commentId}/replies`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: params.message.slice(0, 300) }),
  });
  const json = (await res.json()) as { error?: { message: string } };
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `Comment reply failed ${res.status}`);
  }
}

export function isWithin24hWindow(
  lastInteractionAt: Date | null | undefined,
): boolean {
  if (!lastInteractionAt) return false;
  return Date.now() - lastInteractionAt.getTime() < 24 * 60 * 60 * 1000;
}

export function rewardPayload(fluxoId: string): string {
  return `symbius_reward:${fluxoId}`;
}

export function parseRewardPayload(payload: string): string | null {
  if (!payload.startsWith("symbius_reward:")) return null;
  const id = payload.slice("symbius_reward:".length).trim();
  return id || null;
}

export function followConfirmPayload(fluxoId: string): string {
  return `symbius_follow:${fluxoId}`;
}

export function parseFollowPayload(payload: string): string | null {
  if (!payload.startsWith("symbius_follow:")) return null;
  const id = payload.slice("symbius_follow:".length).trim();
  return id || null;
}

export function looksLikeEmail(text: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim());
}

export type IgScopedUserProfile = {
  follows: boolean;
  username?: string;
  name?: string;
  profilePic?: string;
};

/** Perfil do IGSID (requer interação prévia na DM). */
export async function fetchIgScopedUserFollowStatus(params: {
  igsid: string;
  accessToken: string;
}): Promise<IgScopedUserProfile | null> {
  const sp = new URLSearchParams({
    fields:
      "is_user_follow_business,username,name,profile_pic",
    access_token: params.accessToken,
  });
  const res = await fetch(
    `${IG_GRAPH}/${params.igsid}?${sp.toString()}`,
    { method: "GET" },
  );
  const json = (await res.json()) as {
    is_user_follow_business?: boolean;
    username?: string;
    name?: string;
    profile_pic?: string;
    error?: { message: string };
  };
  if (!res.ok || json.error) {
    // Fallback sem profile_pic (alguns apps Instagram Login não expõem)
    const sp2 = new URLSearchParams({
      fields: "is_user_follow_business,username,name",
      access_token: params.accessToken,
    });
    const res2 = await fetch(
      `${IG_GRAPH}/${params.igsid}?${sp2.toString()}`,
      { method: "GET" },
    );
    const json2 = (await res2.json()) as {
      is_user_follow_business?: boolean;
      username?: string;
      name?: string;
      error?: { message: string };
    };
    if (!res2.ok || json2.error) return null;
    return {
      follows: Boolean(json2.is_user_follow_business),
      username: json2.username,
      name: json2.name,
    };
  }
  return {
    follows: Boolean(json.is_user_follow_business),
    username: json.username,
    name: json.name,
    profilePic: json.profile_pic,
  };
}
