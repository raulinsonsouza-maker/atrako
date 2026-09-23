export default function RelatoriosLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 w-24 rounded-md bg-neutral-200/60 dark:bg-neutral-800" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-72 rounded-xl bg-neutral-200/60 dark:bg-neutral-800" />
        <div className="h-72 rounded-xl bg-neutral-200/60 dark:bg-neutral-800" />
      </div>
      <div className="h-96 rounded-xl bg-neutral-200/60 dark:bg-neutral-800" />
    </div>
  );
}
