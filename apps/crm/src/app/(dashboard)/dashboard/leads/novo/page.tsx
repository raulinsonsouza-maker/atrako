import Link from "next/link";
import { getDashboardContext } from "@/lib/dashboard-context";
import { createLeadFromForm } from "@/server/actions/lead";
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from "@/design/components";
import { ArrowLeft } from "lucide-react";
import type { LeadSource } from "@prisma/client";

const SOURCES: { value: LeadSource; label: string }[] = [
  { value: "MANUAL", label: "Manual" },
  { value: "META", label: "Meta" },
  { value: "GOOGLE", label: "Google" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "OUTROS", label: "Outros" },
];

export default async function NovoLeadPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | undefined }>;
}) {
  const { tenantId } = await getDashboardContext();

  const params = await searchParams;

  return (
    <div className="max-w-md space-y-4">
      <Link href="/dashboard/leads" className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>
      <Card>
          <CardHeader>
            <CardTitle>Cadastrar lead</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createLeadFromForm} className="space-y-4">
              <Input label="Nome" name="name" required />
              <Input label="E-mail" name="email" type="email" required />
              <Input label="Telefone" name="phone" type="tel" />
              <Input label="Campanha (opcional)" name="campaign" placeholder="ex: black-friday" />
              <Input label="Anúncio (opcional)" name="ad" placeholder="ex: anúncio-1" />
              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Origem</label>
                <select name="source" className="w-full rounded-sm border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100" defaultValue={params.source ?? "MANUAL"}>
                  {SOURCES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit">Salvar</Button>
            </form>
          </CardContent>
        </Card>
    </div>
  );
}
