"use client";

import { useState } from "react";
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from "@/design/components";
import { createCheckoutSession, createPortalLink } from "@/server/actions/billing";
import { CreditCard } from "lucide-react";

const PLAN_LABEL: Record<string, string> = { STARTER: "Starter", PRO: "Pro", ENTERPRISE: "Enterprise" };

export function BillingView({
  tenantId,
  plan,
  hasStripeCustomer,
  userEmail,
}: {
  tenantId: string;
  plan: string;
  hasStripeCustomer: boolean;
  userEmail: string;
}) {
  const [email, setEmail] = useState(userEmail);
  const [planSel, setPlanSel] = useState<"STARTER" | "PRO" | "ENTERPRISE">((plan as "STARTER" | "PRO" | "ENTERPRISE") || "STARTER");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleManage() {
    setErr(null);
    setLoading(true);
    try {
      const url = await createPortalLink(tenantId);
      if (url) window.location.href = url;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao abrir o portal.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await createCheckoutSession(tenantId, email, planSel);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao criar assinatura.");
      setLoading(false);
    }
  }

  if (hasStripeCustomer) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Plano atual: {PLAN_LABEL[plan] ?? plan}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-neutral-600">
            Alterar plano, forma de pagamento ou ver faturas no portal do Stripe.
          </p>
          {err && <p className="mb-2 text-sm text-error-600">{err}</p>}
          <Button onClick={handleManage} isLoading={loading}>
            Gerenciar assinatura
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assinar plano</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubscribe} className="space-y-4 max-w-md">
          <Input
            label="E-mail para cobrança"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Plano</label>
            <select
              value={planSel}
              onChange={(e) => setPlanSel(e.target.value as "STARTER" | "PRO" | "ENTERPRISE")}
              className="block w-full rounded-sm border border-neutral-300 bg-white px-4 py-2 text-neutral-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="STARTER">Starter</option>
              <option value="PRO">Pro</option>
              <option value="ENTERPRISE">Enterprise</option>
            </select>
          </div>
          {err && <p className="text-sm text-error-600">{err}</p>}
          <Button type="submit" isLoading={loading}>
            Assinar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
