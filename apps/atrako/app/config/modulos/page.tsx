"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { MODULES, MODULE_RELEASE_LABELS, type ModuleDef, type ModuleKey } from "@/lib/modules/registry";
import { ConfigPage, ConfigSection, useSaveConfig, useWorkspaceConfig } from "../_components";

export default function ConfigModulosPage() {
  const { data: config, isLoading, isError } = useWorkspaceConfig();
  const { save, saving, error } = useSaveConfig();
  const [confirming, setConfirming] = useState<ModuleKey | null>(null);
  const [pendingKey, setPendingKey] = useState<ModuleKey | null>(null);

  const modules = config?.modules;
  const canManage = config?.canManage === true;

  const optional = MODULES.filter((m) => !m.core && modules?.[m.key] && modules[m.key].release !== "HIDDEN");
  const hiddenPreview = MODULES.filter((m) => modules?.[m.key]?.preview);
  const core = MODULES.filter((m) => m.core);

  async function apply(key: ModuleKey, enabled: boolean) {
    setConfirming(null);
    setPendingKey(key);
    await save({ modulesEnabled: { [key]: enabled } });
    setPendingKey(null);
  }

  function toggle(def: ModuleDef, next: boolean) {
    if (!next && def.disableWarning) {
      setConfirming(def.key);
      return;
    }
    void apply(def.key, next);
  }

  return (
    <ConfigPage title="Módulos" loading={isLoading}>
      {isError || !modules ? (
        <p className="type-caption text-[var(--danger)]">Não foi possível carregar os módulos.</p>
      ) : (
        <>
          <ConfigSection
            title="Módulos do workspace"
            description={
              canManage
                ? "Módulo desligado some do menu, do Criar e das Integrações para toda a equipe."
                : "Só o dono ou um admin do workspace pode ligar e desligar módulos."
            }
          >
            {optional.length === 0 ? (
              <p className="type-caption text-[var(--ink-muted-48)]">Nenhum módulo opcional disponível.</p>
            ) : (
              optional.map((def) => {
                const state = modules[def.key];
                const Icon = def.icon;
                return (
                  <div key={def.key} className="space-y-3">
                    <div className="flex items-center gap-3.5">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary-glow)] text-[var(--primary)]">
                        <Icon className="h-4 w-4" strokeWidth={1.75} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="type-caption-strong text-[var(--ink)]">{def.label}</span>
                          {state.release === "BETA" ? (
                            <span className="rounded-full bg-[var(--surface-pearl)] px-2 py-0.5 type-fine-print text-[var(--ink-muted-80)]">
                              {MODULE_RELEASE_LABELS.BETA}
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block type-fine-print text-[var(--ink-muted-48)]">
                          {def.description}
                        </span>
                      </span>
                      <Switch
                        checked={state.enabled}
                        onChange={(next) => toggle(def, next)}
                        disabled={!canManage || saving || confirming === def.key}
                        aria-label={`${state.enabled ? "Desligar" : "Ligar"} ${def.label}`}
                      />
                    </div>
                    {confirming === def.key ? (
                      <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-xs)] bg-[var(--surface-pearl)] px-3 py-2.5">
                        <p className="min-w-0 flex-1 type-fine-print text-[var(--ink-muted-80)]">
                          {def.disableWarning} Deseja desligar {def.label}?
                        </p>
                        <Button type="button" variant="ghost" size="toolbar" onClick={() => setConfirming(null)}>
                          Cancelar
                        </Button>
                        <Button
                          type="button"
                          variant="dark-utility"
                          size="toolbar"
                          onClick={() => void apply(def.key, false)}
                        >
                          Desligar
                        </Button>
                      </div>
                    ) : null}
                    {pendingKey === def.key && saving ? (
                      <p className="type-fine-print text-[var(--ink-muted-48)]">Salvando…</p>
                    ) : null}
                  </div>
                );
              })
            )}
            {error ? <p className="type-caption text-[var(--danger)]">{error}</p> : null}
          </ConfigSection>

          {hiddenPreview.length > 0 ? (
            <ConfigSection
              title="Ocultos para clientes"
              description="Você vê em preview por ser da equipe Atrako. O status global é definido no painel da plataforma."
            >
              {hiddenPreview.map((def) => (
                <ModuleInfoRow key={def.key} def={def} note={MODULE_RELEASE_LABELS.HIDDEN} />
              ))}
            </ConfigSection>
          ) : null}

          <ConfigSection title="Sempre ativos" description="Fazem parte do núcleo do Atrako.">
            {core.map((def) => (
              <ModuleInfoRow key={def.key} def={def} note="Núcleo" />
            ))}
          </ConfigSection>
        </>
      )}
    </ConfigPage>
  );
}

function ModuleInfoRow({ def, note }: { def: ModuleDef; note: string }) {
  const Icon = def.icon;
  return (
    <div className="flex items-center gap-3.5">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-pearl)] text-[var(--ink-muted-80)]">
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block type-caption-strong text-[var(--ink)]">{def.label}</span>
        <span className="mt-0.5 block type-fine-print text-[var(--ink-muted-48)]">{def.description}</span>
      </span>
      <span className="shrink-0 type-fine-print text-[var(--ink-muted-48)]">{note}</span>
    </div>
  );
}
