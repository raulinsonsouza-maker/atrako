"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log do erro para debug (opcional)
    console.error("[Dashboard Error]", error.message);
  }, [error]);

  const isDbError =
    error.message?.includes("Can't reach database") ||
    error.message?.includes("127.0.0.1:5432") ||
    error.message?.includes("connection");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-error-500/10">
          <AlertCircle className="h-7 w-7 text-error-500" strokeWidth={1.75} />
        </div>
        <h2 className="text-headline font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
          Algo deu errado
        </h2>
        <p className="text-footnote text-neutral-500 dark:text-neutral-400 mb-6">
          {isDbError ? (
            <>
              Nao foi possivel conectar ao banco de dados. Verifique se o PostgreSQL esta rodando na porta 5432 e tente novamente.
            </>
          ) : (
            <>
              Ocorreu um erro ao carregar esta pagina. Tente novamente em alguns instantes.
            </>
          )}
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-footnote font-medium text-white hover:bg-primary-600 transition-colors"
        >
          <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
