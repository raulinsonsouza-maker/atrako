"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";

type Option = { name: string; priceCents: number };
type Group = { name: string; minSelect: number; maxSelect: number; options: Option[] };
type Schedule = { mode: "ALWAYS" } | { mode: "HOURS"; days: Record<string, Array<{ start: string; end: string }>> };
type Item = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceCents: number;
  imageUrl: string | null;
  ingredients: string[] | null;
  available: boolean;
  schedule: Schedule | null;
  sortOrder: number;
  groups: Array<{ name: string; minSelect: number; maxSelect: number; options: Option[] }>;
};
type Category = { id: string; name: string; active: boolean; sortOrder: number };
type Store = {
  hours: Record<string, Array<{ start: string; end: string }>>;
  categories: Category[];
  items: Item[];
};

const DAYS = [
  ["1", "Seg"],
  ["2", "Ter"],
  ["3", "Qua"],
  ["4", "Qui"],
  ["5", "Sex"],
  ["6", "Sáb"],
  ["0", "Dom"],
] as const;

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function reaisToCents(value: string) {
  const number = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

export default function FoodMenuPage() {
  const { workspaceId } = useActiveWorkspace();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const { data } = useQuery({
    queryKey: ["food-store", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const res = await fetch(`/api/atrako/food?workspaceId=${workspaceId}`);
      if (!res.ok) throw new Error("Falha ao carregar o cardápio");
      return res.json() as Promise<{ store: Store | null }>;
    },
  });
  const store = data?.store;

  const save = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch("/api/atrako/food/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, ...body }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Não foi possível salvar");
      return payload;
    },
    onSuccess: () => {
      setEditing(null);
      setCategoryName("");
      queryClient.invalidateQueries({ queryKey: ["food-store", workspaceId] });
    },
  });

  return (
    <section>
      <h1 className="food-brand">Cardápio</h1>
      <input className="food-search" placeholder="Buscar item" value={search} onChange={(event) => setSearch(event.target.value)} />
      <form
        className="food-row"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate({ action: "category", name: categoryName });
        }}
      >
        <input placeholder="Nova categoria" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} />
        <button className="food-button" type="submit">Adicionar categoria</button>
        <button className="food-button ghost" type="button" onClick={() => setEditing("new")}>Novo item</button>
      </form>
      {(store?.categories ?? []).map((category) => {
        const categoryItems = (store?.items ?? []).filter((item) => item.categoryId === category.id);
        const items = categoryItems.filter((item) => !search.trim() || item.name.toLowerCase().includes(search.trim().toLowerCase()));
        return (
          <section key={category.id} className="food-panel" style={{ marginTop: 12 }}>
            <div className="food-row">
              <strong>{category.name}</strong>
              <button
                type="button"
                className="food-button ghost"
                onClick={() => save.mutate({ action: "category", categoryId: category.id, name: category.name, active: !category.active })}
              >
                {category.active ? "Pausar categoria" : "Ativar categoria"}
              </button>
            </div>
            {items.map((item) => {
              const index = categoryItems.findIndex((row) => row.id === item.id);
              return (
              <article key={item.id} className="food-row">
                <span>
                  {item.name}<br />
                  <span className="food-muted">{brl(item.priceCents)} · {item.available ? "À venda" : "Pausado"}</span>
                </span>
                <span>
                  <button type="button" className="food-button ghost" disabled={index === 0} onClick={() => {
                    const ordered = categoryItems.map((row, rowIndex) => ({ id: row.id, sortOrder: rowIndex === index ? index - 1 : rowIndex === index - 1 ? index : rowIndex }));
                    save.mutate({ action: "reorder", items: ordered });
                  }}>Subir</button>
                  <button type="button" className="food-button ghost" onClick={() => save.mutate({ action: "item", itemId: item.id, categoryId: item.categoryId, name: item.name, description: item.description, priceCents: item.priceCents, imageUrl: item.imageUrl, ingredients: item.ingredients ?? [], available: !item.available, schedule: item.schedule, groups: item.groups })}>
                    {item.available ? "Pausar" : "À venda"}
                  </button>
                  <button type="button" className="food-button" onClick={() => setEditing(item)}>Editar</button>
                </span>
              </article>
              );
            })}
          </section>
        );
      })}
      {store ? <HoursEditor hours={store.hours ?? {}} onSave={(hours) => save.mutate({ action: "hours", hours })} /> : null}
      {editing ? (
        <ItemEditor
          item={editing === "new" ? null : editing}
          categories={store?.categories ?? []}
          workspaceId={workspaceId || ""}
          onCancel={() => setEditing(null)}
          onSave={(body) => save.mutate(body)}
          error={save.error instanceof Error ? save.error.message : null}
        />
      ) : null}
    </section>
  );
}

