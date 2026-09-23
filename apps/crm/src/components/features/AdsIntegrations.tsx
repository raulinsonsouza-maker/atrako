"use client";

import { useState, useEffect } from "react";
import {
  getMetaIntegration,
  saveMetaIntegration,
  getGoogleIntegration,
  saveGoogleIntegration,
  runAdsSync,
} from "@/server/actions/integration";
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from "@/design/components";

export function AdsIntegrations({ tenantId }: { tenantId: string }) {
  const [metaToken, setMetaToken] = useState("");
  const [metaPageId, setMetaPageId] = useState("");
  const [googleCustomerId, setGoogleCustomerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingMeta, setSavingMeta] = useState(false);
  const [savingGoogle, setSavingGoogle] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getMetaIntegration(tenantId), getGoogleIntegration(tenantId)])
      .then(([m, g]) => {
        const mc = (m?.config || {}) as { accessToken?: string; pageId?: string };
        const gc = (g?.config || {}) as { customerId?: string };
        setMetaToken(mc.accessToken || "");
        setMetaPageId(mc.pageId || "");
        setGoogleCustomerId(gc.customerId || "");
      })
      .finally(() => setLoading(false));
  }, [tenantId]);

  async function onSaveMeta(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSavingMeta(true);
    try {
      await saveMetaIntegration(tenantId, { accessToken: metaToken, pageId: metaPageId });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setSavingMeta(false);
    }
  }

  async function onSaveGoogle(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSavingGoogle(true);
    try {
      await saveGoogleIntegration(tenantId, { customerId: googleCustomerId });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setSavingGoogle(false);
    }
  }

  async function onSync() {
    setErr(null);
    setSyncResult(null);
    setSyncing(true);
    try {
      const r = await runAdsSync(tenantId);
      setSyncResult(`Meta: ${r.meta} novos. Google: ${r.google} novos.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao sincronizar");
    } finally {
      setSyncing(false);
    }
  }

  if (loading) return <p className="text-neutral-500">Carregando…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Campanhas e leads</h2>
        <Button onClick={onSync} disabled={syncing} variant="outline">
          {syncing ? "Sincronizando…" : "Sincronizar agora"}
        </Button>
      </div>
      {syncResult && <p className="text-sm text-neutral-600">{syncResult}</p>}
      {err && <p className="text-sm text-error-600">{err}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Meta (Facebook / Instagram Lead Ads)</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSaveMeta} className="space-y-4">
              <Input
                label="Token de acesso (página, long-lived)"
                type="password"
                value={metaToken}
                onChange={(e) => setMetaToken(e.target.value)}
              />
              <Input
                label="Page ID"
                value={metaPageId}
                onChange={(e) => setMetaPageId(e.target.value)}
                placeholder="123456789"
              />
              <Button type="submit" isLoading={savingMeta}>
                Conectar
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Google Ads</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSaveGoogle} className="space-y-4">
              <Input
                label="Customer ID (opcional)"
                value={googleCustomerId}
                onChange={(e) => setGoogleCustomerId(e.target.value)}
                placeholder="123-456-7890"
              />
              <Button type="submit" isLoading={savingGoogle}>
                Salvar
              </Button>
              <p className="text-sm text-neutral-500">
                OAuth e importação de Lead Form Extensions em versão futura.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
