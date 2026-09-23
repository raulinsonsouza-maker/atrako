"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PillSelect } from "@/components/ui/pill-select";
import { SearchInput } from "@/components/ui/search-input";
import {
  Clock,
  Heart,
  ImagePlus,
  Inbox,
  MessageSquare,
  PauseCircle,
  PlayCircle,
  Send,
  Settings,
  User,
  X,
} from "lucide-react";
import { isWithin24hWindow } from "@/lib/instagram/messagingClient";
import { messageHasVisibleContent } from "@/lib/instagram/messageAttachments";
import {
  ContactAvatar,
  InboxMessageAttachments,
} from "@/components/symbius/InboxMedia";

type ConversaItem = {
  id: string;
  status: string;
  handoffHuman: boolean;
  unread: boolean;
  contato: {
    id: string;
    nome: string | null;
    username: string | null;
    profilePictureUrl?: string | null;
    tags: string[];
    botPaused: boolean;
    lastInteractionAt: string | null;
  };
  lastMessage: string;
  lastMessageAt: string | null;
};

type Mensagem = {
  id: string;
  direction: string;
  texto: string | null;
  attachments?: unknown;
  createdAt: string;
};

type PendingMedia = {
  file: File;
  previewUrl: string;
  mediaType: "image" | "video" | "audio";
};

type FolderFilter = "all" | "open" | "unread" | "handoff";

function displayName(c: ConversaItem["contato"]) {
  if (c.username) return `@${c.username}`;
  if (c.nome) return c.nome;
  return "Contato";
}

