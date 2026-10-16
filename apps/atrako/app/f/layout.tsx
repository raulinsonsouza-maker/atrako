import type { ReactNode } from "react";

/** Forms públicos `/f/*` — sempre superfície clara (não herdam tema escuro do app). */
export default function PublicFormsLayout({ children }: { children: ReactNode }) {
  return <div className="capture-form-shell">{children}</div>;
}
