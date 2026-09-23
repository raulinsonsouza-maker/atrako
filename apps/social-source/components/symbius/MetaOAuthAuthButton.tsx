"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Instagram, Loader2, X } from "lucide-react";
import { openMetaOAuthPopup } from "@/lib/instagram/openMetaOAuthPopup";
import { SYMBIUS_META_OAUTH_MESSAGE } from "@/lib/instagram/metaOAuth";

type Props = {
  returnTo?: string;
  label?: string;
  className?: string;
};

export function MetaOAuthAuthButton({
  returnTo = "/app",
  label = "Entrar com Instagram",
  className = "mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60",
}: Props) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const completedRef = useRef(false);
  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    popupRef.current = null;
  }, []);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as {
        type?: string;
        ok?: boolean;
        error?: string | null;
        returnTo?: string;
      };
      if (data?.type !== SYMBIUS_META_OAUTH_MESSAGE) return;

      completedRef.current = true;
      cleanup();
      setLoading(false);

      if (data.error) {
        setError(data.error);
        return;
      }

      if (data.ok) {
        setModalOpen(false);
        setError(null);
        const dest = data.returnTo ?? returnTo;
        router.push(dest);
        router.refresh();
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [cleanup, returnTo, router]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  function startOAuth() {
    setError(null);
    setLoading(true);
    completedRef.current = false;

    const params = new URLSearchParams({
      intent: "auth",
      popup: "1",
      returnTo,
    });
    const popup = openMetaOAuthPopup(
      `/api/symbius/auth/meta/start?${params.toString()}`,
    );

    if (!popup) {
      setLoading(false);
      window.location.href = `/api/symbius/auth/meta/start?intent=auth&returnTo=${encodeURIComponent(returnTo)}`;
      return;
    }

    setModalOpen(true);
    popupRef.current = popup;

    pollRef.current = window.setInterval(() => {
      if (popup.closed && !completedRef.current) {
        cleanup();
        setLoading(false);
        setModalOpen(false);
      }
    }, 500);
  }

  function closeModal() {
    cleanup();
    setLoading(false);
    setModalOpen(false);
    setError(null);
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={startOAuth}
        disabled={loading}
        className={className}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Instagram className="h-5 w-5" />
        )}
        {loading ? "Aguardando Instagram…" : label}
      </button>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="meta-oauth-modal-title"
        >
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={closeModal}
              className="absolute right-4 top-4 text-zinc-400 hover:text-zinc-600"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>

            {error ? (
              <div className="text-center">
                <p
                  id="meta-oauth-modal-title"
                  className="text-lg font-semibold text-zinc-900"
                >
                  Não foi possível conectar
                </p>
                <p className="mt-3 text-sm text-red-700">{error}</p>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    startOAuth();
                  }}
                  className="mt-6 w-full rounded-xl bg-[#818cf8] px-4 py-3 text-sm font-semibold text-white hover:bg-[#6366f1]"
                >
                  Tentar novamente
                </button>
              </div>
            ) : (
              <div className="text-center">
                <Loader2 className="mx-auto h-10 w-10 animate-spin text-[#818cf8]" />
                <p
                  id="meta-oauth-modal-title"
                  className="mt-4 text-lg font-semibold text-zinc-900"
                >
                  Conectando com Instagram
                </p>
                <p className="mt-2 text-sm text-zinc-500">
                  Complete o login na janela do Instagram. Esta página permanece
                  aberta.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
