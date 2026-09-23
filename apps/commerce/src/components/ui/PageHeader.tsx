import { Button } from "@/components/ui/Button";
import { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { label: string; onClick?: () => void; href?: string };
}) {
  return (
    <div className="stack items-start py-8">
      <h3 className="m-0 text-[var(--text-lg)]">{title}</h3>
      {description ? <p className="m-0 max-w-md text-[var(--muted)]">{description}</p> : null}
      {action?.href ? (
        <a href={action.href}>
          <Button size="sm">{action.label}</Button>
        </a>
      ) : action?.onClick ? (
        <Button size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-6">
      <div className="cluster justify-between gap-4 items-start">
        <div className="min-w-0 stack-sm">
          {eyebrow ? <p className="m-0 label-tech">{eyebrow}</p> : null}
          <h1 className="m-0 text-[var(--text-2xl)] font-semibold tracking-[-0.03em]">{title}</h1>
          {description ? (
            <p className="m-0 text-[var(--muted)] text-[var(--text-sm)]">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="cluster shrink-0">{actions}</div> : null}
      </div>
    </div>
  );
}
