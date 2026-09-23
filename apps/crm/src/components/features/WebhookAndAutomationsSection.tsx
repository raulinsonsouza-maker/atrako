"use client";

import { useState, useEffect } from "react";
import { getTenantConfig, saveTenantConfig } from "@/server/actions/tenant";
import { listUsers } from "@/server/actions/lead";
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from "@/design/components";

export function WebhookAndAutomationsSection({ tenantId }: { tenantId: string }) {
  const [webhookApiKey, setWebhookApiKey] = useState("");
  const [autoAssignUserId, setAutoAssignUserId] = useState<string>("");
  const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getTenantConfig(tenantId), listUsers(tenantId)])
      .then(([cfg, u]) => {
        setWebhookApiKey((cfg as { webhookApiKey?: string }).webhookApiKey || "");
        setAutoAssignUserId((cfg as { autoAssignUserId?: string }).autoAssignUserId || "");
        setUsers(u);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erro"))
      .finally(() => setLoading(false));
  }, [tenantId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setSaving(true);
    try {
      await saveTenantConfig(tenantId, {
        webhookApiKey: webhookApiKey.trim() || undefined,
        autoAssignUserId: autoAssignUserId || null,
      });
      setOk("Salvo.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-neutral-500">Carregando…</p>;

  const base = typeof window !== "undefined" ? window.location.origin : "";
  const webhookUrl = `${base}/api/webhooks/leads`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Webhook de leads e automações</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6">
          <div>
            <h4 className="mb-2 text-sm font-semibold text-neutral-800 dark:text-neutral-200">Webhook para LP / Meta / Google</h4>
            <p className="mb-3 text-sm text-neutral-600 dark:text-neutral-400">
              Use a URL abaixo na sua LP ou integração. Envie <strong>X-Api-Key</strong> (ou <code className="rounded bg-neutral-100 dark:bg-neutral-800 px-1">apiKey</code> no body) e JSON:{" "}
              <code className="rounded bg-neutral-100 dark:bg-neutral-800 px-1">name, phone?, email, origin?, campaign?, ad?, utm_source?, utm_medium?, utm_campaign?</code>. Deduplicação por telefone.
            </p>
            <p className="mb-2 font-mono text-xs text-neutral-500 break-all">{webhookUrl}</p>
            <Input
              label="Chave da API (webhookApiKey)"
              type="password"
              value={webhookApiKey}
              onChange={(e) => setWebhookApiKey(e.target.value)}
              placeholder="Gere uma chave segura e cole aqui"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Atribuir novos leads a</label>
            <select
              value={autoAssignUserId}
              onChange={(e) => setAutoAssignUserId(e.target.value)}
              className="w-full rounded-sm border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
            >
              <option value="">— Nenhum (atribuir manualmente)</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Aplica a leads do webhook, Meta, Google e cadastro manual.</p>
          </div>
          {error && <p className="text-sm text-error-600">{error}</p>}
          {ok && <p className="text-sm text-success-600 dark:text-green-400">{ok}</p>}
          <Button type="submit" isLoading={saving}>Salvar</Button>
        </form>
      </CardContent>
    </Card>
  );
}
