import { ThemeSection } from "@/components/features/ThemeSection";

export default function SuperAdminConfiguracoesPage() {
  return (
    <div className="max-w-2xl space-y-8">
      <ThemeSection />
      <div>
        <h2 className="mb-2 text-xl font-semibold text-neutral-900 dark:text-neutral-100">Configurações</h2>
        <p className="text-neutral-600 dark:text-neutral-400">Configurações da agência e suporte (em breve).</p>
      </div>
    </div>
  );
}
