import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Circular de Oferta de Franquia (COF) — Regicenter",
  description:
    "Circular de Oferta de Franquia (COF) da Regicenter, conforme a Lei 13.966/2019. Documento oficial com informações sobre investimento, royalties, obrigações e suporte.",
};

export default function CofPage() {
  return (
    <main className="min-h-screen bg-neutral-50 py-8 px-4">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-4 text-2xl font-semibold text-neutral-900">
          Circular de Oferta de Franquia (COF) — Regicenter
        </h1>
        <p className="mb-6 text-sm text-neutral-600">
          Documento oficial conforme a Lei 13.966/2019. Visualize abaixo ou{" "}
          <a
            href="/lp/regicenter-franquia/assets/COF-2025.pdf"
            download="COF-Regicenter-2025.pdf"
            className="text-primary-600 underline hover:text-primary-700"
          >
            baixe o PDF
          </a>
          .
        </p>
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
          <iframe
            src="/lp/regicenter-franquia/assets/COF-2025.pdf"
            className="h-[80vh] w-full"
            title="COF Regicenter 2025"
          />
        </div>
      </div>
    </main>
  );
}