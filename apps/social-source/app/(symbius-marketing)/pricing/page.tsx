import Link from "next/link";
import { Check } from "lucide-react";

const PLANS = [
  {
    name: "Free",
    price: "R$ 0",
    desc: "Para testar automações",
    features: ["1 conta Instagram", "3 fluxos", "1 usuário"],
    cta: "Começar grátis",
    href: "/signup",
    highlight: false,
  },
  {
    name: "Pro",
    price: "Sob consulta",
    desc: "Para criadores e negócios",
    features: ["3 contas Instagram", "Fluxos ilimitados", "5 usuários", "Suporte prioritário"],
    cta: "Falar com vendas",
    href: "/signup",
    highlight: true,
  },
  {
    name: "Agency",
    price: "Sob consulta",
    desc: "Para agências",
    features: ["10 contas Instagram", "Fluxos ilimitados", "20 usuários", "Multi-cliente"],
    cta: "Falar com vendas",
    href: "/signup",
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-16">
      <div className="text-center">
        <h1 className="text-4xl font-bold">Planos</h1>
        <p className="mt-4 text-[var(--symbius-muted)]">
          Comece grátis. Upgrade quando precisar — cobrança automática em breve.
        </p>
      </div>
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={`symbius-card relative ${plan.highlight ? "ring-2 ring-[var(--symbius-primary)]" : ""}`}
          >
            {plan.highlight && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--symbius-primary)] px-3 py-0.5 text-xs font-semibold">
                Popular
              </span>
            )}
            <h2 className="text-xl font-bold">{plan.name}</h2>
            <p className="mt-2 text-3xl font-bold">{plan.price}</p>
            <p className="mt-1 text-sm text-[var(--symbius-muted)]">{plan.desc}</p>
            <ul className="mt-6 space-y-2">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-[var(--symbius-accent)]" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href={plan.href}
              className={`mt-8 block text-center ${plan.highlight ? "symbius-btn-primary" : "symbius-btn-outline"} w-full py-2.5`}
            >
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>
    </main>
  );
}
