"use client";

import {
  attachmentTypeLabel,
  extractAttachments,
  type NormalizedAttachment,
} from "@/lib/instagram/messageAttachments";

function MediaBlock({
  item,
  outbound,
}: {
  item: NormalizedAttachment;
  outbound: boolean;
}) {
  const type = item.type;
  const url = item.url;
  const label = attachmentTypeLabel(type);

  if (
    (type === "image" || type === "sticker") &&
    url
  ) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={label}
        className="mb-1 max-h-64 w-full rounded-xl object-cover"
      />
    );
  }

  if (
    (type === "video" ||
      type === "reel" ||
      type === "ig_reel" ||
      type === "story_mention" ||
      type === "story" ||
      type === "ig_story") &&
    url
  ) {
    return (
      <div className="mb-1 overflow-hidden rounded-xl">
        <video
          src={url}
          controls
          playsInline
          className="max-h-72 w-full bg-black"
        />
        {(type === "reel" || type === "ig_reel") && (
          <p
            className={`px-2 py-1 text-[10px] font-medium ${
              outbound ? "text-white/80" : "text-zinc-500"
            }`}
          >
            Reel{item.title ? ` · ${item.title}` : ""}
          </p>
        )}
      </div>
    );
  }

  if (type === "audio" && url) {
    return (
      <audio controls className="mb-1 w-full max-w-[240px]">
        <source src={url} />
      </audio>
    );
  }

  if (
    (type === "share" ||
      type === "ig_post" ||
      type === "post" ||
      type === "fallback" ||
      type === "file") &&
    url
  ) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className={`mb-1 block overflow-hidden rounded-xl border ${
          outbound
            ? "border-white/20 bg-white/10"
            : "border-zinc-200 bg-zinc-50"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={item.title || label}
          className="max-h-48 w-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
        <span
          className={`block px-3 py-2 text-xs underline ${
            outbound ? "text-white/90" : "text-sky-700"
          }`}
        >
          {item.title || `Abrir ${label.toLowerCase()}`}
        </span>
      </a>
    );
  }

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className={`mb-1 block text-xs underline ${
          outbound ? "text-white/90" : "text-sky-700"
        }`}
      >
        {item.title || label}
      </a>
    );
  }

  return (
    <p
      className={`mb-1 text-xs ${
        outbound ? "text-white/70" : "text-zinc-500"
      }`}
    >
      [{label}]
    </p>
  );
}

export function InboxMessageAttachments({
  attachments,
  outbound,
}: {
  attachments: unknown;
  outbound: boolean;
}) {
  const items = extractAttachments(attachments);
  if (items.length === 0) return null;
  return (
    <div className="space-y-1">
      {items.map((item, i) => (
        <MediaBlock
          key={`${item.type}-${item.url ?? i}`}
          item={item}
          outbound={outbound}
        />
      ))}
    </div>
  );
}

export function ContactAvatar({
  name,
  username,
  profilePictureUrl,
  size = "md",
}: {
  name?: string | null;
  username?: string | null;
  profilePictureUrl?: string | null;
  size?: "sm" | "md";
}) {
  const initial = (username || name || "?")
    .replace("@", "")
    .charAt(0)
    .toUpperCase();
  const dim = size === "sm" ? "h-9 w-9 text-xs" : "h-10 w-10 text-sm";

  if (profilePictureUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profilePictureUrl}
        alt={username || name || "Contato"}
        className={`${dim} shrink-0 rounded-full object-cover`}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      className={`flex ${dim} shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-amber-300 font-bold text-white`}
    >
      {initial}
    </div>
  );
}
