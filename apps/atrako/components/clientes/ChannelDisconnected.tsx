import Link from "next/link";
import { Store } from "lucide-react";

/** Aviso padrão de canal sem conexão. O link só entra quando o usuário pode configurar. */
export function ChannelDisconnected({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref?: string | null;
  actionLabel?: string;
}) {
  return (
    <div className="rel-card p-8 text-center">
      <Store className="mx-auto h-8 w-8 text-[var(--muted-foreground)]" strokeWidth={1.5} />
      <p className="mt-3 type-body text-[var(--foreground)]">{title}</p>
      <p className="mt-1 type-fine-print text-[var(--muted-foreground)]">{description}</p>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-4 inline-flex rounded-[var(--radius-xs)] bg-[var(--primary)] px-4 py-2 type-button-utility text-[var(--primary-foreground)] active:scale-95"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
