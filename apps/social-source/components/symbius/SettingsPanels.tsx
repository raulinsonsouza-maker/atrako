"use client";

import { useEffect, useState } from "react";
import { useSymbiusToast } from "@/components/symbius/useSymbiusToast";

export function TagsSettingsPanel() {
  const [tags, setTags] = useState<Array<{ id: string; nome: string }>>([]);
  const [nome, setNome] = useState("");

  async function load() {
    const res = await fetch("/api/symbius/tags");
    const d = await res.json();
    setTags(d.tags ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function addTag() {
    if (!nome.trim()) return;
    await fetch("/api/symbius/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: nome.trim() }),
    });
    setNome("");
    void load();
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6">
      <h2 className="text-xl font-bold">Tags</h2>
      <p className="mt-2 text-sm text-zinc-500">
        Defina tags para usar em automações, segmentos e filtros de contatos.
      </p>
      <div className="mt-4 flex gap-2">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nova tag"
          className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
        <button type="button" onClick={() => void addTag()} className="symbius-btn-primary px-4 py-2 text-sm">
          Adicionar
        </button>
      </div>
      <ul className="mt-4 space-y-2">
        {tags.map((t) => (
          <li key={t.id} className="flex items-center justify-between rounded-lg border border-zinc-100 px-3 py-2 text-sm">
            <span>{t.nome}</span>
            <button
              type="button"
              className="text-xs text-red-600"
              onClick={() =>
                void fetch(`/api/symbius/tags?id=${t.id}`, { method: "DELETE" }).then(
                  () => load(),
                )
              }
            >
              Remover
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MembersSettingsPanel() {
  const [members, setMembers] = useState<Array<{ id: string; email: string; nome: string; role: string }>>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("AGENT");

  async function load() {
    const res = await fetch("/api/symbius/members");
    const d = await res.json();
    setMembers(d.members ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function invite() {
    await fetch("/api/symbius/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    setEmail("");
    void load();
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6">
      <h2 className="text-xl font-bold">Membros da equipe</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail do convite"
          className="min-w-[200px] flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        >
          <option value="AGENT">Agente</option>
          <option value="ADMIN">Admin</option>
        </select>
        <button type="button" onClick={() => void invite()} className="symbius-btn-primary px-4 py-2 text-sm">
          Convidar
        </button>
      </div>
      <ul className="mt-4 space-y-2">
        {members.map((m) => (
          <li key={m.id} className="rounded-lg border border-zinc-100 px-3 py-2 text-sm">
            <span className="font-medium">{m.nome}</span>
            <span className="text-zinc-500"> · {m.email} · {m.role}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function IntegrationsSettingsPanel() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [syncCentralCrm, setSyncCentralCrm] = useState(false);
  const [googleSheetId, setGoogleSheetId] = useState("");
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [snippet, setSnippet] = useState<string | null>(null);
  const [metaPixelId, setMetaPixelId] = useState("");
  const [metaCapiToken, setMetaCapiToken] = useState("");
  const [ga4MeasurementId, setGa4MeasurementId] = useState("");
  const [ga4ApiSecret, setGa4ApiSecret] = useState("");
  const [shopifySecret, setShopifySecret] = useState("");
  const [traySecret, setTraySecret] = useState("");
  const [nuvemshopSecret, setNuvemshopSecret] = useState("");
  const { show, Toast } = useSymbiusToast();

  useEffect(() => {
    void fetch("/api/symbius/integrations")
      .then((r) => r.json())
      .then((d) => {
        setWebhookUrl(d.settings?.webhookUrl ?? "");
        setSyncCentralCrm(Boolean(d.settings?.syncCentralCrm));
        setGoogleSheetId(d.settings?.googleSheetId ?? "");
        setSnippet(d.trackingSnippet ?? null);
        setMetaPixelId(d.settings?.metaPixelId ?? "");
        setGa4MeasurementId(d.settings?.ga4MeasurementId ?? "");
        setMetaCapiToken(d.settings?.hasMetaCapiToken ? "••••••••" : "");
        setGa4ApiSecret(d.settings?.hasGa4ApiSecret ? "••••••••" : "");
        const ec = d.settings?.ecommerceConnectors ?? {};
        setShopifySecret(ec.shopify?.webhookSecret ? "••••••••" : "");
        setTraySecret(ec.tray?.webhookSecret ? "••••••••" : "");
        setNuvemshopSecret(ec.nuvemshop?.webhookSecret ? "••••••••" : "");
      });
  }, []);

  async function save() {
    const ecommerceConnectors: Record<string, { webhookSecret?: string }> = {};
    if (shopifySecret && !shopifySecret.startsWith("••")) {
      ecommerceConnectors.shopify = { webhookSecret: shopifySecret };
    }
    if (traySecret && !traySecret.startsWith("••")) {
      ecommerceConnectors.tray = { webhookSecret: traySecret };
    }
    if (nuvemshopSecret && !nuvemshopSecret.startsWith("••")) {
      ecommerceConnectors.nuvemshop = { webhookSecret: nuvemshopSecret };
    }

    const res = await fetch("/api/symbius/integrations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        webhookUrl: webhookUrl || null,
        syncCentralCrm,
        googleSheetId,
        metaPixelId: metaPixelId || null,
        metaCapiToken:
          metaCapiToken && !metaCapiToken.startsWith("••")
            ? metaCapiToken
            : undefined,
        ga4MeasurementId: ga4MeasurementId || null,
        ga4ApiSecret:
          ga4ApiSecret && !ga4ApiSecret.startsWith("••")
            ? ga4ApiSecret
            : undefined,
        ...(Object.keys(ecommerceConnectors).length
          ? { ecommerceConnectors }
          : {}),
      }),
    });
    if (!res.ok) {
      show("Falha ao salvar integrações", "error");
      return;
    }
    const refreshed = await fetch("/api/symbius/integrations").then((r) =>
      r.json(),
    );
    setSnippet(refreshed.trackingSnippet ?? null);
    setMetaCapiToken(refreshed.settings?.hasMetaCapiToken ? "••••••••" : "");
    setGa4ApiSecret(refreshed.settings?.hasGa4ApiSecret ? "••••••••" : "");
    show("Integrações salvas", "success");
  }

  async function genKey() {
    const res = await fetch("/api/symbius/integrations", { method: "POST" });
    const d = await res.json();
    if (!res.ok) {
      show("Falha ao gerar API key", "error");
      return;
    }
    setApiKey(d.apiKey);
    const refreshed = await fetch("/api/symbius/integrations").then((r) =>
      r.json(),
    );
    setSnippet(refreshed.trackingSnippet ?? null);
    show("API key gerada", "success");
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-4">
      {Toast}
      <h2 className="text-xl font-bold">Integrações & Attribution</h2>
      <label className="block text-sm">
        <span className="text-zinc-500">Webhook outbound</span>
        <input
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2"
          placeholder="https://..."
        />
      </label>
      <label className="block text-sm">
        <span className="text-zinc-500">Google Sheet ID</span>
        <input
          value={googleSheetId}
          onChange={(e) => setGoogleSheetId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={syncCentralCrm}
          onChange={(e) => setSyncCentralCrm(e.target.checked)}
        />
        Sync leads/pedidos com Central CRM
      </label>

      <div className="border-t border-zinc-100 pt-4 space-y-3">
        <h3 className="font-semibold">Symbius Tracker (landing)</h3>
        <p className="text-xs text-zinc-500">
          Cole o snippet na landing. Endpoints: POST /api/v1/identify, /api/v1/events, /api/v1/purchases
        </p>
        {snippet ? (
          <pre className="overflow-x-auto rounded-lg bg-zinc-50 p-3 text-xs text-zinc-800 whitespace-pre-wrap">
            {snippet}
          </pre>
        ) : (
          <p className="text-sm text-amber-700">Gere uma API key para obter o snippet.</p>
        )}
      </div>

      <div className="border-t border-zinc-100 pt-4 space-y-3">
        <h3 className="font-semibold">Meta CAPI / GA4</h3>
        <input
          value={metaPixelId}
          onChange={(e) => setMetaPixelId(e.target.value)}
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          placeholder="Meta Pixel ID"
        />
        <input
          value={metaCapiToken}
          onChange={(e) => setMetaCapiToken(e.target.value)}
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          placeholder="Meta CAPI access token"
        />
        <input
          value={ga4MeasurementId}
          onChange={(e) => setGa4MeasurementId(e.target.value)}
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          placeholder="GA4 Measurement ID (G-...)"
        />
        <input
          value={ga4ApiSecret}
          onChange={(e) => setGa4ApiSecret(e.target.value)}
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          placeholder="GA4 API Secret"
        />
      </div>

      <div className="border-t border-zinc-100 pt-4 space-y-3">
        <h3 className="font-semibold">Webhooks e-commerce</h3>
        <p className="text-xs text-zinc-500">
          Shopify: /api/v1/connectors/shopify · Tray: /api/v1/connectors/tray · Nuvemshop: /api/v1/connectors/nuvemshop
        </p>
        <input
          value={shopifySecret}
          onChange={(e) => setShopifySecret(e.target.value)}
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          placeholder="Shopify webhook secret"
        />
        <input
          value={traySecret}
          onChange={(e) => setTraySecret(e.target.value)}
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          placeholder="Tray webhook secret"
        />
        <input
          value={nuvemshopSecret}
          onChange={(e) => setNuvemshopSecret(e.target.value)}
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          placeholder="Nuvemshop webhook secret"
        />
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => void save()} className="symbius-btn-primary px-4 py-2 text-sm">
          Salvar
        </button>
        <button type="button" onClick={() => void genKey()} className="symbius-btn-outline px-4 py-2 text-sm">
          Gerar API key
        </button>
      </div>
      {apiKey && (
        <p className="rounded-lg bg-zinc-50 p-3 font-mono text-xs break-all">{apiKey}</p>
      )}
    </div>
  );
}

export function AiSettingsPanel() {
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiKnowledgeBase, setAiKnowledgeBase] = useState("");
  const [aiTone, setAiTone] = useState("");
  const { show, Toast } = useSymbiusToast();

  useEffect(() => {
    void fetch("/api/symbius/ai/config")
      .then((r) => r.json())
      .then((d) => {
        setAiEnabled(Boolean(d.aiEnabled));
        setAiKnowledgeBase(d.aiKnowledgeBase ?? "");
        setAiTone(d.aiTone ?? "");
      });
  }, []);

  async function save() {
    const res = await fetch("/api/symbius/ai/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aiEnabled, aiKnowledgeBase, aiTone }),
    });
    if (!res.ok) {
      show("Falha ao salvar configuração de IA", "error");
      return;
    }
    show("Configuração salva (IA ainda em breve)", "success");
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-4">
      {Toast}
      <h2 className="text-xl font-bold">IA (em breve)</h2>
      <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
        Configuração salva para a fase dedicada de IA. Respostas automáticas ainda não estão ativas.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={aiEnabled} onChange={(e) => setAiEnabled(e.target.checked)} />
        Habilitar IA (quando disponível)
      </label>
      <textarea
        value={aiKnowledgeBase}
        onChange={(e) => setAiKnowledgeBase(e.target.value)}
        rows={6}
        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        placeholder="Base de conhecimento (FAQ, produtos, tom da marca...)"
      />
      <input
        value={aiTone}
        onChange={(e) => setAiTone(e.target.value)}
        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        placeholder="Tom de voz (ex: amigável, profissional)"
      />
      <button type="button" onClick={() => void save()} className="symbius-btn-primary px-4 py-2 text-sm">
        Salvar configuração IA
      </button>
    </div>
  );
}

export function InstagramDmSettings({
  accountId,
  defaultReply,
  onSaved,
}: {
  accountId: string;
  defaultReply: string;
  onSaved: () => void;
}) {
  const [text, setText] = useState(defaultReply);
  const [starters, setStarters] = useState("");

  useEffect(() => {
    setText(defaultReply);
  }, [defaultReply]);

  async function save() {
    const iceBreakers = starters
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 4)
      .map((question) => ({ question }));
    await fetch("/api/symbius/instagram/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        igAccountId: accountId,
        defaultReplyText: text,
        iceBreakers,
      }),
    });
    onSaved();
  }

  return (
    <div className="space-y-4 border-t border-zinc-100 pt-4">
      <label className="block text-sm">
        <span className="font-medium">Resposta padrão</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          placeholder="Mensagem quando nenhum fluxo corresponder..."
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium">Conversation starters (1 por linha, máx. 4)</span>
        <textarea
          value={starters}
          onChange={(e) => setStarters(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
      </label>
      <button type="button" onClick={() => void save()} className="symbius-btn-primary px-4 py-2 text-sm">
        Salvar Instagram
      </button>
    </div>
  );
}
