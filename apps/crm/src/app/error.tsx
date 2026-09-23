"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw, Home } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[App Error]", error.message);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-neutral-100 dark:bg-neutral-950">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-error-500/10">
          <AlertCircle className="h-7 w-7 text-error-500" strokeWidth={1.75} />
        </div>
        <h1 className="text-title-1 font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
          Algo deu errado
        </h1>
        <p className="text-subhead text-neutral-500 dark:text-neutral-400 mb-6">
          Ocorreu um erro inesperado. Tente novamente ou volte ao inicio.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-footnote font-medium text-white hover:bg-primary-600 transition-colors"
          >
            <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
            Tentar novamente
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 dark:border-neutral-700 px-4 py-2.5 text-footnote font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            <Home className="h-4 w-4" strokeWidth={1.75} />
            Inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
