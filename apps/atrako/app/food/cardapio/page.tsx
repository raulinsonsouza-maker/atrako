"use client";

import { useEffect, useState } from "react";
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
  emoji: string | null;
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
      <h1 className="food-title">Cardápio</h1>
      <p className="food-lead">A foto, o preço e o que está à venda. O cliente vê a mesma imagem.</p>
      <div className="food-toolbar">
        <input className="food-search" placeholder="Buscar item" value={search} onChange={(event) => setSearch(event.target.value)} />
        <button className="food-button" type="button" onClick={() => setEditing("new")}>Novo item</button>
      </div>
      <form
        className="food-toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate({ action: "category", name: categoryName });
        }}
      >
        <input placeholder="Nova categoria" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} />
        <button className="food-button ghost" type="submit">Adicionar categoria</button>
      </form>
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
      {(store?.categories ?? []).map((category) => {
        const categoryItems = (store?.items ?? []).filter((item) => item.categoryId === category.id);
        const items = categoryItems.filter((item) => !search.trim() || item.name.toLowerCase().includes(search.trim().toLowerCase()));
        return (
          <section key={category.id} className="food-category">
            <div className="food-category__head">
              <h2>{category.name}{category.active ? "" : " · pausada"}</h2>
              <button
                type="button"
                className="food-button ghost"
                onClick={() => save.mutate({ action: "category", categoryId: category.id, name: category.name, active: !category.active })}
              >
                {category.active ? "Pausar categoria" : "Ativar categoria"}
              </button>
            </div>
            <div className="food-dishes">
            {items.map((item) => {
              const index = categoryItems.findIndex((row) => row.id === item.id);
              return (
              <article key={item.id} className={item.available ? "food-dish" : "food-dish is-paused"}>
                <button type="button" className="food-dish__photo" onClick={() => setEditing(item)}>
                  {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span>{item.emoji || item.name.slice(0, 1)}</span>}
                  {item.available ? null : <em>Pausado</em>}
                </button>
                <div className="food-dish__copy">
                  <strong>{item.name}</strong>
                  <span>{brl(item.priceCents)}</span>
                  {item.description ? <p>{item.description}</p> : null}
                </div>
                <div className="food-dish__actions">
                  <button type="button" className="food-button ghost" disabled={index === 0} onClick={() => {
                    const ordered = categoryItems.map((row, rowIndex) => ({ id: row.id, sortOrder: rowIndex === index ? index - 1 : rowIndex === index - 1 ? index : rowIndex }));
                    save.mutate({ action: "reorder", items: ordered });
                  }}>Subir</button>
                  <button type="button" className="food-button ghost" onClick={() => save.mutate({ action: "item", itemId: item.id, categoryId: item.categoryId, name: item.name, description: item.description, priceCents: item.priceCents, imageUrl: item.imageUrl, ingredients: item.ingredients ?? [], available: !item.available, schedule: item.schedule, groups: item.groups })}>
                    {item.available ? "Pausar" : "À venda"}
                  </button>
                  <button type="button" className="food-button" onClick={() => setEditing(item)}>Editar</button>
                </div>
              </article>
              );
            })}
            </div>
          </section>
        );
      })}
      {store ? <HoursEditor hours={store.hours ?? {}} onSave={(hours) => save.mutate({ action: "hours", hours })} /> : null}
    </section>
  );
}

const DAY_NAMES: Record<string, string> = {
  "1": "Segunda",
  "2": "Terça",
  "3": "Quarta",
  "4": "Quinta",
  "5": "Sexta",
  "6": "Sábado",
  "0": "Domingo",
};
const DAY_SHORT: Record<string, string> = {
  "1": "Seg",
  "2": "Ter",
  "3": "Qua",
  "4": "Qui",
  "5": "Sex",
  "6": "Sáb",
  "0": "Dom",
};
const DAY_ORDER = ["1", "2", "3", "4", "5", "6", "0"];

type Slot = { start: string; end: string };

function validSlot(slot: Slot) {
  return /^\d{2}:\d{2}$/.test(slot.start) && /^\d{2}:\d{2}$/.test(slot.end) && slot.end > slot.start;
}