function HoursEditor({ hours, onSave }: { hours: Store["hours"]; onSave: (hours: Store["hours"]) => void }) {
  const [draft, setDraft] = useState(hours);
  return (
    <section className="food-panel" style={{ marginTop: 12 }}>
      <h2>Horário da loja</h2>
      <p className="food-muted">Vazio significa aberto o dia todo enquanto a loja aceita pedidos.</p>
      {DAYS.map(([key, label]) => (
        <div key={key} className="food-row">
          <span>{label}</span>
          <input
            placeholder="10:00-14:00, 18:00-22:00"
            value={(draft[key] ?? []).map((slot) => `${slot.start}-${slot.end}`).join(", ")}
            onChange={(event) => {
              const slots = event.target.value.split(",").map((part) => part.trim()).filter(Boolean).map((part) => {
                const [start, end] = part.split("-");
                return { start: (start ?? "").trim(), end: (end ?? "").trim() };
              });
              setDraft({ ...draft, [key]: slots });
            }}
          />
        </div>
      ))}
      <button type="button" className="food-button" onClick={() => onSave(draft)}>Salvar horário</button>
    </section>
  );
}

function ItemEditor({
  item,
  categories,
  workspaceId,
  onCancel,
  onSave,
  error,
}: {
  item: Item | null;
  categories: Category[];
  workspaceId: string;
  onCancel: () => void;
  onSave: (body: Record<string, unknown>) => void;
  error: string | null;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [price, setPrice] = useState(item ? (item.priceCents / 100).toFixed(2).replace(".", ",") : "");
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? categories[0]?.id ?? "");
  const [imageUrl, setImageUrl] = useState(item?.imageUrl ?? "");
  const [ingredients, setIngredients] = useState((item?.ingredients ?? []).join(", "));
  const [available, setAvailable] = useState(item?.available ?? true);
  const [mode, setMode] = useState<"ALWAYS" | "HOURS">(item?.schedule?.mode === "HOURS" ? "HOURS" : "ALWAYS");
  const [days, setDays] = useState<Record<string, string>>(() => {
    const source = item?.schedule?.mode === "HOURS" ? item.schedule.days : {};
    return Object.fromEntries(DAYS.map(([key]) => [key, (source[key] ?? []).map((slot) => `${slot.start}-${slot.end}`).join(", ")]));
  });
  const [groups, setGroups] = useState<Group[]>(item?.groups ?? []);

  return (
    <form
      className="food-form"
      onSubmit={(event) => {
        event.preventDefault();
        const schedule = mode === "ALWAYS"
          ? { mode: "ALWAYS" }
          : {
              mode: "HOURS",
              days: Object.fromEntries(DAYS.map(([key]) => [key, days[key].split(",").map((part) => part.trim()).filter(Boolean).map((part) => {
                const [start, end] = part.split("-");
                return { start: (start ?? "").trim(), end: (end ?? "").trim() };
              })]).filter(([, slots]) => (slots as Array<{ start: string }>).length)),
            };
        onSave({
          action: "item",
          itemId: item?.id,
          categoryId,
          name,
          description,
          priceCents: reaisToCents(price),
          imageUrl,
          ingredients: ingredients.split(",").map((part) => part.trim()).filter(Boolean),
          available,
          schedule,
          groups: groups.map((group) => ({
            ...group,
            options: group.options.map((option) => ({ ...option, priceCents: option.priceCents })),
          })),
        });
      }}
    >
      <h2>{item ? "Editar item" : "Novo item"}</h2>
      <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome" required />
      <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Descrição" />
      <input value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Preço em reais" required />
      <div className="food-row">
        {categories.map((category) => (
          <button key={category.id} type="button" className={categoryId === category.id ? "food-button" : "food-button ghost"} onClick={() => setCategoryId(category.id)}>
            {category.name}
          </button>
        ))}
      </div>
      <input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="Foto" />
      <input
        type="file"
        accept="image/*"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const form = new FormData();
          form.set("workspaceId", workspaceId);
          form.set("file", file);
          const res = await fetch("/api/atrako/food/photo", { method: "POST", body: form });
          const payload = await res.json().catch(() => ({}));
          if (res.ok && payload.url) setImageUrl(payload.url);
        }}
      />
      <input value={ingredients} onChange={(event) => setIngredients(event.target.value)} placeholder="Ingredientes que dá para tirar, separados por vírgula" />
      <button type="button" className={available ? "food-button" : "food-button ghost"} onClick={() => setAvailable((value) => !value)}>
        {available ? "À venda" : "Pausado"}
      </button>
      <div className="food-row">
        <button type="button" className={mode === "ALWAYS" ? "food-button" : "food-button ghost"} onClick={() => setMode("ALWAYS")}>Enquanto a loja estiver aberta</button>
        <button type="button" className={mode === "HOURS" ? "food-button" : "food-button ghost"} onClick={() => setMode("HOURS")}>Dias e horários</button>
      </div>
      {mode === "HOURS" ? DAYS.map(([key, label]) => (
        <input key={key} value={days[key]} placeholder={`${label} 10:00-12:00, 16:00-22:00`} onChange={(event) => setDays({ ...days, [key]: event.target.value })} />
      )) : null}
      {groups.map((group, index) => (
        <div key={index} className="food-panel">
          <input value={group.name} placeholder="Grupo de complemento" onChange={(event) => setGroups(groups.map((row, rowIndex) => rowIndex === index ? { ...row, name: event.target.value } : row))} />
          <input value={group.minSelect} onChange={(event) => setGroups(groups.map((row, rowIndex) => rowIndex === index ? { ...row, minSelect: Number(event.target.value) || 0 } : row))} />
          <input value={group.maxSelect} onChange={(event) => setGroups(groups.map((row, rowIndex) => rowIndex === index ? { ...row, maxSelect: Number(event.target.value) || 1 } : row))} />
          {group.options.map((option, optionIndex) => (
            <div key={optionIndex} className="food-row">
              <input value={option.name} placeholder="Opção" onChange={(event) => {
                const options = group.options.map((row, rowIndex) => rowIndex === optionIndex ? { ...row, name: event.target.value } : row);
                setGroups(groups.map((row, rowIndex) => rowIndex === index ? { ...row, options } : row));
              }} />
              <input value={(option.priceCents / 100).toFixed(2).replace(".", ",")} placeholder="Preço" onChange={(event) => {
                const options = group.options.map((row, rowIndex) => rowIndex === optionIndex ? { ...row, priceCents: reaisToCents(event.target.value) } : row);
                setGroups(groups.map((row, rowIndex) => rowIndex === index ? { ...row, options } : row));
              }} />
            </div>
          ))}
          <button type="button" className="food-button ghost" onClick={() => setGroups(groups.map((row, rowIndex) => rowIndex === index ? { ...row, options: [...row.options, { name: "", priceCents: 0 }] } : row))}>Opção</button>
        </div>
      ))}
      <button type="button" className="food-button ghost" onClick={() => setGroups([...groups, { name: "", minSelect: 0, maxSelect: 1, options: [] }])}>Novo complemento</button>
      {error ? <p>{error}</p> : null}
      <div className="food-row">
        <button className="food-button" type="submit">Salvar</button>
        <button className="food-button ghost" type="button" onClick={onCancel}>Fechar</button>
      </div>
    </form>
  );
}
