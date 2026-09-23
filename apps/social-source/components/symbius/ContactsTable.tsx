"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ContactAvatar } from "@/components/symbius/InboxMedia";

export type ContactRow = {
  id: string;
  igsid: string;
  nome: string | null;
  username: string | null;
  profilePictureUrl?: string | null;
  tags: string[];
  botPaused: boolean;
  createdAt: string | null;
  lastInteractionAt: string | null;
  conversaId?: string | null;
  lastMessage?: string | null;
  lastMessageDirection?: string | null;
  messageCount?: number;
  stId?: string | null;
};

function formatContactTag(tag: string): { label: string; isEmail: boolean } {
  if (tag.startsWith("email:")) {
    return { label: tag.slice("email:".length), isEmail: true };
  }
  return { label: tag, isEmail: false };
}

function isSystemTag(tag: string) {
  return (
    tag.startsWith("interacao:") ||
    tag.startsWith("email:") ||
    tag.startsWith("link_clicked:")
  );
}

function sourceLabel(tags: string[]): string | null {
  if (tags.includes("interacao:comentario")) return "Comentário";
  if (tags.includes("interacao:live")) return "Live";
  if (tags.includes("interacao:story")) return "Story";
  if (tags.includes("interacao:dm")) return "DM";
  return null;
}

function relativeTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
}

function displayName(c: ContactRow) {
  return c.nome || (c.username ? `@${c.username}` : "Sem nome");
}

export function ContactsTable({
  contacts,
  selectable = false,
  selected,
  onSelectionChange,
  total,
}: {
  contacts: ContactRow[];
  selectable?: boolean;
  selected?: Set<string>;
  onSelectionChange?: (s: Set<string>) => void;
  total?: number;
}) {
  const router = useRouter();
  const countLabel = useMemo(() => {
    const n = total ?? contacts.length;
    const sel = selected?.size ?? 0;
    return `${sel} selecionado(s) do total de ${n}`;
  }, [contacts.length, selected?.size, total]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-500">
        <p>{countLabel}</p>
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {contacts.length === 0 ? (
          <p className="rounded-2xl border border-zinc-200 bg-white px-4 py-10 text-center text-sm text-zinc-500">
            Nenhum contato ainda. Quando alguém interagir com suas automações,
            aparecerá aqui automaticamente.
          </p>
        ) : (
          contacts.map((c) => (
            <button
              key={c.id}
              type="button"
              className="flex w-full gap-3 rounded-2xl border border-zinc-200 bg-white p-3 text-left"
              onClick={() => {
                if (c.conversaId) router.push(`/app/inbox?conversa=${c.conversaId}`);
              }}
            >
              <ContactAvatar
                name={c.nome}
                username={c.username}
                profilePictureUrl={c.profilePictureUrl}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-zinc-900">
                  {displayName(c)}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {c.stId ?? (c.username ? `@${c.username}` : c.igsid)}
                </p>
                <p className="mt-1 line-clamp-1 text-xs text-zinc-500">
                  {c.lastMessage ?? "Sem mensagens"}
                </p>
              </div>
            </button>
          ))
        )}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-zinc-200 bg-white md:block">
        <table className="w-full text-sm text-zinc-900">
          <thead className="border-b border-zinc-100 bg-zinc-50/80 text-zinc-600">
            <tr>
              {selectable && (
                <th className="w-10 px-4 py-3 text-left font-semibold" />
              )}
              <th className="px-4 py-3 text-left font-semibold">
                Imagem do perfil
              </th>
              <th className="px-4 py-3 text-left font-semibold">Nome</th>
              <th className="px-4 py-3 text-left font-semibold">st_id</th>
              <th className="px-4 py-3 text-left font-semibold">
                Última mensagem
              </th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-left font-semibold">Inscrito</th>
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 ? (
              <tr>
                <td
                  colSpan={selectable ? 7 : 6}
                  className="px-4 py-10 text-center text-zinc-500"
                >
                  Nenhum contato ainda. Quando alguém interagir com suas
                  automações, aparecerá aqui automaticamente.
                </td>
              </tr>
            ) : (
              contacts.map((c) => {
                const userTags = c.tags.filter((t) => !isSystemTag(t));
                const origin = sourceLabel(c.tags);
                const rowInner = (
                  <>
                    {selectable && (
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected?.has(c.id) ?? false}
                          onChange={(e) => {
                            if (!onSelectionChange || !selected) return;
                            const next = new Set(selected);
                            if (e.target.checked) next.add(c.id);
                            else next.delete(c.id);
                            onSelectionChange(next);
                          }}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <ContactAvatar
                        name={c.nome}
                        username={c.username}
                        profilePictureUrl={c.profilePictureUrl}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-900">
                        {displayName(c)}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {c.username ? `@${c.username}` : c.igsid}
                      </p>
                      {(origin || userTags.length > 0) && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {origin ? (
                            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">
                              {origin}
                            </span>
                          ) : null}
                          {userTags.slice(0, 3).map((t) => {
                            const { label, isEmail } = formatContactTag(t);
                            return (
                              <span
                                key={t}
                                className={`rounded-full px-2 py-0.5 text-[10px] ${
                                  isEmail
                                    ? "bg-violet-50 text-violet-700"
                                    : "bg-sky-50 text-sky-700"
                                }`}
                              >
                                {isEmail ? label : t}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                      {c.stId ?? "—"}
                    </td>
                    <td className="max-w-[220px] px-4 py-3 text-zinc-600">
                      {c.lastMessage ? (
                        <span className="line-clamp-2 text-xs leading-snug">
                          {c.lastMessageDirection === "OUTBOUND" ? "Você: " : ""}
                          {c.lastMessage}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {c.botPaused ? (
                        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                          Bot pausado
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                          Inscrito
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {relativeTime(c.createdAt ?? c.lastInteractionAt)}
                    </td>
                  </>
                );

                return (
                  <tr
                    key={c.id}
                    className={`border-t border-zinc-100 ${
                      c.conversaId ? "cursor-pointer transition hover:bg-zinc-50/80" : ""
                    }`}
                    onClick={() => {
                      if (c.conversaId) {
                        router.push(`/app/inbox?conversa=${c.conversaId}`);
                      }
                    }}
                  >
                    {rowInner}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
