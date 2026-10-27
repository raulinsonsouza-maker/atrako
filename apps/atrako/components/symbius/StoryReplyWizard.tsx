"use client";

import { useState } from "react";
import { Hash, Link2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui";
import { BackLink } from "@/components/ui/back-link";
import { ScriptBlock } from "@/components/atendimento/mensagens/ScriptBlock";
import { PhonePreview, type IgPreviewSection } from "./PhonePreview";
import {
  RadioOption,
  WizardFieldLabel,
  WizardLinkButtonEditor,
  useWorkspaceSaleLinks,
  wizardInputCls,
  wizardTextareaCls,
} from "./wizard-ui";

const DEFAULT_DM =
  "Quer receber mais informações? Toque no link e veja os detalhes.";

type StoryReplyWizardProps = {
  defaultName?: string;
  onCancel: () => void;
  onSaved: (fluxoId: string) => void;
  username?: string;
  workspaceId?: string;
};

export function StoryReplyWizard({
  defaultName = "Resposta ao Story → DM",
  onCancel,
  onSaved,
  username = "seu_perfil",
  workspaceId,
}: StoryReplyWizardProps) {
  const saleLinks = useWorkspaceSaleLinks(workspaceId);
  const [nome, setNome] = useState(defaultName);
  const [storyFilter, setStoryFilter] = useState<"any" | "specific">("any");
  const [anyKeyword, setAnyKeyword] = useState(true);
  const [keywords, setKeywords] = useState("");
  const [dmText, setDmText] = useState(DEFAULT_DM);
  const [buttonLabel, setButtonLabel] = useState("Acessar");
  const [linkUrl, setLinkUrl] = useState("");
  const [open, setOpen] = useState<IgPreviewSection | null>("reward");
  const [loading, setLoading] = useState(false);

  function select(section: IgPreviewSection) {
    setOpen((current) => (current === section ? null : section));
  }

  const keywordPreview = anyKeyword
    ? "qualquer resposta"
    : keywords.split(",")[0]?.trim() || "…";

  async function activate() {
    if (!nome.trim()) {
      alert("Digite um nome");
      return;
    }
    if (!dmText.trim()) {
      alert("Escreva a mensagem");
      return;
    }
    if (!anyKeyword && !keywords.trim()) {
      alert("Informe palavras-chave ou escolha qualquer resposta");
      return;
    }

    setLoading(true);
    try {
      const baseUrl = workspaceId
        ? `/api/symbius/flows?workspaceId=${encodeURIComponent(workspaceId)}`
        : `/api/symbius/flows`;
      const res = await fetch(baseUrl, {
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
    <div className="script-grid px-4 py-5 md:px-6">
      <div className="script-list">
        <div className="mb-2 flex items-center justify-between gap-3">
          <BackLink onClick={onCancel}>Automações</BackLink>
          <Button type="button" size="toolbar" disabled={loading} onClick={() => void activate()}>
            {loading ? "Ativando…" : "Ativar"}
          </Button>
        </div>
        <h1 className="type-tagline text-[var(--ink)]">Quando respondem o story</h1>
        <p className="type-caption text-[var(--ink-muted-48)]">
          A mensagem aparece no celular enquanto você escreve.
        </p>

        <div className="mt-2">
          <WizardFieldLabel>Nome interno</WizardFieldLabel>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className={wizardInputCls} />
        </div>

        <ScriptBlock
          icon={MessageCircle}
          title="Story"
          summary={storyFilter === "any" ? "Qualquer story" : "Um story"}
          open={open === "post"}
          onToggle={() => select("post")}
        >
          <div className="space-y-2">
            <RadioOption selected={storyFilter === "any"} title="Qualquer story" onClick={() => setStoryFilter("any")} />
            <RadioOption selected={storyFilter === "specific"} disabled title="Um story específico, em breve" />
          </div>
        </ScriptBlock>

        <ScriptBlock
          icon={Hash}
          title="Resposta"
          summary={anyKeyword ? "Qualquer resposta" : keywords || "Palavras específicas"}
          open={open === "keyword"}
          onToggle={() => select("keyword")}
        >
          <div className="space-y-2">
            <RadioOption selected={anyKeyword} title="Qualquer resposta" onClick={() => setAnyKeyword(true)} />
            <RadioOption selected={!anyKeyword} title="Palavras específicas" onClick={() => setAnyKeyword(false)}>
              {!anyKeyword ? (
                <input
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  className={wizardInputCls}
                  placeholder="Preço, link, quero"
                />
              ) : null}
            </RadioOption>
          </div>
        </ScriptBlock>

        <ScriptBlock
          icon={Link2}
          title="Mensagem com o link"
          summary={dmText.split("\n")[0]}
          chips={[buttonLabel || "Acessar"]}
          open={open === "reward"}
          onToggle={() => select("reward")}
        >
          <textarea value={dmText} onChange={(e) => setDmText(e.target.value)} className={wizardTextareaCls} />
          <WizardLinkButtonEditor
            buttonLabel={buttonLabel}
            url={linkUrl}
            saleLinks={saleLinks}
            onChange={(button, url) => {
              setButtonLabel(button);
              setLinkUrl(url);
            }}
          />
        </ScriptBlock>
      </div>

      <PhonePreview
        scene="story"
        section={open}
        onSection={setOpen}
        username={username}
        commentText={keywordPreview}
        rewardText={dmText}
        rewardButton={buttonLabel}
        showReward
      />
    </div>
  );
}
