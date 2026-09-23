"use client";

import { useMemo, useState } from "react";
import { Film, Images, Search, X } from "lucide-react";
import { wizardInputCls } from "./wizard-ui";

export type IgMediaItem = {
  id: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
};

function formatRelativeTime(iso?: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff) || diff < 0) return "";
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "hoje";
  if (days === 1) return "há 1 dia";
  if (days < 7) return `há ${days} dias`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "há 1 semana";
  if (weeks < 5) return `há ${weeks} semanas`;
  const months = Math.floor(days / 30);
  if (months <= 1) return "há 1 mês";
  return `há ${months} meses`;
}

function MediaImage({
  item,
  className = "",
}: {
  item: IgMediaItem;
  className?: string;
}) {
  const src = item.thumbnail_url || item.media_url;
  return (
    <div className={`relative overflow-hidden bg-zinc-100 ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full min-h-[72px] items-center justify-center text-[10px] text-zinc-500">
          {item.media_type ?? "Post"}
        </div>
      )}
      {(item.media_type === "VIDEO" ||
        item.media_type === "REELS" ||
        item.media_type === "CAROUSEL_ALBUM") && (
        <span className="absolute right-1.5 top-1.5 rounded bg-black/45 p-0.5">
          {item.media_type === "CAROUSEL_ALBUM" ? (
            <Images className="h-3 w-3 text-white" />
          ) : (
            <Film className="h-3 w-3 text-white" />
          )}
        </span>
      )}
    </div>
  );
}

type IgMediaPickerProps = {
  media: IgMediaItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading?: boolean;
  warning?: string | null;
  onRetry?: () => void;
  fallbackIdInput?: boolean;
  onFallbackIdChange?: (id: string | null) => void;
};

export function IgMediaPicker({
  media,
  selectedId,
  onSelect,
  loading,
  warning,
  onRetry,
  fallbackIdInput,
  onFallbackIdChange,
}: IgMediaPickerProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");

  const recent = media.slice(0, 4);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return media;
    return media.filter((m) =>
      String(m.caption ?? "").toLowerCase().includes(q),
    );
  }, [media, search]);

  function pick(id: string) {
    onSelect(id);
    setModalOpen(false);
    setSearch("");
  }

  return (
    <>
      {loading && (
        <p className="text-[11px] text-zinc-500">Carregando publicações…</p>
      )}

      {warning && (
        <div className="space-y-2 rounded-lg border border-amber-200/80 bg-amber-50 px-2.5 py-2">
          <p className="text-[11px] leading-snug text-amber-900">{warning}</p>
          {onRetry && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRetry();
              }}
              className="text-[11px] font-semibold text-[#0084ff] hover:underline"
            >
              Tentar novamente
            </button>
          )}
        </div>
      )}

      {!loading && !warning && media.length === 0 && (
        <p className="text-[11px] leading-snug text-zinc-500">
          Nenhuma publicação encontrada. Publique no Instagram ou escolha
          “qualquer publicação”.
        </p>
      )}

      {recent.length > 0 && (
        <div className="grid grid-cols-4 gap-1.5">
          {recent.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                pick(m.id);
              }}
              className={`aspect-square w-full overflow-hidden rounded-lg border-2 transition ${
                selectedId === m.id
                  ? "border-[#0084ff] ring-2 ring-[#0084ff]/20"
                  : "border-zinc-200 hover:border-zinc-300"
              }`}
            >
              <MediaImage item={m} className="h-full w-full" />
            </button>
          ))}
        </div>
      )}

      {media.length > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setModalOpen(true);
          }}
          className="text-[12px] font-semibold text-[#0084ff] hover:underline"
        >
          Mostrar todos{media.length > 4 ? ` (${media.length})` : ""}
        </button>
      )}

      {fallbackIdInput && warning && onFallbackIdChange && (
        <div onClick={(e) => e.stopPropagation()}>
          <p className="mb-1 text-[11px] font-medium text-zinc-600">
            Ou cole o ID da publicação
          </p>
          <input
            value={selectedId ?? ""}
            onChange={(e) => {
              const v = e.target.value.trim();
              onFallbackIdChange(v || null);
            }}
            className={wizardInputCls}
            placeholder="Ex.: 1789… (ID do Graph)"
          />
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4">
              <h3 className="text-[15px] font-semibold leading-snug text-zinc-900">
                Selecione qualquer publicação ou reel para automatizar
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="border-b border-zinc-100 px-5 py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por legenda"
                  className="w-full rounded-lg border border-zinc-200 py-2 pl-9 pr-3 text-[13px] outline-none focus:border-[#0084ff] focus:ring-2 focus:ring-[#0084ff]/15"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {filtered.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-500">
                  Nenhuma publicação encontrada.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {filtered.map((m) => {
                    const caption = (m.caption ?? "").trim();
                    const snippet =
                      caption.length > 48
                        ? `${caption.slice(0, 48).trim()}…`
                        : caption || "Sem legenda";
                    const when = formatRelativeTime(m.timestamp);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => pick(m.id)}
                        className={`overflow-hidden rounded-xl border text-left transition hover:shadow-sm ${
                          selectedId === m.id
                            ? "border-[#0084ff] ring-2 ring-[#0084ff]/15"
                            : "border-zinc-200 hover:border-zinc-300"
                        }`}
                      >
                        <MediaImage item={m} className="aspect-square w-full" />
                        <div className="space-y-0.5 px-2.5 py-2">
                          <p className="line-clamp-2 text-[11px] leading-snug text-zinc-700">
                            {snippet}
                          </p>
                          {when && (
                            <p className="text-[10px] text-zinc-400">{when}</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
