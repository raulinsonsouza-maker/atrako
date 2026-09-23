/**
 * Exibido imediatamente ao clicar em qualquer item do menu do dashboard,
 * enquanto o layout e a página carregam no servidor.
 */
export default function DashboardLayoutLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-1">
      <div className="h-8 w-56 rounded-md bg-neutral-200/80 dark:bg-neutral-800/80 animate-pulse" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-32 rounded-xl bg-neutral-200/80 dark:bg-neutral-800/80 animate-pulse"
          />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-neutral-200/80 dark:bg-neutral-800/80 animate-pulse" />
    </div>
  );
}
