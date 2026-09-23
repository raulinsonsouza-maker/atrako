"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { slugify } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

export default function NewProductPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function onNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const priceBrl = String(form.get("priceBrl") ?? "0").replace(",", ".");
    const priceCents = Math.round(parseFloat(priceBrl || "0") * 100);
    const maxInstallmentsRaw = String(form.get("maxInstallments") ?? "").trim();

    const res = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(form.get("name") ?? ""),
        slug: String(form.get("slug") ?? ""),
        description: String(form.get("description") ?? "") || null,
        type: String(form.get("type") ?? "FILE"),
        priceCents,
        maxInstallments: maxInstallmentsRaw ? Number(maxInstallmentsRaw) : null,
        status: String(form.get("status") ?? "DRAFT"),
      }),
    });

    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Falha ao criar produto.");
      return;
    }
    router.push(`/admin/produtos/${data.id}`);
    router.refresh();
  }

  return (
    <div className="stack-lg">
      <PageHeader title="Novo produto" description="Cadastre um produto digital." />
      <Panel className="max-w-xl">
        {error ? <Alert tone="danger" className="mb-4">{error}</Alert> : null}
        <form onSubmit={onSubmit} className="stack">
          <Field label="Nome" htmlFor="name">
            <Input
              id="name"
              name="name"
              required
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
            />
          </Field>
          <Field label="Slug" htmlFor="slug" hint="Usado na URL de vendas (/p/slug).">
            <Input
              id="slug"
              name="slug"
              required
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
            />
          </Field>
          <Field label="Descrição" htmlFor="description">
            <Textarea id="description" name="description" rows={4} />
          </Field>
          <Field label="Tipo" htmlFor="type">
            <Select id="type" name="type" defaultValue="FILE">
              <option value="FILE">Arquivo</option>
              <option value="COURSE">Curso</option>
              <option value="BUNDLE">Bundle</option>
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
              placeholder="97.00"
            />
          </Field>
          <Field label="Máx. parcelas" htmlFor="maxInstallments">
            <Input id="maxInstallments" name="maxInstallments" type="number" min="1" max="24" />
          </Field>
          <Field label="Status" htmlFor="status">
            <Select id="status" name="status" defaultValue="DRAFT">
              <option value="DRAFT">Rascunho</option>
              <option value="PUBLISHED">Publicado</option>
            </Select>
          </Field>
          <Button type="submit" disabled={loading}>
            {loading ? "Salvando…" : "Criar produto"}
          </Button>
        </form>
      </Panel>
    </div>
  );
}
