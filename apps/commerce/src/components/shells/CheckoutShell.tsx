import { Logo } from "@/components/brand/Logo";
import { DarkGradientBg } from "@/components/ui/elegant-dark-pattern";
import { ReactNode } from "react";

export function CheckoutShell({
  children,
  title = "Checkout seguro",
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <DarkGradientBg showLights={false}>
      <div data-theme="checkout" className="min-h-screen text-[var(--ink)]">
        <header className="border-b border-[var(--border)] bg-black/50 backdrop-blur-md">
          <div className="container flex h-14 items-center justify-between">
            <Logo href="/" />
            <span className="text-[var(--text-sm)] font-medium text-[var(--muted)]">{title}</span>
          </div>
        </header>
        <main className="container py-8 animate-enter">{children}</main>
      </div>
    </DarkGradientBg>
  );
}
