import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 no-underline group">
      <span
        aria-hidden
        className="inline-flex size-7 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--accent)] text-[var(--accent-ink)] text-[12px] font-semibold"
      >
        S
      </span>
      <span className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
        Signal
      </span>
    </Link>
  );
}
