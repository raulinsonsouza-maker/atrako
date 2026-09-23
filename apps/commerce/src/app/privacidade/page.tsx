import { MarketingShell } from "@/components/shells/MarketingShell";

export const metadata = {
  title: "Privacidade",
};

export default function PrivacidadePage() {
  return (
    <MarketingShell>
      <div className="container py-12 max-w-3xl stack">
        <h1 className="m-0 text-[var(--text-3xl)]">Política de privacidade</h1>
        <p className="m-0 text-[var(--muted)]">
          Coletamos dados necessários para processar pedidos (nome, e-mail, CPF, telefone) e
          entregar o acesso aos produtos digitais adquiridos.
        </p>
        <p className="m-0 text-[var(--muted)]">
          Podemos usar cookies e pixels de marketing (como Meta) para medir campanhas e melhorar a
          experiência de compra. Você pode gerenciar cookies no seu navegador.
        </p>
        <p className="m-0 text-[var(--muted)]">
          Não vendemos seus dados pessoais. Pagamentos são processados por provedores terceiros
          (ex.: Mercado Pago) conforme as políticas deles.
        </p>
      </div>
    </MarketingShell>
  );
}
