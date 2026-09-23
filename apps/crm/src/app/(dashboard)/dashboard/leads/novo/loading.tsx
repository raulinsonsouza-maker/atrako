export default function NovoLeadLoading() {
  return (
    <div className="max-w-2xl space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded-md bg-neutral-200/60 dark:bg-neutral-800" />
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 rounded-md bg-neutral-200/60 dark:bg-neutral-800" />
        ))}
      </div>
    </div>
  );
}
