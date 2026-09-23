export default function CampanhasLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded-md bg-neutral-200/60 dark:bg-neutral-800" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-32 rounded-xl bg-neutral-200/60 dark:bg-neutral-800" />
        ))}
      </div>
    </div>
  );
}
