import { cn } from "@/lib/utils";
import { HTMLAttributes, ReactNode } from "react";

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("admin-frame p-5", className)} {...props} />;
}

export function SectionPanel({
  title,
  code,
  children,
  className,
  actions,
}: {
  title: string;
  code?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <Panel className={cn("stack", className)}>
      <div className="cluster justify-between gap-2">
        <h2 className="admin-section-title m-0">
          {code ? (
            <span className="font-mono text-[var(--muted)] text-[var(--text-xs)] mr-1">{code}</span>
          ) : null}
          {title}
        </h2>
        {actions}
      </div>
      {children}
    </Panel>
  );
}
