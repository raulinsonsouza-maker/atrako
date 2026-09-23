"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getWhatsAppIntegration, saveWhatsAppIntegration, getWwebStatus, disconnectWhatsApp } from "@/server/actions/integration";
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from "@/design/components";
import { Wifi, WifiOff, QrCode, AlertCircle, X } from "lucide-react";

type Provider = "evolution" | "wweb" | "zapi";

export function WhatsAppIntegrationForm({ tenantId }: { tenantId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [provider, setProvider] = useState<Provider>("evolution");
  const [instance, setInstance] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [zapiInstanceId, setZapiInstanceId] = useState("");
  const [zapiToken, setZapiToken] = useState("");
  const [wwebServiceUrl, setWwebServiceUrl] = useState("");

  const [wwebStatus, setWwebStatus] = useState<{ status: string; qr?: string; error?: string } | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const timeRemainingRef = useRef<NodeJS.Timeout | null>(null);

  const load = useCallback(() => {
    getWhatsAppIntegration(tenantId)
      .then((i) => {
        const c = (i?.config || {}) as {
          provider?: string;
          evolutionInstance?: string;
          evolutionApiUrl?: string;
          evolutionApiKey?: string;
          zapiInstanceId?: string;
          zapiToken?: string;
          wwebServiceUrl?: string;
        };
        setInstance(c.evolutionInstance || "");
        setApiUrl(c.evolutionApiUrl || "");
        setApiKey(c.evolutionApiKey || "");
        setZapiInstanceId(c.zapiInstanceId || "");
        setZapiToken(c.zapiToken || "");
        setProvider(
          c.provider === "zapi"
            ? "zapi"
            : c.provider === "wweb" || c.wwebServiceUrl
              ? "wweb"
              : "evolution"
        );
        setWwebServiceUrl(c.wwebServiceUrl || "");
        
        // Se já está conectado, verificar status uma vez (sem polling)
        if (c.provider === "wweb" || c.wwebServiceUrl) {
          getWwebStatus(tenantId).then((status) => {
            setWwebStatus(status);
            // Se já está ready, não fazer polling
            if (status?.status === "ready") {
              setIsPolling(false);
            }
          });
        }
      })
      .finally(() => setLoading(false));
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  const fetchWwebStatus = useCallback(() => {
    return getWwebStatus(tenantId).then((status) => {
      setWwebStatus(status);
      return status;
    });
  }, [tenantId]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (timeRemainingRef.current) {
      clearInterval(timeRemainingRef.current);
      timeRemainingRef.current = null;
    }
    setIsPolling(false);
    setTimeRemaining(null);
  }, []);

  const startPolling = useCallback(() => {
    // Limpar qualquer polling anterior
    stopPolling();
    
    setIsPolling(true);
    setTimeRemaining(60);
    
    // Primeira chamada imediata
    fetchWwebStatus();
    
    // Polling a cada 4 segundos
    intervalRef.current = setInterval(() => {
      fetchWwebStatus().then((status) => {
        // Se conectado, parar polling
        if (status?.status === "ready") {
          stopPolling();
        }
      });
    }, 4000);
    
    // Contador regressivo de 60 segundos
    timeRemainingRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          stopPolling();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    
    // Timeout de 60 segundos
    timeoutRef.current = setTimeout(() => {
      stopPolling();
      // Se ainda não conectou, resetar status para permitir novo QR
      fetchWwebStatus().then((status) => {
        if (status?.status !== "ready") {
          // Se está preso em "starting", força desconexão para permitir nova tentativa
          if (status?.status === "starting") {
            setWwebStatus({ status: "disconnected" });
          } else {
            setWwebStatus(status || { status: "disconnected" });
          }
        }
      });
    }, 60000);
  }, [fetchWwebStatus, stopPolling]);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  async function handleShowQR(forceRecreate = false) {
    setError(null);
    try {
      // Salvar integração se ainda não existir
      await saveWhatsAppIntegration(tenantId, { provider: "wweb", wwebServiceUrl: wwebServiceUrl.trim() || undefined });
      
      // Força recriação apenas no modo integrado (sem serviço externo)
      if (!wwebServiceUrl.trim()) {
        await getWwebStatus(tenantId, true);
      } else {
        await getWwebStatus(tenantId);
      }
      
      // Aguarda um pouco para o cliente inicializar
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      // Recarrega o status
      await load();
      
      // Iniciar polling
      startPolling();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao iniciar conexão.");
    }
  }

  async function handleDisconnect() {
    if (!confirm("Tem certeza que deseja desconectar o WhatsApp? Você precisará escanear o QR Code novamente para reconectar.")) {
      return;
    }
    
    setDisconnecting(true);
    setError(null);
    try {
      await disconnectWhatsApp(tenantId);
      setWwebStatus({ status: "disconnected" });
      stopPolling();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao desconectar.");
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (provider === "wweb") {
        await saveWhatsAppIntegration(tenantId, { provider: "wweb", wwebServiceUrl: wwebServiceUrl.trim() || undefined });
      } else if (provider === "zapi") {
        await saveWhatsAppIntegration(tenantId, {
          provider: "zapi",
          zapiInstanceId: zapiInstanceId.trim(),
          zapiToken: zapiToken.trim(),
        });
      } else {
        await saveWhatsAppIntegration(tenantId, {
          provider: "evolution",
          evolutionInstance: instance.trim(),
          evolutionApiUrl: apiUrl || undefined,
          evolutionApiKey: apiKey || undefined,
        });
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-neutral-500 dark:text-neutral-400">Carregando…</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>WhatsApp</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Canal</label>
          <div className="flex flex-wrap gap-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="provider"
                checked={provider === "zapi"}
                onChange={() => {
                  setProvider("zapi");
                  stopPolling();
                  setWwebStatus(null);
                }}
                className="text-primary-600"
              />
              Z-API
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="provider"
                checked={provider === "evolution"}
                onChange={() => {
                  setProvider("evolution");
                  stopPolling();
                  setWwebStatus(null);
                }}
                className="text-primary-600"
              />
              Evolution API
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="provider"
                checked={provider === "wweb"}
                onChange={() => {
                  setProvider("wweb");
                  stopPolling();
                  setWwebStatus(null);
                }}
                className="text-primary-600"
              />
              WhatsApp Web (QR Code)
            </label>
          </div>
        </div>

        {provider === "zapi" ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Instance ID"
              value={zapiInstanceId}
              onChange={(e) => setZapiInstanceId(e.target.value)}
              placeholder="ex: 3C67AB641C8AA0412F6A2242B4E23AC7"
              required
            />
            <Input
              label="Token"
              type="password"
              value={zapiToken}
              onChange={(e) => setZapiToken(e.target.value)}
              placeholder="Token da instância Z-API"
              required
            />
            {error && <p className="text-sm text-error-600">{error}</p>}
            <Button type="submit" isLoading={saving}>Salvar</Button>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Configure no painel Z-API o webhook &quot;Ao receber&quot; para: https://seu-dominio.com/api/webhooks/zapi
            </p>
          </form>
        ) : provider === "evolution" ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Nome da instância"
              value={instance}
              onChange={(e) => setInstance(e.target.value)}
              placeholder="ex: minha-instancia"
              required
            />
            <Input
              label="URL da Evolution API (opcional)"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="http://127.0.0.1:8080"
            />
            <Input
              label="API Key (opcional)"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            {error && <p className="text-sm text-error-600">{error}</p>}
            <Button type="submit" isLoading={saving}>Salvar</Button>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Configure a Evolution API e o webhook para /api/webhooks/whatsapp.
            </p>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Conecte seu WhatsApp pelo QR Code. Clique em <strong>Exibir QR Code</strong> e escaneie com o celular (WhatsApp &gt; Aparelhos conectados &gt; Conectar um aparelho).
            </p>

            <Input
              label="URL do serviço WhatsApp Web (opcional)"
              value={wwebServiceUrl}
              onChange={(e) => setWwebServiceUrl(e.target.value)}
              placeholder="http://localhost:4100"
            />

            <div className="rounded-sm border border-neutral-200 p-4 dark:border-neutral-700">
              <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Status da conexão
              </h4>
              {!wwebStatus ? (
                <div className="space-y-3">
                  <p className="text-sm text-neutral-500">Não conectado</p>
                  <Button onClick={() => handleShowQR()} variant="outline" fullWidth>
                    <QrCode className="mr-2 h-4 w-4" />
                    Exibir QR Code
                  </Button>
                </div>
              ) : wwebStatus.status === "ready" ? (
                <div className="space-y-3">
                  <p className="flex items-center gap-2 text-sm text-success-600 dark:text-success-500">
                    <Wifi className="h-4 w-4" />
                    Conectado
                  </p>
                  <Button onClick={handleDisconnect} variant="outline" isLoading={disconnecting} fullWidth>
                    <X className="mr-2 h-4 w-4" />
                    Desconectar WhatsApp
                  </Button>
                </div>
              ) : wwebStatus.status === "qr" && wwebStatus.qr ? (
                <div className="space-y-3">
                  <div>
                    <p className="mb-2 flex items-center gap-2 text-sm text-warning-600 dark:text-warning-500">
                      <QrCode className="h-4 w-4" />
                      Escaneie o QR Code no WhatsApp do celular
                    </p>
                    {timeRemaining !== null && (
                      <p className="mb-2 text-xs text-neutral-500">
                        Tempo restante: {timeRemaining}s
                      </p>
                    )}
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(wwebStatus.qr)}`}
                      alt="QR Code WhatsApp"
                      className="rounded border border-neutral-200 dark:border-neutral-600"
                    />
                  </div>
                  {timeRemaining === null && (
                    <Button onClick={() => handleShowQR()} variant="outline" fullWidth>
                      <QrCode className="mr-2 h-4 w-4" />
                      Gerar Novo QR Code
                    </Button>
                  )}
                </div>
              ) : wwebStatus.status === "auth_failure" ? (
                <div className="space-y-3">
                  <p className="flex items-center gap-2 text-sm text-error-600">
                    <AlertCircle className="h-4 w-4" />
                    Falha de autenticação. A sessão pode ter expirado ou sido invalidada pelo WhatsApp.
                  </p>
                  <p className="text-xs text-neutral-500">
                    Clique em "Tentar Novamente" para gerar um novo QR Code e reconectar.
                  </p>
                  <Button onClick={() => handleShowQR(true)} variant="outline" fullWidth>
                    <QrCode className="mr-2 h-4 w-4" />
                    Tentar Novamente
                  </Button>
                </div>
              ) : wwebStatus.status === "starting" ? (
                <div className="space-y-3">
                  <p className="text-sm text-neutral-500">Preparando conexão…</p>
                  {timeRemaining !== null && (
                    <>
                      <p className="text-xs text-neutral-500">
                        Tempo restante: {timeRemaining}s
                      </p>
                      <Button 
                        onClick={() => {
                          stopPolling();
                          setWwebStatus({ status: "disconnected" });
                        }} 
                        variant="outline" 
                        fullWidth
                        size="sm"
                      >
                        Cancelar
                      </Button>
                    </>
                  )}
                  {timeRemaining === null && (
                    <Button onClick={() => handleShowQR(true)} variant="outline" fullWidth>
                      <QrCode className="mr-2 h-4 w-4" />
                      Tentar Novamente
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                    <WifiOff className="h-4 w-4" />
                    {wwebStatus.status === "disconnected" ? "Não conectado" : wwebStatus.status}
                  </p>
                  <Button onClick={() => handleShowQR()} variant="outline" fullWidth>
                    <QrCode className="mr-2 h-4 w-4" />
                    Exibir QR Code
                  </Button>
                </div>
              )}
            </div>

            {error && <p className="text-sm text-error-600">{error}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
