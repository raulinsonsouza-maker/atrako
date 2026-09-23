import Link from "next/link";

export function AtrakoMark({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`group inline-flex items-center gap-2.5 ${className}`}>
      <span
        aria-hidden
        className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[0_10px_24px_-12px_var(--primary-glow)] transition group-hover:scale-[1.03]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 16.5 12 4l8 12.5H4Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M8.2 16.5h7.6L12 10.2 8.2 16.5Z" fill="currentColor" opacity="0.35" />
        </svg>
      </span>
      <span className="type-tagline text-[var(--foreground)]">
        Atrako
      </span>
    </Link>
  );
}
