export type NormalizedAttachment = {
  type: string;
  url?: string;
  title?: string;
  reelVideoId?: string | number;
};

type RawAttachment = {
  type?: string;
  payload?: {
    url?: string;
    title?: string;
    reel_video_id?: string | number;
    ig_post_media_id?: string;
  };
};

function asAttachmentList(raw: unknown): RawAttachment[] {
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.attachments)) {
    return obj.attachments as RawAttachment[];
  }
  if (typeof obj.type === "string") {
    return [obj as RawAttachment];
  }
  return [];
}

export function extractAttachments(raw: unknown): NormalizedAttachment[] {
  return asAttachmentList(raw)
    .map((a) => {
      const type = String(a.type ?? "file").toLowerCase();
      const url = a.payload?.url;
      const title = a.payload?.title;
      const reelVideoId = a.payload?.reel_video_id;
      return {
        type,
        url: typeof url === "string" ? url : undefined,
        title: typeof title === "string" ? title : undefined,
        reelVideoId,
      };
    })
    .filter((a) => a.type !== "instagram_comment" || Boolean(a.title || a.url));
}

export function isMediaAttachmentType(type: string) {
  return [
    "image",
    "video",
    "audio",
    "file",
    "sticker",
    "reel",
    "ig_reel",
    "share",
    "ig_post",
    "post",
    "story_mention",
    "story",
    "ig_story",
    "fallback",
  ].includes(type);
}

export function attachmentTypeLabel(type: string): string {
  switch (type) {
    case "image":
    case "sticker":
      return "Imagem";
    case "video":
      return "Vídeo";
    case "audio":
      return "Áudio";
    case "reel":
    case "ig_reel":
      return "Reel";
    case "share":
    case "ig_post":
    case "post":
      return "Publicação";
    case "story_mention":
    case "story":
    case "ig_story":
      return "Story";
    case "file":
      return "Arquivo";
    default:
      return "Anexo";
  }
}

export function attachmentPreviewLabel(
  raw: unknown,
  texto?: string | null,
): string {
  const text = texto?.trim();
  if (text) return text;
  const list = extractAttachments(raw).filter((a) =>
    isMediaAttachmentType(a.type),
  );
  if (list.length === 0) return "—";
  if (list.length === 1) return `[${attachmentTypeLabel(list[0].type)}]`;
  return `[${list.length} anexos]`;
}

export function messageHasVisibleContent(
  texto?: string | null,
  attachments?: unknown,
): boolean {
  if (texto?.trim()) return true;
  return extractAttachments(attachments).some(
    (a) =>
      Boolean(a.url) ||
      Boolean(a.title) ||
      isMediaAttachmentType(a.type),
  );
}
