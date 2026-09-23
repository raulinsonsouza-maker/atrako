export default function FinanceiroLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-neutral-200/60 dark:bg-neutral-800" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="h-72 rounded-2xl bg-neutral-200/60 dark:bg-neutral-800 lg:col-span-2" />
        <div className="h-72 rounded-2xl bg-neutral-200/60 dark:bg-neutral-800" />
      </div>
      <div className="h-96 rounded-2xl bg-neutral-200/60 dark:bg-neutral-800" />
    </div>
  );
}
