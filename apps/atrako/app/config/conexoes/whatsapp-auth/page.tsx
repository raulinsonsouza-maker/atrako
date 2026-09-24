"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ATRAKO_OAUTH_MESSAGE } from "@/lib/oauth/openOAuthPopup";

type SessionInfo = {
  phone_number_id?: string;
  waba_id?: string;
  event?: string;
};

declare global {
  interface Window {
    fbAsyncInit?: () => void;
    FB?: {
      init: (opts: Record<string, unknown>) => void;
      login: (
        cb: (response: {
          authResponse?: { code?: string };
          status?: string;
        }) => void,
        opts: Record<string, unknown>,
      ) => void;
    };
  }
}

function WhatsAppAuthInner() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspaceId")?.trim() || "";
  const [status, setStatus] = useState<"loading" | "ready" | "connecting" | "done" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const [boot, setBoot] = useState<{ appId: string; configId: string; graphVersion: string } | null>(
    null,
  );
  const sessionRef = useRef<SessionInfo>({});
  const finishingRef = useRef(false);

  const notifyOpener = useCallback(
    (payload: { ok: boolean; error?: string | null }) => {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(
          {
            type: ATRAKO_OAUTH_MESSAGE,
            ok: payload.ok,
            error: payload.error ?? null,
            provider: "WHATSAPP",
            workspaceId: workspaceId || null,
            connected: payload.ok ? "WHATSAPP" : null,
            meta: null,
            metaError: null,
            pick: null,
          },
          window.location.origin,
        );
      }
    },
    [workspaceId],
  );

  const finishWithCode = useCallback(
    async (code: string) => {
      if (finishingRef.current) return;
      finishingRef.current = true;
      setStatus("connecting");
      const wabaId = sessionRef.current.waba_id;
      const phoneNumberId = sessionRef.current.phone_number_id;
      if (!wabaId || !phoneNumberId) {
        setError(
          "Embedded Signup não retornou WABA/phone. Tente de novo ou use configuração manual.",
        );
        setStatus("error");
        notifyOpener({ ok: false, error: "missing_waba_assets" });
        finishingRef.current = false;
        return;
      }
      try {
        const r = await fetch("/api/atrako/whatsapp/embedded-signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            code,
            wabaId,
            phoneNumberId,
          }),
        });
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        if (!r.ok) {
          throw new Error(j.error || "Falha ao salvar WhatsApp");
        }
        setStatus("done");
        notifyOpener({ ok: true });
        window.close();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "erro";
        setError(msg);
        setStatus("error");
        notifyOpener({ ok: false, error: msg });
        finishingRef.current = false;
      }
    },
    [workspaceId, notifyOpener],
  );

  useEffect(() => {
    if (!workspaceId) {
      setError("workspaceId ausente");
      setStatus("error");
      return;
    }

    let cancelled = false;

    function onMessage(event: MessageEvent) {
      if (!event.origin.includes("facebook.com") && !event.origin.includes("fb.com")) return;
      try {
        const data =
          typeof event.data === "string" ? (JSON.parse(event.data) as SessionInfo) : (event.data as SessionInfo);
        if (data?.phone_number_id) sessionRef.current.phone_number_id = String(data.phone_number_id);
        if (data?.waba_id) sessionRef.current.waba_id = String(data.waba_id);
      } catch {
        /* ignore */
      }
    }
    window.addEventListener("message", onMessage);

    (async () => {
      const r = await fetch(`/api/atrako/whatsapp/embedded-signup?workspaceId=${workspaceId}`);
      const j = (await r.json().catch(() => ({}))) as {
        appId?: string;
        configId?: string;
        graphVersion?: string;
        error?: string;
        hint?: string;
      };
      if (cancelled) return;
      if (!r.ok || !j.appId || !j.configId) {
        setError(j.hint || j.error || "WhatsApp Embedded Signup indisponível");
        setStatus("error");
        return;
      }
      setBoot({
        appId: j.appId,
        configId: j.configId,
        graphVersion: j.graphVersion || "v22.0",
      });

      window.fbAsyncInit = () => {
        window.FB?.init({
          appId: j.appId,
          cookie: true,
          xfbml: false,
          version: j.graphVersion || "v22.0",
        });
        if (!cancelled) setStatus("ready");
      };

      if (!document.getElementById("facebook-jssdk")) {
        const script = document.createElement("script");
        script.id = "facebook-jssdk";
        script.async = true;
        script.defer = true;
        script.src = "https://connect.facebook.net/pt_BR/sdk.js";
        document.body.appendChild(script);
      } else if (window.FB) {
        window.fbAsyncInit?.();
      }
    })().catch((e) => {
      if (!cancelled) {
        setError(e instanceof Error ? e.message : "erro");
        setStatus("error");
      }
    });

    return () => {
      cancelled = true;
      window.removeEventListener("message", onMessage);
    };
  }, [workspaceId]);

  function launch() {
    if (!boot || !window.FB) return;
    setStatus("connecting");
    setError(null);
    window.FB.login(
      (response) => {
        const code = response.authResponse?.code;
        if (!code) {
          setError("Autorização cancelada ou sem code.");
          setStatus("ready");
          notifyOpener({ ok: false, error: "cancelled" });
          return;
        }
        void finishWithCode(code);
      },
      {
        config_id: boot.configId,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: "",
          sessionInfoVersion: "3",
        },
      },
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--canvas-parchment)] p-6 text-center">
      <h1 className="type-tagline text-[var(--ink)]">Conectar WhatsApp</h1>
      <p className="max-w-sm type-fine-print text-[var(--ink-muted-48)]">
        Autorize com Facebook para vincular a conta WhatsApp Business (Cloud API) a esta empresa.
      </p>

      {status === "loading" || status === "connecting" ? (
        <div className="flex items-center gap-2 type-fine-print text-[var(--ink-muted-48)]">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
          {status === "connecting" ? "Conectando número…" : "Preparando…"}
        </div>
      ) : null}

      {status === "ready" ? (
        <button
          type="button"
          onClick={launch}
          className="rounded-[var(--radius-xs)] bg-[var(--primary)] px-5 py-2.5 type-button-utility text-[var(--on-primary)] active:scale-95"
        >
          Continuar com Facebook
        </button>
      ) : null}

      {status === "done" ? (
        <p className="type-fine-print text-[var(--success)]">Conectado. Pode fechar esta janela.</p>
      ) : null}

      {error ? <p className="max-w-sm type-fine-print text-[var(--danger)]">{error}</p> : null}

      <button
        type="button"
        className="type-fine-print text-[var(--ink-muted-48)] underline"
        onClick={() => {
          notifyOpener({ ok: false, error: "cancelled" });
          window.close();
        }}
      >
        Cancelar
      </button>
    </div>
  );
}

export default function WhatsAppAuthPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--canvas-parchment)]">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
        </div>
      }
    >
      <WhatsAppAuthInner />
    </Suspense>
  );
}
