"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Merge, Tag, Zap } from "lucide-react";
import { ContactsTable, type ContactRow } from "./ContactsTable";

type TagDef = { id: string; nome: string };
type Fluxo = { id: string; nome: string; status: string };

export function ContactsClient({ initialContacts }: { initialContacts: ContactRow[] }) {
  const [contacts, setContacts] = useState(initialContacts);
  const [total, setTotal] = useState(initialContacts.length);
  const [q, setQ] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [tags, setTags] = useState<TagDef[]>([]);
  const [fluxos, setFluxos] = useState<Fluxo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkTag, setBulkTag] = useState("");

  const reload = useCallback(async () => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (tagFilter) sp.set("tag", tagFilter);
    const res = await fetch(`/api/symbius/contacts?${sp}`);
    const data = await res.json();
    setContacts(data.contatos ?? []);
    setTotal(data.total ?? data.contatos?.length ?? 0);
  }, [q, tagFilter]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    void fetch("/api/symbius/tags")
      .then((r) => r.json())
      .then((d) => setTags(d.tags ?? []));
    void fetch("/api/symbius/flows")
      .then((r) => r.json())
      .then((d) =>
        setFluxos(
          (d.fluxos ?? []).filter(
            (f: Fluxo) => f.status === "PUBLISHED",
          ),
        ),
      );
  }, []);

  const filtered = useMemo(() => contacts, [contacts]);

  async function bulkAddTag() {
    if (!bulkTag || selected.size === 0) return;
    await fetch("/api/symbius/contacts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected), addTags: [bulkTag] }),
    });
    setSelected(new Set());
    void reload();
  }

  async function triggerFlow(fluxoId: string) {
    for (const id of selected) {
      await fetch(`/api/symbius/contacts/${id}/trigger-flow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fluxoId }),
      });
    }
  }

  async function exportCsv() {
    window.open("/api/symbius/contacts/export", "_blank");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar contatos..."
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        >
          <option value="">Todas as tags</option>
          {tags.map((t) => (
            <option key={t.id} value={t.nome}>
              {t.nome}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void exportCsv()}
          className="symbius-btn-outline inline-flex items-center gap-1 px-3 py-2 text-sm"
        >
          <Download className="h-4 w-4" />
          Exportar CSV
        </button>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white p-3">
          <span className="text-sm text-zinc-500">{selected.size} selecionado(s)</span>
          <input
            value={bulkTag}
            onChange={(e) => setBulkTag(e.target.value)}
            placeholder="Tag para adicionar"
            className="rounded-lg border border-zinc-200 px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={() => void bulkAddTag()}
            className="symbius-btn-outline inline-flex items-center gap-1 px-3 py-1.5 text-sm"
          >
            <Tag className="h-4 w-4" />
            Aplicar tag
          </button>
          {fluxos.length > 0 && (
            <select
              onChange={(e) => {
                if (e.target.value) void triggerFlow(e.target.value);
                e.target.value = "";
              }}
              className="rounded-lg border border-zinc-200 px-2 py-1 text-sm"
              defaultValue=""
            >
              <option value="" disabled>
                Disparar fluxo...
              </option>
              {fluxos.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <ContactsTable
        contacts={filtered}
        selectable
        selected={selected}
        onSelectionChange={setSelected}
        total={total}
      />
    </div>
  );
}
