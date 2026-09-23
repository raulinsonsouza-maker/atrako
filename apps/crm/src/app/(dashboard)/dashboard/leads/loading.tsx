export default function LeadsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 w-32 rounded-md bg-neutral-200/60 dark:bg-neutral-800" />
        ))}
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-80 min-w-[280px] rounded-xl bg-neutral-200/60 dark:bg-neutral-800" />
        ))}
      </div>
    </div>
  );
}
