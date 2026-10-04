"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ConfigPage,
  ConfigSection,
  SaveButton,
  useSaveConfig,
  useWorkspaceConfig,
} from "../_components";
import { BrandColorPicker } from "@/components/ui/brand-color-picker";
import { PillSelect } from "@/components/ui/pill-select";
import { TextField } from "@/components/ui/text-field";
import { DEFAULT_PRIMARY, normalizePrimaryHex } from "@/lib/brand/primaryColor";

const TIMEZONES = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Belem",
  "America/Fortaleza",
  "America/Recife",
  "America/Bahia",
  "America/Cuiaba",
  "America/Porto_Velho",
  "America/Rio_Branco",
  "America/Noronha",
];

const CURRENCIES = [
  { value: "BRL", label: "Real (BRL)" },
  { value: "USD", label: "Dólar (USD)" },
  { value: "EUR", label: "Euro (EUR)" },
];

const SOCIALS = [
  ["instagram", "Instagram"],
  ["facebook", "Facebook"],
  ["tiktok", "TikTok"],
  ["youtube", "YouTube"],
  ["whatsapp", "WhatsApp (link wa.me)"],
] as const;

export default function ConfigEmpresaPage() {
  const qc = useQueryClient();
  const { data: config, isLoading } = useWorkspaceConfig();
  const { save, saving, saved, error, markDirty } = useSaveConfig();

  const [nome, setNome] = useState("");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [currency, setCurrency] = useState("BRL");
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY);
  const [senderName, setSenderName] = useState("");
  const [storeUrl, setStoreUrl] = useState("");
  const [footerAddress, setFooterAddress] = useState("");
  const [socials, setSocials] = useState<Record<string, string>>({});
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!config) return;
    setNome(config.workspace?.name ?? "");
    setTimezone(config.settings?.timezone ?? "America/Sao_Paulo");
    setCurrency(config.settings?.currency ?? "BRL");
    setPrimaryColor(normalizePrimaryHex(config.settings?.primaryColor) ?? DEFAULT_PRIMARY);
    const mp = (config.settings?.messagingPrefs ?? {}) as Record<string, unknown>;
    setSenderName(typeof mp.senderName === "string" ? mp.senderName : "");
    setStoreUrl(typeof mp.storeUrl === "string" ? mp.storeUrl : "");
    setFooterAddress(typeof mp.footerAddress === "string" ? mp.footerAddress : "");
    setSocials(
      mp.socials && typeof mp.socials === "object" ? (mp.socials as Record<string, string>) : {},
    );
  }, [config]);

  function edit<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      markDirty();
    };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const hex = normalizePrimaryHex(primaryColor);
    if (!hex) {
      setLocalError("Cor inválida.");
      return;
    }
    setLocalError(null);
    const ok = await save({
      nome,
      timezone,
      currency,
      primaryColor: hex,
      messagingPrefs: {
        senderName: senderName.trim() || null,
        storeUrl: storeUrl.trim() || null,
        footerAddress: footerAddress.trim() || null,
        socials: Object.fromEntries(
          Object.entries(socials).filter(([, v]) => /^https?:\/\//i.test(v.trim())),
        ),
      },
    });
    if (ok) await qc.invalidateQueries({ queryKey: ["brand-clientes"] });
  }

  const message = localError || error;

  return (
    <ConfigPage
      title="Empresa"
      loading={isLoading}
      actions={<SaveButton form="empresa-form" saving={saving} saved={saved} disabled={isLoading} />}
    >
      <form id="empresa-form" onSubmit={onSubmit} className="flex flex-col gap-6">
        <ConfigSection title="Identidade" description="Como a empresa aparece para a equipe e clientes.">
          <TextField
            label="Nome"
            value={nome}
            onChange={(e) => edit(setNome)(e.target.value)}
            placeholder="Nome da empresa"
            required
          />
          <div>
            <p className="mb-3 type-caption-strong text-[var(--ink)]">Cor da marca</p>
            <BrandColorPicker
              value={primaryColor}
              onChange={edit(setPrimaryColor)}
              brandName={nome || "Sua marca"}
            />
          </div>
        </ConfigSection>

        <ConfigSection title="Região" description="Usado em agendas, relatórios e valores.">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="type-caption-strong text-[var(--ink)]">Fuso horário</p>
              <PillSelect
                className="mt-2 w-full"
                size="field"
                value={timezone}
                onChange={edit(setTimezone)}
                options={[
                  ...(!TIMEZONES.includes(timezone) ? [{ value: timezone, label: timezone }] : []),
                  ...TIMEZONES.map((tz) => ({
                    value: tz,
                    label: tz.replace("America/", "").replace(/_/g, " "),
                  })),
                ]}
                aria-label="Fuso horário"
              />
            </div>
            <div>
              <p className="type-caption-strong text-[var(--ink)]">Moeda</p>
              <PillSelect
                className="mt-2 w-full"
                size="field"
                value={currency}
                onChange={edit(setCurrency)}
                options={[
                  ...CURRENCIES,
                  ...(!CURRENCIES.some((c) => c.value === currency)
                    ? [{ value: currency, label: currency }]
                    : []),
                ]}
                aria-label="Moeda"
              />
            </div>
          </div>
        </ConfigSection>

        <ConfigSection
          title="Contato e rodapé"
          description="Aparece no rodapé dos e-mails e mensagens. O endereço é exigido pelas regras anti-spam."
        >
          <TextField
            label="Nome exibido nas mensagens"
            value={senderName}
            onChange={(e) => edit(setSenderName)(e.target.value)}
            placeholder={nome || "Nome da loja"}
            hint={
              <>
                O remetente do e-mail (endereço de envio) fica em{" "}
                <Link href="/config/conexoes" className="text-[var(--primary)] underline-offset-2 hover:underline">
                  Integrações → E-mail
                </Link>.
              </>
            }
          />
          <TextField
            label="Site da loja"
            value={storeUrl}
            onChange={(e) => edit(setStoreUrl)(e.target.value)}
            placeholder="https://minhaloja.com.br"
          />
          <TextField
            label="Endereço no rodapé"
            value={footerAddress}
            onChange={(e) => edit(setFooterAddress)(e.target.value)}
            placeholder="Rua, número — Cidade/UF — CNPJ"
          />
          <div className="grid gap-5 sm:grid-cols-2">
            {SOCIALS.map(([key, label]) => (
              <TextField
                key={key}
                label={label}
                value={socials[key] ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setSocials((s) => ({ ...s, [key]: v }));
                  markDirty();
                }}
                placeholder="https://"
              />
            ))}
          </div>
        </ConfigSection>

        {message ? <p className="type-caption text-[var(--danger)]">{message}</p> : null}
      </form>
    </ConfigPage>
  );
}
