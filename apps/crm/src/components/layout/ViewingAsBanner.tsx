import Link from "next/link";

export function ViewingAsBanner({ tenantName }: { tenantName: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm dark:border-amber-900/50 dark:bg-amber-950/50">
      <span className="text-amber-900 dark:text-amber-200">
        Visualizando como <strong>{tenantName}</strong>
      </span>
      <Link
        href="/api/super-admin/view-as/exit"
        className="shrink-0 font-medium text-amber-800 underline hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200"
      >
        Sair da visualização
      </Link>
    </div>
  );
}
