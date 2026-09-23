"use client";

import { useState } from "react";
import { PhonePreview } from "./PhonePreview";
import {
  ActivateButton,
  RadioOption,
  WizardBackButton,
  WizardFieldLabel,
  WizardLayout,
  WizardLinkButtonEditor,
  WizardSectionTitle,
  WizardTitle,
  wizardInputCls,
  wizardTextareaCls,
} from "./wizard-ui";

const DEFAULT_DM =
  "🔥 Quer receber mais informações? Clique no link abaixo e veja todos os detalhes 👇";

type StoryReplyWizardProps = {
  defaultName?: string;
  onCancel: () => void;
  onSaved: (fluxoId: string) => void;
  username?: string;
};

export function StoryReplyWizard({
  defaultName = "Resposta ao Story → DM",
  onCancel,
  onSaved,
  username = "seu_perfil",
}: StoryReplyWizardProps) {
  const [nome, setNome] = useState(defaultName);
  const [storyFilter, setStoryFilter] = useState<"any" | "specific">("any");
  const [anyKeyword, setAnyKeyword] = useState(true);
  const [keywords, setKeywords] = useState("");
  const [dmText, setDmText] = useState(DEFAULT_DM);
  const [buttonLabel, setButtonLabel] = useState("Acessar");
  const [linkUrl, setLinkUrl] = useState("");
  const [previewTab, setPreviewTab] = useState<"post" | "comment" | "dm">("dm");
  const [loading, setLoading] = useState(false);

  async function activate() {
    if (!nome.trim()) {
      alert("Digite um nome");
      return;
    }
    if (!dmText.trim()) {
      alert("Escreva a DM");
      return;
    }
    if (!anyKeyword && !keywords.trim()) {
      alert("Informe palavras-chave ou escolha qualquer resposta");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/symbius/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          template: "story_dm",
          messageText: dmText.trim(),
          status: "PUBLISHED",
          triggerConfig: {
            storyFilter,
            anyKeyword,
            keywords: anyKeyword
              ? []
              : keywords
                  .split(",")
                  .map((k) => k.trim().toLowerCase())
                  .filter(Boolean),
            rewardText: dmText.trim(),
            rewardButton: buttonLabel.trim() || "Acessar",
            rewardUrl: linkUrl.trim(),
            welcomeEnabled: false,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro");
      onSaved(data.fluxo.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <WizardLayout
      form={
        <>
          <WizardBackButton onClick={onCancel}>
            ← Voltar aos modelos
          </WizardBackButton>

          <WizardTitle>Quando alguém responder</WizardTitle>

          <div className="mt-5">
            <WizardFieldLabel>Nome interno</WizardFieldLabel>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className={wizardInputCls}
            />
          </div>

          <section className="mt-7 space-y-2">
            <RadioOption
              selected={storyFilter === "any"}
              title="Qualquer story"
              onClick={() => setStoryFilter("any")}
            />
            <RadioOption
              selected={storyFilter === "specific"}
              disabled
              title="Um story específico (em breve)"
            />
          </section>

          <section className="mt-7">
            <WizardSectionTitle>E essa resposta contém</WizardSectionTitle>
            <div className="mt-2.5 space-y-2">
              <RadioOption
                selected={!anyKeyword}
                title="Palavras ou reações específicas"
                onClick={() => {
                  setAnyKeyword(false);
                  setPreviewTab("dm");
                }}
              />
              {!anyKeyword && (
                <input
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  className={`${wizardInputCls} ml-[30px] w-[calc(100%-30px)]`}
                  placeholder="Preço, link, quero"
                />
              )}
              <RadioOption
                selected={anyKeyword}
                title="Qualquer palavra-chave ou reação"
                onClick={() => setAnyKeyword(true)}
              />
            </div>
          </section>

          <section className="mt-7 pb-4">
            <WizardSectionTitle>A DM com o link será enviada</WizardSectionTitle>
            <div className="mt-2.5 space-y-2 rounded-xl border border-zinc-200 bg-white p-3.5">
              <textarea
                value={dmText}
                onChange={(e) => {
                  setDmText(e.target.value);
                  setPreviewTab("dm");
                }}
                className={wizardTextareaCls}
              />
              <WizardLinkButtonEditor
                buttonLabel={buttonLabel}
                url={linkUrl}
                onChange={(button, url) => {
                  setButtonLabel(button);
                  setLinkUrl(url);
                  setPreviewTab("dm");
                }}
              />
            </div>
          </section>
        </>
      }
      previewHeader={
        <>
          <p className="text-[13px] font-semibold text-zinc-600">
            Visualização
          </p>
          <ActivateButton loading={loading} onClick={activate} />
        </>
      }
      preview={
        <PhonePreview
          tab={previewTab === "post" ? "comment" : previewTab}
          onTabChange={(t) => setPreviewTab(t === "comment" ? "dm" : t)}
          username={username}
          commentText="resposta ao story"
          caption="Qualquer story"
          mediaUrl={null}
          welcomeText=""
          welcomeButton=""
          rewardText={dmText}
          rewardButton={buttonLabel}
          showReward
        />
      }
    />
  );
}
