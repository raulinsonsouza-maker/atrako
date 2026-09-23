"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateTenantBranding } from "@/server/actions/tenant";
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from "@/design/components";

export function BrandingSection({
  tenantId,
  initialName,
  initialLogoUrl,
}: {
  tenantId: string;
  initialName: string;
  initialLogoUrl: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Nome é obrigatório.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await updateTenantBranding(tenantId, {
        name: trimmedName,
        logoUrl: logoUrl.trim() || null,
      });
      setSuccess(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Marca / Identidade</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Nome e logo exibidos no menu lateral do CRM.
        </p>
        <Input
          label="Nome exibido no CRM"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Minha Empresa"
        />
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            URL do logo
          </label>
          <input
            type="url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-sm border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
          />
          <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
            Recomendado: 120×40 px (logo horizontal) ou 40×40 px (ícone). PNG, JPG ou SVG, máx. 500 KB. O logo aparece no menu lateral.
          </p>
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {success && <p className="text-sm text-green-600 dark:text-green-400">Salvo com sucesso.</p>}
        <Button onClick={handleSave} isLoading={saving} disabled={saving}>
          Salvar
        </Button>
      </CardContent>
    </Card>
  );
}
