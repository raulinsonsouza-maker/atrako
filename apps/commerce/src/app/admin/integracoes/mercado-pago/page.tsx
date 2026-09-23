import { prisma } from "@/lib/prisma";
import { getOrCreatePaymentSettings } from "@/lib/mercadopago/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { MpConnectionActions } from "./MpConnectionActions";
import { PaymentSettingsForm } from "./PaymentSettingsForm";

export default async function MercadoPagoAdminPage() {
  if (process.env.ATRAKO_EMBED_OPEN === "true") {
    const atrako =
      process.env.NEXT_PUBLIC_ATRAKO_URL?.trim() || "http://localhost:5000";
    return (
      <div className="stack-lg">
        <PageHeader
          title="Mercado Pago"
          description="Conexão centralizada no hub do Atrako."
        />
        <Panel className="stack">
          <p className="m-0 text-[var(--muted)] text-[var(--text-sm)]">
            Conecte o Mercado Pago uma vez no Atrako — vale para Commerce, Agenda e
            Financeiro.
          </p>
          <a
            href={`${atrako}/admin/conexoes`}
            target="_top"
            className="inline-flex w-fit rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-medium text-white"
          >
            Abrir Conexões no Atrako
          </a>
        </Panel>
      </div>
    );
  }

  const [account, settings] = await Promise.all([
    prisma.mercadoPagoAccount.findFirst({
      where: { status: "CONNECTED" },
      orderBy: { connectedAt: "desc" },
    }),
    getOrCreatePaymentSettings(),
  ]);

  const connected = Boolean(account);

  return (
    <div className="stack-lg">
      <PageHeader
        title="Mercado Pago"
        description="Conexão OAuth e configurações de pagamento."
      />

      <Panel className="stack">
        <div className="cluster justify-between gap-3">
          <div>
            <h2 className="m-0 text-[var(--text-lg)]">Conta</h2>
            <p className="m-0 mt-1 text-[var(--muted)] text-[var(--text-sm)]">
              {connected
                ? `Conectada${account?.mpUserId ? ` · MP #${account.mpUserId}` : ""}`
                : "Nenhuma conta conectada."}
            </p>
          </div>
          <Badge tone={connected ? "success" : "danger"}>
            {connected ? "Conectado" : "Desconectado"}
          </Badge>
        </div>
        <MpConnectionActions connected={connected} />
      </Panel>

      <PaymentSettingsForm
        settings={{
          statementDescriptor: settings.statementDescriptor ?? "",
          pixEnabled: settings.pixEnabled,
          cardEnabled: settings.cardEnabled,
          minInstallments: settings.minInstallments ?? 1,
          maxInstallments: settings.maxInstallments ?? 12,
        }}
      />
    </div>
  );
}
