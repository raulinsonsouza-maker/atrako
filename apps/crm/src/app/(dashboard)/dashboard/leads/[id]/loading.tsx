export default function LeadDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-64 rounded-md bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-9 w-32 rounded-md bg-neutral-200 dark:bg-neutral-800" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="h-48 rounded-xl bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-64 rounded-xl bg-neutral-200 dark:bg-neutral-800" />
        </div>
        <div className="space-y-4">
          <div className="h-48 rounded-xl bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-32 rounded-xl bg-neutral-200 dark:bg-neutral-800" />
        </div>
      </div>
    </div>
  );
}
