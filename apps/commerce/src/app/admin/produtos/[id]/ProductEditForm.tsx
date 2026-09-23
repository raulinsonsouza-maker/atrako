"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { slugify } from "@/lib/utils";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { SectionPanel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";

type SalesPage = {
  headline?: string;
  subheadline?: string;
  bullets?: string[];
  faq?: Array<{ q: string; a: string }>;
};

type FileRow = { id: string; name: string; sizeBytes: number; mimeType: string | null };
type LessonRow = { id: string; title: string; position: number; bunnyVideoId: string | null };
type ModuleRow = {
  id: string;
  title: string;
  position: number;
  lessons: LessonRow[];
};

type ProductEditProps = {
  product: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    type: string;
    status: string;
    priceCents: number;
    maxInstallments: number | null;
    salesPage: SalesPage | null;
  };
  files: FileRow[];
  modules: ModuleRow[];
};

export function ProductEditForm({ product, files, modules }: ProductEditProps) {
  const router = useRouter();
  const sales = product.salesPage ?? {};
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [moduleTitle, setModuleTitle] = useState("");
  const [lessonTitles, setLessonTitles] = useState<Record<string, string>>({});

  const initialFaq = useMemo(
    () =>
      (sales.faq ?? [])
        .map((f) => `${f.q}|${f.a}`)
        .join("\n"),
    [sales.faq],
  );

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const priceBrl = String(form.get("priceBrl") ?? "0").replace(",", ".");
    const priceCents = Math.round(parseFloat(priceBrl || "0") * 100);
    const maxInstallmentsRaw = String(form.get("maxInstallments") ?? "").trim();
    const bullets = String(form.get("bullets") ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const faq = String(form.get("faq") ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const [q, ...rest] = line.split("|");
        return { q: (q ?? "").trim(), a: rest.join("|").trim() };
      })
      .filter((f) => f.q);

    const res = await fetch(`/api/admin/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(form.get("name") ?? ""),
        slug: slugify(String(form.get("slug") ?? "")),
        description: String(form.get("description") ?? "") || null,
        type: String(form.get("type") ?? "FILE"),
        priceCents,
        maxInstallments: maxInstallmentsRaw ? Number(maxInstallmentsRaw) : null,
        status: String(form.get("status") ?? "DRAFT"),
        salesPage: {
          headline: String(form.get("headline") ?? ""),
          subheadline: String(form.get("subheadline") ?? ""),
          bullets,
          faq,
        },
      }),
    });

    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Falha ao salvar.");
      return;
    }
    setOk("Produto atualizado.");
    router.refresh();
  }

  async function handleAddModule() {
    if (!moduleTitle.trim()) return;
    const res = await fetch(`/api/admin/products/${product.id}/modules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: moduleTitle.trim() }),
    });
    if (res.ok) {
      setModuleTitle("");
      router.refresh();
    }
  }

  async function createLesson(moduleId: string) {
    const title = (lessonTitles[moduleId] ?? "").trim();
    if (!title) return;
    const res = await fetch(`/api/admin/modules/${moduleId}/lessons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      setLessonTitles((prev) => ({ ...prev, [moduleId]: "" }));
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="stack-lg">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {ok ? <Alert tone="success">{ok}</Alert> : null}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <SectionPanel title="Identidade" code="A1">
          <div className="stack">
            <Field label="Nome" htmlFor="name">
              <Input id="name" name="name" required defaultValue={product.name} />
            </Field>
            <Field label="Slug" htmlFor="slug" hint="URL pública /p/slug">
              <Input id="slug" name="slug" required defaultValue={product.slug} />
            </Field>
            <Field label="Descrição" htmlFor="description">
              <Textarea
                id="description"
                name="description"
                defaultValue={product.description ?? ""}
                rows={5}
              />
            </Field>
          </div>
        </SectionPanel>

        <SectionPanel title="Comercial" code="A2">
          <div className="stack">
            <Field label="Tipo" htmlFor="type">
              <Select id="type" name="type" defaultValue={product.type}>
                <option value="FILE">Arquivo</option>
                <option value="COURSE">Curso</option>
                <option value="BUNDLE">Bundle</option>
              </Select>
            </Field>
            <Field label="Status" htmlFor="status">
              <Select id="status" name="status" defaultValue={product.status}>
                <option value="DRAFT">Rascunho</option>
                <option value="PUBLISHED">Publicado</option>
              </Select>
            </Field>
            <Field label="Preço (R$)" htmlFor="priceBrl">
              <Input
                id="priceBrl"
                name="priceBrl"
                type="number"
                step="0.01"
                min="0"
                required
                defaultValue={(product.priceCents / 100).toFixed(2)}
              />
            </Field>
            <Field label="Máx. parcelas" htmlFor="maxInstallments">
              <Input
                id="maxInstallments"
                name="maxInstallments"
                type="number"
                min="1"
                max="24"
                defaultValue={product.maxInstallments ?? ""}
              />
            </Field>
          </div>
        </SectionPanel>
      </div>

      <SectionPanel title="Página de vendas" code="B1">
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Headline" htmlFor="headline">
            <Input id="headline" name="headline" defaultValue={sales.headline ?? ""} />
          </Field>
          <Field label="Subheadline" htmlFor="subheadline">
            <Input id="subheadline" name="subheadline" defaultValue={sales.subheadline ?? ""} />
          </Field>
          <Field label="Bullets" htmlFor="bullets" hint="Um por linha.">
            <Textarea
              id="bullets"
              name="bullets"
              defaultValue={(sales.bullets ?? []).join("\n")}
              rows={6}
            />
          </Field>
          <Field
            label="FAQ"
            htmlFor="faq"
            hint="Formato: pergunta|resposta (uma por linha)"
          >
            <Textarea id="faq" name="faq" defaultValue={initialFaq} rows={6} />
          </Field>
        </div>
      </SectionPanel>

      <div className="cluster justify-between items-center border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-2">
        <p className="m-0 text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
          Salvar alterações
        </p>
        <Button type="submit" disabled={loading}>
          {loading ? "Salvando…" : "Salvar produto"}
        </Button>
      </div>

      <SectionPanel title="Arquivos" code="C1">
        {files.length === 0 ? (
          <p className="m-0 text-[var(--muted)] text-[var(--text-sm)]">
            Nenhum arquivo anexado. Configure R2 para upload em produção.
          </p>
        ) : (
          <ul className="m-0 p-0 list-none stack-sm">
            {files.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between gap-3 border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-3"
              >
                <span className="text-[var(--text-sm)] font-medium">{f.name}</span>
                <Badge>
                  {f.mimeType ?? "arquivo"} · {(f.sizeBytes / 1024).toFixed(0)} KB
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </SectionPanel>

      {product.type === "COURSE" ? (
        <SectionPanel title="Módulos e aulas" code="C2">
          <div className="cluster items-end gap-3 mb-4">
            <Field label="Novo módulo" htmlFor="moduleTitle" className="flex-1">
              <Input
                id="moduleTitle"
                value={moduleTitle}
                onChange={(e) => setModuleTitle(e.target.value)}
                placeholder="Ex.: Introdução"
              />
            </Field>
            <Button type="button" onClick={() => void handleAddModule()}>
              Adicionar módulo
            </Button>
          </div>

          {modules.length === 0 ? (
            <p className="m-0 text-[var(--muted)] text-[var(--text-sm)]">Nenhum módulo ainda.</p>
          ) : (
            <div className="stack">
              {modules.map((mod, index) => (
                <div
                  key={mod.id}
                  className="border border-[var(--border)] bg-[var(--bg-muted)] p-4 stack"
                >
                  <div className="cluster justify-between">
                    <div className="cluster gap-3">
                      <span className="text-[10px] font-bold tracking-[0.16em] text-[var(--muted)]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <strong className="uppercase tracking-wide text-[var(--text-sm)]">
                        {mod.title}
                      </strong>
                    </div>
                    <Badge>{mod.lessons.length} aulas</Badge>
                  </div>
                  {mod.lessons.length > 0 ? (
                    <ul className="m-0 p-0 list-none stack-sm">
                      {mod.lessons.map((lesson, li) => (
                        <li
                          key={lesson.id}
                          className="flex items-center gap-3 border border-[var(--border)] px-3 py-2 text-[var(--text-sm)]"
                        >
                          <span className="text-[var(--muted)] text-[10px] font-bold tracking-widest">
                            {String(li + 1).padStart(2, "0")}
                          </span>
                          <span>{lesson.title}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="cluster items-end gap-2">
                    <Field label="Nova aula" htmlFor={`lesson-${mod.id}`} className="flex-1">
                      <Input
                        id={`lesson-${mod.id}`}
                        value={lessonTitles[mod.id] ?? ""}
                        onChange={(e) =>
                          setLessonTitles((prev) => ({ ...prev, [mod.id]: e.target.value }))
                        }
                        placeholder="Título da aula"
                      />
                    </Field>
                    <Button type="button" variant="secondary" onClick={() => createLesson(mod.id)}>
                      Adicionar aula
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionPanel>
      ) : null}
    </form>
  );
}