export default function InboxPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const conversaFromUrl = searchParams.get("conversa");
  const [conversas, setConversas] = useState<ConversaItem[]>([]);
  const [counts, setCounts] = useState({
    all: 0,
    open: 0,
    unread: 0,
    handoff: 0,
  });
  const [folder, setFolder] = useState<FolderFilter>("all");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<ConversaItem | null>(
    null,
  );
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [reply, setReply] = useState("");
  const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");
  const [snippets, setSnippets] = useState<Array<{ id: string; title: string; body: string; shortcut?: string }>>([]);
  const [fluxos, setFluxos] = useState<Array<{ id: string; nome: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(true);

  const loadList = useCallback(async () => {
    const params = new URLSearchParams();
    if (folder === "open") params.set("status", "OPEN");
    if (folder === "unread") params.set("unread", "1");
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/symbius/inbox?${params}`);
    const d = await res.json();
    let list = (d.conversas ?? []) as ConversaItem[];
    if (folder === "handoff") {
      list = list.filter((c) => c.handoffHuman);
    }
    setConversas(list);
    if (d.counts) setCounts(d.counts);
    setLoadingList(false);
  }, [folder, q]);

  useEffect(() => {
    setLoadingList(true);
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (conversaFromUrl) {
      setSelectedId(conversaFromUrl);
    }
  }, [conversaFromUrl]);

  useEffect(() => {
    if (!selectedId) {
      setMensagens([]);
      setSelectedSnapshot(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/symbius/inbox/${selectedId}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setMensagens(d.conversa?.mensagens ?? []);
        setConversas((prev) => {
          const wasUnread = prev.find((c) => c.id === selectedId)?.unread;
          if (wasUnread) {
            setCounts((c) => ({
              ...c,
              unread: Math.max(0, c.unread - 1),
            }));
          }
          return prev.map((c) =>
            c.id === selectedId ? { ...c, unread: false } : c,
          );
        });
        setSelectedSnapshot((prev) =>
          prev?.id === selectedId ? { ...prev, unread: false } : prev,
        );
        void loadList();
        router.refresh();
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, loadList, router]);

  const selected = useMemo(() => {
    const fromList = conversas.find((c) => c.id === selectedId) ?? null;
    if (fromList) return fromList;
    if (selectedSnapshot?.id === selectedId) return selectedSnapshot;
    return null;
  }, [conversas, selectedId, selectedSnapshot]);

  function openConversa(c: ConversaItem) {
    setSelectedSnapshot(c);
    setSelectedId(c.id);
  }

  useEffect(() => {
    void fetch("/api/symbius/snippets")
      .then((r) => r.json())
      .then((d) => setSnippets(d.snippets ?? []));
    void fetch("/api/symbius/flows")
      .then((r) => r.json())
      .then((d) =>
        setFluxos(
          (d.fluxos ?? []).filter(
            (f: { status: string }) => f.status === "PUBLISHED",
          ),
        ),
      );
  }, []);

  async function sendReply() {
    if (!selectedId) return;
    if (!reply.trim() && !pendingMedia) return;
    setLoading(true);
    try {
      let attachment:
        | { type: "image" | "video" | "audio" | "file"; url: string }
        | undefined;

      if (pendingMedia) {
        const form = new FormData();
        form.append("file", pendingMedia.file);
        const up = await fetch("/api/symbius/inbox/upload", {
          method: "POST",
          body: form,
        });
        const upData = await up.json();
        if (!up.ok) {
          alert(upData.error ?? "Falha no upload");
          return;
        }
        attachment = {
          type: upData.mediaType as "image" | "video" | "audio",
          url: upData.url as string,
        };
      }

      const res = await fetch("/api/symbius/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversaId: selectedId,
          text: reply,
          ...(attachment ? { attachment } : {}),
          ...(scheduleAt && !attachment
            ? { scheduledAt: new Date(scheduleAt).toISOString() }
            : {}),
        }),
      });
      if (res.ok) {
        setReply("");
        setScheduleAt("");
        if (pendingMedia) {
          URL.revokeObjectURL(pendingMedia.previewUrl);
          setPendingMedia(null);
        }
        if (!scheduleAt || attachment) {
          const r = await fetch(`/api/symbius/inbox/${selectedId}`);
          const d = await r.json();
          setMensagens(d.conversa?.mensagens ?? []);
        }
        void loadList();
      } else {
        const err = await res.json();
        alert(err.error ?? "Erro ao enviar");
      }
    } finally {
      setLoading(false);
    }
  }

  function onPickMedia(file: File | null) {
    if (!file) return;
    if (pendingMedia) URL.revokeObjectURL(pendingMedia.previewUrl);
    const mediaType = file.type.startsWith("video/")
      ? "video"
      : file.type.startsWith("audio/")
        ? "audio"
        : "image";
    setPendingMedia({
      file,
      previewUrl: URL.createObjectURL(file),
      mediaType,
    });
  }

  async function patchConversa(patch: {
    status?: string;
    handoffHuman?: boolean;
    botPaused?: boolean;
  }) {
    if (!selectedId) return;
    await fetch("/api/symbius/inbox", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversaId: selectedId, ...patch }),
    });
    void loadList();
    if (selected) {
      setConversas((prev) =>
        prev.map((c) =>
          c.id === selectedId
            ? {
                ...c,
                status: patch.status ?? c.status,
                handoffHuman: patch.handoffHuman ?? c.handoffHuman,
                contato: {
                  ...c.contato,
                  botPaused: patch.botPaused ?? c.contato.botPaused,
                },
              }
            : c,
        ),
      );
    }
  }

  const canSend = selected?.contato.lastInteractionAt
    ? isWithin24hWindow(new Date(selected.contato.lastInteractionAt))
    : false;

  const folders: Array<{
    id: FolderFilter;
    label: string;
    icon: React.ReactNode;
    count?: number;
  }> = [
    {
      id: "all",
      label: "Todas as conversas",
      icon: <Inbox className="h-4 w-4" />,
      count: counts.all,
    },
    {
      id: "open",
      label: "Conversas abertas",
      icon: <MessageSquare className="h-4 w-4" />,
      count: counts.open,
    },
    {
      id: "unread",
      label: "Não lidas",
      icon: <span className="h-2 w-2 rounded-full bg-sky-500" />,
      count: counts.unread,
    },
    {
      id: "handoff",
      label: "Atendimento humano",
      icon: <User className="h-4 w-4" />,
      count: counts.handoff,
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--canvas-parchment)] text-[var(--ink)]">
      <div className="flex min-h-0 flex-1">
      {/* Folders */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-[var(--hairline)] bg-white md:flex">
        <div className="border-b border-[var(--hairline)] px-4 py-4">
          <h1 className="type-tagline">Caixa de Entrada</h1>
        </div>
        <nav className="flex-1 space-y-0.5 p-2" aria-label="Pastas">
          {folders.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFolder(f.id)}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm ${
                folder === f.id
                  ? "bg-[var(--primary-glow)] type-body-strong text-[var(--primary)]"
                  : "text-[var(--ink-muted-48)] hover:bg-[var(--canvas-parchment)]"
              }`}
            >
              {f.icon}
              <span className="flex-1 truncate">{f.label}</span>
              {typeof f.count === "number" && (
                <span className="text-xs text-[var(--ink-muted-48)]">{f.count}</span>
              )}
            </button>
          ))}
          <div className="my-3 border-t border-[var(--divider-soft)] pt-3">
            <p className="px-3 type-micro-legal uppercase tracking-wide text-[var(--ink-muted-48)]">
              Atalhos
            </p>
            <div className="mt-1 space-y-0.5">
              <div className="flex items-center gap-2 rounded-lg px-3 py-2 type-caption text-[var(--ink-muted-48)]">
                <Clock className="h-4 w-4" />
                Lembretes
                <span className="ml-auto type-micro-legal text-amber-500">
                  EM BREVE
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-lg px-3 py-2 type-caption text-[var(--ink-muted-48)]">
                <Heart className="h-4 w-4" />
                Favoritos
                <span className="ml-auto type-micro-legal text-amber-500">
                  EM BREVE
                </span>
              </div>
            </div>
          </div>
        </nav>
        <div className="border-t border-[var(--hairline)] p-3">
          <Link
            href="/social/flows/new"
            className="flex items-center gap-2 rounded-lg px-3 py-2 type-caption text-[var(--ink-muted-48)] hover:bg-[var(--canvas-parchment)]"
          >
            Criar automação
          </Link>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex gap-2 overflow-x-auto border-b border-[var(--hairline)] bg-white px-3 py-2 md:hidden">
          {folders.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFolder(f.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 type-fine-print ${
                folder === f.id
                  ? "bg-[var(--primary)] text-white"
                  : "bg-[var(--canvas-parchment)] text-[var(--ink-muted-48)]"
              }`}
            >
              {f.label}
              {typeof f.count === "number" ? ` (${f.count})` : ""}
            </button>
          ))}
        </div>

      {/* Conversation list */}
      <section
        className={`flex min-w-0 flex-col border-r border-[var(--hairline)] bg-white md:w-[340px] lg:w-[380px] ${
          selectedId ? "hidden md:flex" : "flex w-full"
        }`}
      >
        <div className="border-b border-[var(--hairline)] p-3">
          <SearchInput
            size="toolbar"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar conversas…"
          />
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
            <span className="rounded-full bg-[var(--canvas-parchment)] px-2.5 py-1 text-[var(--ink-muted-48)]">
              {folder === "all"
                ? "Todas"
                : folder === "open"
                  ? "Abertas"
                  : folder === "unread"
                    ? "Não lidas"
                    : "Humano"}
            </span>
            <span className="rounded-full bg-[var(--canvas-parchment)] px-2.5 py-1 text-[var(--ink-muted-48)]">
              Mais recentes
            </span>
            <span className="rounded-full bg-[var(--canvas-parchment)] px-2.5 py-1 text-[var(--ink-muted-48)]">
              Instagram
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingList && (
            <p className="p-4 type-caption text-[var(--ink-muted-48)]">Carregando…</p>
          )}
          {!loadingList && conversas.length === 0 && (
            <div className="p-6 text-center">
              <p className="type-caption text-[var(--ink-muted-48)]">
                Nenhuma conversa nesta pasta
              </p>
              <Link
                href="/social/flows/new?template=comment_dm"
                className="mt-3 inline-flex type-caption-strong text-[var(--primary)]"
              >
                Criar automação
              </Link>
            </div>
          )}
          {conversas.map((c) => {
            const active = selectedId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => openConversa(c)}
                className={`flex w-full gap-3 border-b border-[var(--divider-soft)] px-4 py-3 text-left transition-colors ${
                  active ? "bg-sky-50" : "hover:bg-[var(--canvas-parchment)]"
                }`}
              >
                <ContactAvatar
                  name={c.contato.nome}
                  username={c.contato.username}
                  profilePictureUrl={c.contato.profilePictureUrl}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate type-caption-strong text-[var(--ink)]">
                      {displayName(c.contato)}
                    </p>
                    {c.unread && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-sky-500" />
                    )}
                    {c.lastMessageAt && (
                      <span className="ml-auto shrink-0 type-micro-legal text-[var(--ink-muted-48)]">
                        {formatDistanceToNow(new Date(c.lastMessageAt), {
                          addSuffix: false,
                          locale: ptBR,
                        })}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate type-caption text-[var(--ink-muted-48)]">
                    {c.lastMessage || "—"}
                  </p>
                  {(c.contato.botPaused || c.handoffHuman) && (
                    <p className="mt-1 type-micro-legal text-amber-600">
                      {c.contato.botPaused ? "Bot pausado" : "Handoff humano"}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Thread */}
      <section
        className={`min-w-0 flex-1 flex-col bg-[#fafafa] ${
          selectedId ? "flex" : "hidden md:flex"
        }`}
      >
        {!selectedId || !selected ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-zinc-200/80">
              <MessageSquare className="h-10 w-10 text-[var(--ink-muted-48)]" />
            </div>
            <h2 className="mt-6 max-w-md type-tagline text-[var(--ink)]">
              Este é um espaço para conversar com seus contatos de todos os
              canais conectados
            </h2>
            <p className="mt-2 max-w-sm type-caption text-[var(--ink-muted-48)]">
              Toda mensagem que você receber será exibida aqui. Você pode fazer
              ajustes nas Configurações.
            </p>
            <Link
              href="/social/settings"
              className="mt-8 rounded-xl bg-[var(--primary)] px-5 py-2.5 type-caption-strong text-white hover:opacity-90"
            >
              Ir para as configurações
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-[var(--hairline)] bg-white px-5 py-3">
              <button
                type="button"
                className="rounded-lg p-1 text-[var(--ink-muted-48)] md:hidden"
                onClick={() => setSelectedId(null)}
              >
                ←
              </button>
              <ContactAvatar
                name={selected.contato.nome}
                username={selected.contato.username}
                profilePictureUrl={selected.contato.profilePictureUrl}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate type-body-strong">
                  {displayName(selected.contato)}
                </p>
                <p className="text-xs text-[var(--ink-muted-48)]">
                  Instagram
                  {!canSend ? " · fora da janela 24h (HUMAN_AGENT)" : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  title={
                    selected.contato.botPaused
                      ? "Retomar bot"
                      : "Pausar bot"
                  }
                  onClick={() =>
                    patchConversa({
                      botPaused: !selected.contato.botPaused,
                      handoffHuman: !selected.contato.botPaused,
                    })
                  }
                  className="rounded-lg border border-[var(--hairline)] p-2 text-[var(--ink-muted-48)] hover:bg-[var(--canvas-parchment)]"
                >
                  {selected.contato.botPaused ? (
                    <PlayCircle className="h-4 w-4" />
                  ) : (
                    <PauseCircle className="h-4 w-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    patchConversa({
                      status:
                        selected.status === "OPEN" ? "CLOSED" : "OPEN",
                    })
                  }
                  className="rounded-lg border border-[var(--hairline)] px-3 py-2 type-fine-print text-[var(--ink-muted-48)] hover:bg-[var(--canvas-parchment)]"
                >
                  {selected.status === "OPEN" ? "Fechar" : "Reabrir"}
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {mensagens
                .filter((m) =>
                  messageHasVisibleContent(m.texto, m.attachments),
                )
                .map((m) => {
                  const outbound = m.direction === "OUTBOUND";
                  return (
                    <div
                      key={m.id}
                      className={`flex ${
                        outbound ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          outbound
                            ? "rounded-br-md bg-[var(--primary)] text-white"
                            : "rounded-bl-md bg-white text-[var(--ink)] shadow-sm"
                        }`}
                      >
                        <InboxMessageAttachments
                          attachments={m.attachments}
                          outbound={outbound}
                        />
                        {m.texto?.trim() ? <p>{m.texto}</p> : null}
                        <p
                          className={`mt-1 type-micro-legal ${
                            outbound ? "text-white/70" : "text-[var(--ink-muted-48)]"
                          }`}
                        >
                          {new Date(m.createdAt).toLocaleString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                            day: "2-digit",
                            month: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="border-t border-[var(--hairline)] bg-white p-4">
              {snippets.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1">
                  {snippets.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setReply(s.body)}
                      className="rounded-full bg-[var(--canvas-parchment)] px-2 py-0.5 text-xs text-[var(--ink-muted-48)] hover:bg-zinc-200"
                    >
                      {s.shortcut ? `/${s.shortcut}` : s.title}
                    </button>
                  ))}
                </div>
              )}
              {fluxos.length > 0 && selected && (
                <PillSelect
                  className="mb-2 w-full"
                  size="field"
                  value=""
                  onChange={(v) => {
                    if (!v || !selectedId) return;
                    void fetch("/api/symbius/inbox", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        conversaId: selectedId,
                        fluxoId: v,
                      }),
                    });
                  }}
                  options={fluxos.map((f) => ({ value: f.id, label: f.nome }))}
                  placeholder="Iniciar fluxo..."
                  aria-label="Iniciar fluxo"
                />
              )}
              <input
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
                className="mb-2 w-full rounded-lg border border-[var(--hairline)] px-2 py-1 text-xs"
              />
              {pendingMedia && (
                <div className="mb-2 flex items-center gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--canvas-parchment)] p-2">
                  {pendingMedia.mediaType === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={pendingMedia.previewUrl}
                      alt="Prévia"
                      className="h-14 w-14 rounded-lg object-cover"
                    />
                  ) : pendingMedia.mediaType === "video" ? (
                    <video
                      src={pendingMedia.previewUrl}
                      className="h-14 w-14 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-zinc-200 text-xs">
                      Áudio
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate type-fine-print text-[var(--ink-muted-80)]">
                      {pendingMedia.file.name}
                    </p>
                    <p className="type-micro-legal text-[var(--ink-muted-48)]">
                      Será enviado no Direct
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(pendingMedia.previewUrl);
                      setPendingMedia(null);
                    }}
                    className="rounded-lg p-1 text-[var(--ink-muted-48)] hover:bg-zinc-200"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-[var(--hairline)] px-3 text-[var(--ink-muted-48)] hover:bg-[var(--canvas-parchment)]">
                  <ImagePlus className="h-5 w-5" />
                  <input
                    type="file"
                    accept="image/*,video/mp4,video/quicktime,audio/mpeg,audio/mp4"
                    className="hidden"
                    onChange={(e) => {
                      onPickMedia(e.target.files?.[0] ?? null);
                      e.target.value = "";
                    }}
                  />
                </label>
                <input
                  value={reply}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v.startsWith("/")) {
                      const shortcut = v.slice(1).split(" ")[0];
                      const sn = snippets.find((s) => s.shortcut === shortcut);
                      if (sn && (v.endsWith(" ") || v === `/${shortcut}`)) {
                        setReply(sn.body);
                        return;
                      }
                    }
                    setReply(v);
                  }}
                  placeholder="Digite sua mensagem..."
                  className="flex-1 rounded-xl border border-[var(--hairline)] bg-[var(--canvas-parchment)] px-4 py-3 text-sm outline-none focus:border-sky-400 focus:bg-white"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendReply();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => void sendReply()}
                  disabled={loading || (!reply.trim() && !pendingMedia)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-3 type-caption-strong text-white hover:bg-[var(--primary-focus)] disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  {scheduleAt && !pendingMedia ? "Agendar" : "Enviar"}
                </button>
              </div>
            </div>
          </>
        )}
      </section>
      </div>
      </div>
    </div>
  );
}
