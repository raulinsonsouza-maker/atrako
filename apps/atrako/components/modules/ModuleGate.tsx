import Link from "next/link";
import { EyeOff, PowerOff } from "lucide-react";
import { AppPage } from "@/components/layout/AppPage";
import { buttonClass } from "@/components/ui/button";
import { getModuleDef, type ModuleKey } from "@/lib/modules/registry";
import { requireModulePage } from "@/lib/modules/page";

/**
 * Gate de módulo para layouts de página.
 * Desligado → tela "Módulo desativado"; preview de staff → aviso "Oculto para clientes".
 */
export async function ModuleGate({
  moduleKey,
  children,
}: {
  moduleKey: ModuleKey;
  children: React.ReactNode;
}) {
  const gate = await requireModulePage(moduleKey);
  const def = getModuleDef(moduleKey);

  if (!gate.ok) {
    return (
      <AppPage title={def.label} narrow>
        <div className="utility-card flex flex-col items-start gap-4 !p-6">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-pearl)] text-[var(--ink-muted-80)]">
            <PowerOff className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div className="space-y-1">
            <h2 className="type-body-strong text-[var(--ink)]">Módulo desativado</h2>
            <p className="type-caption text-[var(--ink-muted-48)]">
              {gate.state?.release === "HIDDEN"
                ? `${def.label} ainda não está disponível.`
                : gate.canManage
                  ? `${def.label} está desligado neste workspace. Você pode ativar em Configuração → Módulos.`
                  : `${def.label} está desligado neste workspace. Peça ao responsável pela conta para ativar.`}
            </p>
          </div>
          {gate.canManage && gate.state?.release !== "HIDDEN" ? (
            <Link href="/config/modulos" className={buttonClass({ variant: "primary", size: "toolbar" })}>
              Abrir Módulos
            </Link>
          ) : (
            <Link href="/assistente" className={buttonClass({ variant: "outline", size: "toolbar" })}>
              Voltar ao início
            </Link>
          )}
        </div>
      </AppPage>
    );
  }

  if (gate.state.preview) {
    return (
      <>
        <div className="flex items-center gap-2 border-b border-[var(--hairline)] bg-[var(--surface-pearl)] px-5 py-2 type-fine-print text-[var(--ink-muted-80)]">
          <EyeOff className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          <span>
            {def.label} está oculto para clientes. Você vê em preview por ser da equipe Atrako.
          </span>
        </div>
        {children}
      </>
    );
  }

  return <>{children}</>;
}
