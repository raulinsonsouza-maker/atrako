import { MarketingShell } from "@/components/shells/MarketingShell";

export const metadata = {
  title: "Termos de uso",
};

export default function TermosPage() {
  return (
    <MarketingShell>
      <div className="container py-12 max-w-3xl stack">
        <h1 className="m-0 text-[var(--text-3xl)]">Termos de uso</h1>
        <p className="m-0 text-[var(--muted)]">
          Ao comprar produtos nesta plataforma, você concorda em utilizar o conteúdo apenas para
          uso pessoal, sem redistribuição ou revenda não autorizada. O acesso é liberado após a
          confirmação do pagamento.
        </p>
        <p className="m-0 text-[var(--muted)]">
          Preços, disponibilidade e condições de pagamento podem mudar sem aviso prévio. Em caso
          de chargeback ou fraude, o acesso poderá ser revogado.
        </p>
        <p className="m-0 text-[var(--muted)]">
          Dúvidas sobre estes termos podem ser enviadas ao suporte da loja.
        </p>
      </div>
    </MarketingShell>
  );
}
