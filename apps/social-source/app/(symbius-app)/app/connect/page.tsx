"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Instagram,
  Loader2,
  MessageCircle,
} from "lucide-react";
import { SYMBIUS_META_OAUTH_MESSAGE } from "@/lib/instagram/metaOAuth";
import { openMetaOAuthPopup } from "@/lib/instagram/openMetaOAuthPopup";

type ConnectedAccount = {
  id: string;
  igUsername?: string | null;
  igProfilePictureUrl?: string | null;
  messagesEnabled?: boolean;
  status?: string;
};

const STEPS = [
  "Entrar com Instagram",
  "Conta vinculada",
  "Mensagens",
  "Pronto",
];

function ConnectWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const stepParam = Number(searchParams.get("step") ?? "1");
  const [step, setStep] = useState(stepParam >= 5 ? 4 : Math.min(stepParam, 4));
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(errorParam);
  const [account, setAccount] = useState<ConnectedAccount | null>(null);

  const loadAccount = useCallback(async () => {
    const res = await fetch("/api/symbius/connect/pages", {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    const first = (data.accounts as ConnectedAccount[] | undefined)?.find(
      (a) => a.status === "CONNECTED" || a.status === "NEEDS_REAUTH",
    );
    if (first) setAccount(first);
    return first ?? null;
  }, []);

  const hydrateFromServer = useCallback(async () => {
    const acc = await loadAccount();
    if (!acc) return false;
    setAccount(acc);
    setStep(4);
    return true;
  }, [loadAccount]);

  useEffect(() => {
    if (stepParam >= 5) {
      setStep(4);
      void loadAccount();
      return;
    }
    if (stepParam >= 2) {
      setStep(Math.min(stepParam, 4));
      void loadAccount();
      return;
    }
    void hydrateFromServer();
  }, [stepParam, loadAccount, hydrateFromServer]);

  useEffect(() => {
    if (errorParam) {
      setOauthError(errorParam);
      // limpa ?error= da URL pra não reaparecer no refresh
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, [errorParam]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as {
        type?: string;
        ok?: boolean;
        error?: string | null;
        step?: string;
      };
      if (data?.type !== SYMBIUS_META_OAUTH_MESSAGE) return;

      setOauthLoading(false);
      if (data.error) {
        setOauthError(data.error);
        return;
      }
      if (data.ok) {
        setOauthError(null);
        router.replace("/app/connect?step=5");
        setStep(2);
        void (async () => {
          const acc = await loadAccount();
          setStep(3);
          setTimeout(() => setStep(4), 600);
          if (acc) setAccount(acc);
          router.refresh();
        })();
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [loadAccount, router]);

  function startMetaOAuth() {
    setOauthError(null);
    setOauthLoading(true);
    const popup = openMetaOAuthPopup("/api/symbius/auth/meta/start?popup=1");
    if (!popup) {
      setOauthLoading(false);
      window.location.href = "/api/symbius/auth/meta/start";
      return;
    }

    const timer = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(timer);
        setOauthLoading(false);
      }
    }, 500);
  }

  return (
    <div className="p-6 md:p-10">
      <h1 className="text-2xl font-bold">Conectar Instagram</h1>
      <p className="mt-1 text-[var(--symbius-muted)]">
        Autorize sua conta Professional via Instagram Login
      </p>

      {oauthError && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {oauthError}
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-2">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const active = step === n;
          const done = step > n;
          return (
            <div
              key={label}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
                active
                  ? "bg-[var(--symbius-primary)] text-white"
                  : done
                    ? "bg-[var(--symbius-accent)]/20 text-[var(--symbius-accent)]"
                    : "bg-[var(--symbius-surface)] text-[var(--symbius-muted)]"
              }`}
            >
              {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : n}
              <span className="hidden sm:inline">{label}</span>
            </div>
          );
        })}
      </div>

      <div className="symbius-card mt-8 max-w-2xl">
        {step === 1 && (
          <div className="text-center">
            <Instagram className="mx-auto h-12 w-12 text-pink-500" />
            <h2 className="mt-4 text-lg font-semibold">
              Faltam apenas algumas etapas
            </h2>
            <p className="mt-2 text-sm text-[var(--symbius-muted)]">
              Você será redirecionado para o Instagram. Conceda as permissões e
              sua conta Professional será vinculada ao Symbius Flow — sem
              precisar de Página do Facebook.
            </p>
            <button
              type="button"
              onClick={startMetaOAuth}
              disabled={oauthLoading}
              className="symbius-btn-primary mt-8 inline-flex gap-2 disabled:opacity-60"
            >
              {oauthLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Instagram className="h-4 w-4" />
              )}
              {oauthLoading ? "Aguardando Instagram…" : "Conectar Instagram"}
            </button>
          </div>
        )}

        {(step === 2 || step === 3) && (
          <div className="text-center">
            {step === 2 && !account ? (
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-[var(--symbius-primary)]" />
            ) : (
              <>
                {account?.igProfilePictureUrl ? (
                  <Image
                    src={account.igProfilePictureUrl}
                    alt=""
                    width={64}
                    height={64}
                    className="mx-auto rounded-full"
                    unoptimized
                  />
                ) : (
                  <Instagram className="mx-auto h-12 w-12 text-pink-500" />
                )}
                <h2 className="mt-4 text-lg font-semibold">
                  @{account?.igUsername ?? "instagram"}
                </h2>
                <p className="mt-2 text-sm text-[var(--symbius-muted)]">
                  Conta Professional vinculada
                </p>
                {step === 3 && (
                  <ul className="mt-6 space-y-2 text-left text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[var(--symbius-accent)]" />
                      Instagram Login autorizado
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[var(--symbius-accent)]" />
                      Webhooks inscritos
                    </li>
                    <li className="flex items-center gap-2">
                      {account?.messagesEnabled !== false ? (
                        <CheckCircle2 className="h-4 w-4 text-[var(--symbius-accent)]" />
                      ) : (
                        <MessageCircle className="h-4 w-4 text-amber-400" />
                      )}
                      Acesso a mensagens
                    </li>
                  </ul>
                )}
              </>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-16 w-16 text-[var(--symbius-accent)]" />
            <h2 className="mt-4 text-xl font-bold">Conectado com sucesso!</h2>
            <p className="mt-2 text-sm text-[var(--symbius-muted)]">
              {account?.igUsername
                ? `@${account.igUsername} está pronta para automações`
                : "Sua conta está pronta para automações"}
            </p>
            {account?.igProfilePictureUrl && (
              <Image
                src={account.igProfilePictureUrl}
                alt=""
                width={72}
                height={72}
                className="mx-auto mt-4 rounded-full"
                unoptimized
              />
            )}
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => router.push("/app/settings")}
                className="symbius-btn-outline inline-flex gap-2"
              >
                Ver perfil em Configurações
              </button>
              <button
                type="button"
                onClick={() => router.push("/app/flows/new")}
                className="symbius-btn-primary inline-flex gap-2"
              >
                Criar meu primeiro fluxo
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ConnectPage() {
  return (
    <Suspense>
      <ConnectWizard />
    </Suspense>
  );
}
