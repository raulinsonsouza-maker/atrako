export default function AtendimentoLoading() {
  return (
    <div className="flex h-[calc(100vh-12rem)] gap-4 animate-pulse">
      <div className="h-full w-72 shrink-0 rounded-xl bg-neutral-200/60 dark:bg-neutral-800" />
      <div className="h-full flex-1 rounded-xl bg-neutral-200/60 dark:bg-neutral-800" />
    </div>
  );
}