const CLOCK_HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
const CLOCK_MINUTES = ["00", "15", "30", "45"];

function ClockField({ value, label, onChange }: { value: string; label: string; onChange: (value: string) => void }) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  const hour = match?.[1] ?? "11";
  const minute = match?.[2] ?? "00";
  const minutes = CLOCK_MINUTES.includes(minute) ? CLOCK_MINUTES : [...CLOCK_MINUTES, minute].sort();
  return (
    <span className="food-clock" role="group" aria-label={label}>
      <select aria-label={`${label}, hora`} value={CLOCK_HOURS.includes(hour) ? hour : "11"} onChange={(event) => onChange(`${event.target.value}:${minute}`)}>
        {CLOCK_HOURS.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <span aria-hidden="true">:</span>
      <select aria-label={`${label}, minuto`} value={minute} onChange={(event) => onChange(`${hour}:${event.target.value}`)}>
        {minutes.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </span>
  );
}

function blankWeek(): Record<string, Slot[]> {
  return Object.fromEntries(DAY_ORDER.map((key) => [key, key === "0" ? [] : [{ start: "11:00", end: "23:00" }]]));
}

function weekFrom(hours: Store["hours"]) {
  return Object.fromEntries(DAY_ORDER.map((key) => [key, (hours[key] ?? []).map((slot) => ({ ...slot }))]));
}

function hoursSummary(draft: Record<string, Slot[]>) {
  const groups: Array<{ start: string; end: string; text: string }> = [];
  for (const key of DAY_ORDER) {
    const slots = (draft[key] ?? []).filter(validSlot);
    const text = slots.length ? slots.map((slot) => `${slot.start}–${slot.end}`).join(" e ") : "fechado";
    const last = groups.at(-1);
    const follows = last ? DAY_ORDER.indexOf(key) === DAY_ORDER.indexOf(last.end) + 1 : false;
    if (last && follows && last.text === text) last.end = key;
    else groups.push({ start: key, end: key, text });
  }
  return groups
    .map((group) => {
      const days = group.start === group.end ? DAY_SHORT[group.start] : `${DAY_SHORT[group.start]}–${DAY_SHORT[group.end]}`;
      return `${days} ${group.text}`;
    })
    .join(" · ");
}

function HoursEditor({ hours, onSave }: { hours: Store["hours"]; onSave: (hours: Store["hours"]) => void }) {
  const signature = JSON.stringify(hours ?? {});
  const [custom, setCustom] = useState(() => Object.values(hours ?? {}).some((slots) => slots?.length));
  const [draft, setDraft] = useState<Record<string, Slot[]>>(() => (custom ? weekFrom(hours) : blankWeek()));
  const [hint, setHint] = useState("");

  useEffect(() => {
    const parsed = JSON.parse(signature) as Store["hours"];
    const hasHours = Object.values(parsed).some((slots) => slots?.length);
    setCustom(hasHours);
    setDraft(hasHours ? weekFrom(parsed) : blankWeek());
    setHint("");
  }, [signature]);

  function updateDay(key: string, slots: Slot[]) {
    setDraft((current) => ({ ...current, [key]: slots }));
    setHint("");
  }

  function save() {
    if (!custom) {
      onSave({});
      return;
    }
    const next: Store["hours"] = {};
    for (const key of DAY_ORDER) {
      const slots = (draft[key] ?? []).filter(validSlot);
      if (slots.length) next[key] = slots;
    }
    if (!Object.keys(next).length) {
      setHint("Abra pelo menos um dia, ou escolha o dia todo.");
      return;
    }
    onSave(next);
  }

  return (
    <section className="food-panel food-hours">
      <h2>Horário da loja</h2>
      <p className="food-muted">O cardápio só recebe pedido dentro deste horário.</p>
      <div className="food-hours__modes">
        <button type="button" className={custom ? "" : "is-on"} onClick={() => { setCustom(false); setHint(""); }}>
          <strong>O dia todo</strong>
          <span>Enquanto a loja estiver aceitando pedidos</span>
        </button>
        <button type="button" className={custom ? "is-on" : ""} onClick={() => { setCustom(true); setHint(""); }}>
          <strong>Horário da casa</strong>
          <span>Cada dia aberto, fechado ou com dois turnos</span>
        </button>
      </div>
      {custom ? (
        <div className="food-hours__days">
          {DAY_ORDER.map((key) => {
            const slots = draft[key] ?? [];
            const open = slots.length > 0;
            return (
              <div key={key} className={open ? "food-hours__day is-open" : "food-hours__day"}>
                <button
                  type="button"
                  className="food-hours__toggle"
                  aria-pressed={open}
                  onClick={() => updateDay(key, open ? [] : [{ start: "11:00", end: "23:00" }])}
                >
                  <span>{DAY_NAMES[key]}</span>
                  <strong>{open ? "Aberto" : "Fechado"}</strong>
                </button>
                {open ? (
                  <div className="food-hours__slots">
                    {slots.map((slot, index) => (
                      <div key={index} className="food-hours__slot">
                        <ClockField
                          label={`${DAY_NAMES[key]} começa`}
                          value={slot.start}
                          onChange={(start) => updateDay(key, slots.map((row, rowIndex) => rowIndex === index ? { ...row, start } : row))}
                        />
                        <span>até</span>
                        <ClockField
                          label={`${DAY_NAMES[key]} termina`}
                          value={slot.end}
                          onChange={(end) => updateDay(key, slots.map((row, rowIndex) => rowIndex === index ? { ...row, end } : row))}
                        />
                        {index > 0 ? (
                          <button type="button" className="food-hours__remove" onClick={() => updateDay(key, slots.filter((_, rowIndex) => rowIndex !== index))}>
                            Tirar turno
                          </button>
                        ) : null}
                        {!validSlot(slot) ? <em>O fim precisa ser depois do início</em> : null}
                      </div>
                    ))}
                    <div className="food-hours__tools">
                      {slots.length < 2 ? (
                        <button type="button" className="food-hours__add" onClick={() => {
                          const first = slots[0];
                          if (first && first.end > "17:00") {
                            updateDay(key, [
                              { start: first.start, end: "15:00" },
                              { start: "18:00", end: first.end > "18:00" ? first.end : "23:00" },
                            ]);
                            return;
                          }
                          updateDay(key, [...slots, { start: "18:00", end: "23:00" }]);
                        }}>
                          + outro turno
                        </button>
                      ) : null}
                      {key === "1" ? (
                        <button type="button" className="food-hours__add" onClick={() => {
                          const monday = draft["1"] ?? [];
                          setDraft(Object.fromEntries(DAY_ORDER.map((day) => [day, monday.map((slot) => ({ ...slot }))])));
                          setHint("");
                        }}>
                          Copiar segunda para todos os dias
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : <p className="food-hours__closed">Não recebe pedido neste dia</p>}
              </div>
            );
          })}
          <p className="food-hours__summary">{hoursSummary(draft)}</p>
        </div>
      ) : (
        <p className="food-hours__summary">Aberto todos os dias, o tempo todo, enquanto a loja aceitar pedidos.</p>
      )}
      {hint ? <p className="food-muted">{hint}</p> : null}
      <button type="button" className="food-button" onClick={save}>Salvar horário</button>
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

  useEffect(() => {
    document.querySelector(".food-editor")?.scrollIntoView({ block: "start" });
  }, []);

  return (
    <form
      className="food-form food-editor"
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
      <div className="food-photo-field">
        {imageUrl ? <img src={imageUrl} alt="" /> : <span>Sem foto</span>}
        <label className="food-button ghost">
          {imageUrl ? "Trocar foto" : "Enviar foto"}
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
        </label>
      </div>
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
          <div className="food-row">
            <input aria-label="Mínimo" value={group.minSelect} onChange={(event) => setGroups(groups.map((row, rowIndex) => rowIndex === index ? { ...row, minSelect: Number(event.target.value) || 0 } : row))} />
            <input aria-label="Máximo" value={group.maxSelect} onChange={(event) => setGroups(groups.map((row, rowIndex) => rowIndex === index ? { ...row, maxSelect: Number(event.target.value) || 1 } : row))} />
          </div>
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
