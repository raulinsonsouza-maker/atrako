"use client";

import { useEffect, useState } from "react";
import { Button, Switch } from "@/components/ui";
import { BackLink } from "@/components/ui/back-link";
import { IgMediaPicker, type IgMediaItem } from "./IgMediaPicker";
import { IgStoryPreview, type IgStoryScene } from "./IgStoryPreview";
import {
  RadioOption,
  TagChip,
  WizardLayout,
  WizardLinkButtonEditor,
  useWorkspaceSaleLinks,
  wizardInputCls,
  wizardTextareaCls,
} from "./wizard-ui";

const SUGGESTED = ["Quero", "Link", "Preço"];

const DEFAULT_DM = "Quer receber mais informações? Toque no link e veja os detalhes.";

const DEFAULT_FOLLOW =
  "Obrigado pelo interesse! Este conteúdo é para quem segue o perfil. Siga a página que eu envio o link.";

const DEFAULT_EMAIL = "Me diga seu e-mail para receber o link.";

const DEFAULT_REMINDER = "Se ainda fizer sentido, o link continua aqui.";

export type StoryReplyInitial = {
  fluxoId: string;
  nome?: string;
  storyFilter?: "any" | "specific";
  storyId?: string | null;
  anyKeyword?: boolean;
  keywords?: string[];
  rewardText?: string;
  rewardButton?: string;
  rewardUrl?: string;
  rewardLinks?: Array<{ label: string; url: string }>;
  followEnabled?: boolean;
  followText?: string;
  emailEnabled?: boolean;
  emailText?: string;
  reminderEnabled?: boolean;
  reminderText?: string;
  reminderMinutes?: number;
  reactLove?: boolean;
};

type StoryReplyWizardProps = {
  defaultName?: string;
  initial?: StoryReplyInitial;
  onCancel: () => void;
  onSaved: (fluxoId: string) => void;
  username?: string;
  workspaceId?: string;
};

export function StoryReplyWizard({
  defaultName = "Resposta ao Story → DM",
  initial,
  onCancel,
  onSaved,
  username = "seu_perfil",
  workspaceId,
}: StoryReplyWizardProps) {
  const saleLinks = useWorkspaceSaleLinks(workspaceId);
  const [nome] = useState(initial?.nome?.trim() || defaultName);
  const [storyFilter, setStoryFilter] = useState<"any" | "specific">(
    initial?.storyFilter === "specific" ? "specific" : "any",
  );
  const [storyId, setStoryId] = useState<string | null>(initial?.storyId ?? null);
  const [stories, setStories] = useState<IgMediaItem[]>([]);
  const [storiesWarning, setStoriesWarning] = useState<string | null>(null);
  const [loadingStories, setLoadingStories] = useState(true);
  const seedKeywords = initial?.keywords?.length ? initial.keywords : [];
  const [anyKeyword, setAnyKeyword] = useState(initial?.anyKeyword !== false);
  const [keywords, setKeywords] = useState<string[]>(seedKeywords);
  const [keywordInput, setKeywordInput] = useState(seedKeywords.join(", "));
  const [dmText, setDmText] = useState(initial?.rewardText?.trim() || DEFAULT_DM);
  const [buttonLabel, setButtonLabel] = useState(
    initial?.rewardLinks?.[0]?.label || initial?.rewardButton || "Acessar",
  );
  const [linkUrl, setLinkUrl] = useState(initial?.rewardLinks?.[0]?.url || initial?.rewardUrl || "");
  const [followEnabled, setFollowEnabled] = useState(initial?.followEnabled ?? false);
  const [followText, setFollowText] = useState(initial?.followText?.trim() || DEFAULT_FOLLOW);
  const [emailEnabled, setEmailEnabled] = useState(initial?.emailEnabled ?? false);
  const [emailText, setEmailText] = useState(initial?.emailText?.trim() || DEFAULT_EMAIL);
  const [reminderEnabled, setReminderEnabled] = useState(initial?.reminderEnabled ?? false);
  const [reminderText, setReminderText] = useState(initial?.reminderText?.trim() || DEFAULT_REMINDER);
  const [reminderMinutes, setReminderMinutes] = useState(initial?.reminderMinutes ?? 30);
  const [reactLove, setReactLove] = useState(initial?.reactLove ?? false);
  const [scene, setScene] = useState<IgStoryScene>("story");
  const [loading, setLoading] = useState(false);

  function reloadStories() {
    setLoadingStories(true);
    setStoriesWarning(null);
    const url = workspaceId
      ? `/api/symbius/instagram/media?kind=stories&workspaceId=${encodeURIComponent(workspaceId)}`
      : `/api/symbius/instagram/media?kind=stories`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        const items = (d.media ?? []) as IgMediaItem[];
        setStories(items);
        const warning = d.warning || d.error;
        if (warning) setStoriesWarning(String(warning));
        if (!storyId && items[0] && storyFilter === "specific") setStoryId(items[0].id);
      })
      .catch(() => setStoriesWarning("Não foi possível listar os stories."))
      .finally(() => setLoadingStories(false));
  }

  useEffect(() => {
    reloadStories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = stories.find((item) => item.id === storyId);
  const thumb = selected?.thumbnail_url || selected?.media_url;
  const replyPreview = anyKeyword ? "qualquer resposta" : keywords[0] || keywordInput.split(",")[0]?.trim() || "…";
  const previewText = emailEnabled ? emailText : followEnabled ? followText : dmText;
  const previewButton = emailEnabled || followEnabled || !linkUrl.trim() ? "" : buttonLabel;

  function parseKeywords(raw: string) {
    return raw
      .split(",")
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);
  }

  function addSuggested(word: string) {
    const next = parseKeywords(`${keywordInput}${keywordInput.trim() ? ", " : ""}${word}`);
    setKeywords(next);
    setKeywordInput(next.join(", "));
  }

  async function activate() {
    if (!nome.trim()) {
      alert("Digite um nome");
      return;
    }
    if (storyFilter === "specific" && !storyId) {
      alert("Escolha um story");
      return;
    }
    if (!dmText.trim()) {
      alert("Escreva a mensagem");
      return;
    }
    if (!anyKeyword && !keywords.length) {
      alert("Informe palavras-chave ou escolha qualquer resposta");
      return;
    }

    const readyLink = linkUrl.trim()
      ? { label: buttonLabel.trim() || "Acessar", url: linkUrl.trim() }
      : null;

    setLoading(true);
    try {
      const baseUrl = workspaceId
        ? `/api/symbius/flows?workspaceId=${encodeURIComponent(workspaceId)}`
        : `/api/symbius/flows`;
      const triggerConfig = {
        storyFilter,
        storyId: storyFilter === "specific" ? storyId : "",
        anyKeyword,
        keywords: anyKeyword ? [] : keywords,
        rewardText: dmText.trim(),
        rewardButton: readyLink?.label || "Acessar",
        rewardUrl: readyLink?.url || "",
        rewardLinks: readyLink ? [readyLink] : [],
        reactLove,
        followEnabled,
        followText: followText.trim(),
        emailEnabled,
        emailText: emailText.trim(),
        reminderEnabled,
        reminderText: reminderText.trim(),
        reminderMinutes,
      };
      const res = await fetch(baseUrl, {
        method: initial?.fluxoId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          initial?.fluxoId
            ? {
                id: initial.fluxoId,
                nome: nome.trim(),
                status: "PUBLISHED",
                triggerType: "story_reply",
                triggerConfig,
              }
            : {
                nome: nome.trim(),
                template: "story_dm",
                messageText: dmText.trim(),
                status: "PUBLISHED",
                triggerConfig,
              },
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro");
      onSaved(initial?.fluxoId || data.fluxo.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  const form = (
    <div className="space-y-5">
      <BackLink onClick={onCancel}>Automações</BackLink>
      <h1 className="type-tagline text-[var(--ink)]">Quando alguém responder</h1>

      <div className="space-y-2">
        <RadioOption
          selected={storyFilter === "any"}
          title="Qualquer story"
          onClick={() => {
            setStoryFilter("any");
            setStoryId(null);
          }}
        />
        <RadioOption selected={storyFilter === "specific"} title="Um story específico" onClick={() => setStoryFilter("specific")}>
          {storyFilter === "specific" ? (
            <IgMediaPicker
              media={stories}
              selectedId={storyId}
              onSelect={setStoryId}
              loading={loadingStories}
              warning={storiesWarning}
              onRetry={reloadStories}
              emptyLabel="Nenhum story ativo agora. Publique um story ou escolha “qualquer story”."
            />
          ) : null}
        </RadioOption>
      </div>

      <div className="space-y-2">
        <p className="type-body-strong text-[var(--ink)]">E essa resposta contém</p>
        <RadioOption selected={!anyKeyword} title="Palavras ou reações específicas" onClick={() => setAnyKeyword(false)}>
          {!anyKeyword ? (
            <div className="space-y-2">
              <input
                value={keywordInput}
                onChange={(e) => {
                  setKeywordInput(e.target.value);
                  setKeywords(parseKeywords(e.target.value));
                }}
                className={wizardInputCls}
                placeholder="Quero, link"
              />
              <p className="type-fine-print text-[var(--ink-muted-48)]">Use vírgulas para separar as palavras</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="type-fine-print text-[var(--ink-muted-48)]">Por exemplo:</span>
                {SUGGESTED.map((word) => (
                  <TagChip key={word} onClick={() => addSuggested(word)}>
                    {word}
                  </TagChip>
                ))}
              </div>
            </div>
          ) : null}
        </RadioOption>
        <RadioOption selected={anyKeyword} title="Qualquer palavra-chave ou reação" onClick={() => setAnyKeyword(true)} />
      </div>

      <div className="space-y-3">
        <p className="type-body-strong text-[var(--ink)]">A DM com o link será enviada</p>
        <p className="type-caption text-[var(--ink-muted-48)]">Uma DM contendo um link</p>
        <textarea value={dmText} onChange={(e) => setDmText(e.target.value.slice(0, 1000))} className={wizardTextareaCls} />
        <p className="text-right type-micro-legal text-[var(--ink-muted-48)]">{dmText.length}</p>
        <WizardLinkButtonEditor
          single
          buttonLabel={buttonLabel}
          url={linkUrl}
          saleLinks={saleLinks}
          onChange={(button, url) => {
            setButtonLabel(button);
            setLinkUrl(url);
          }}
        />
      </div>

      <div className="space-y-3">
        <p className="type-body-strong text-[var(--ink)]">Outros recursos para automatizar</p>
        <label className="flex items-center justify-between gap-3">
          <span className="type-caption text-[var(--ink)]">Responda às interações nos stories com ❤️</span>
          <Switch checked={reactLove} onChange={setReactLove} aria-label="Responder às interações nos stories com coração" />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span className="type-caption text-[var(--ink)]">Acompanhamento se o link não for aberto</span>
          <Switch checked={reminderEnabled} onChange={setReminderEnabled} aria-label="Acompanhamento se o link não for aberto" />
        </label>
        {reminderEnabled ? (
          <>
            <textarea value={reminderText} onChange={(e) => setReminderText(e.target.value)} className={wizardTextareaCls} />
            <div className="flex items-center gap-2">
              <span className="type-fine-print text-[var(--ink-muted-48)]">Enviar após</span>
              <input
                type="number"
                min={5}
                max={1440}
                value={reminderMinutes}
                onChange={(e) => setReminderMinutes(Number(e.target.value) || 30)}
                className={`${wizardInputCls} w-20`}
              />
              <span className="type-fine-print text-[var(--ink-muted-48)]">minutos</span>
            </div>
          </>
        ) : null}
        <label className="flex items-center justify-between gap-3">
          <span className="type-caption text-[var(--ink)]">Pedir para seguir antes de enviar o link</span>
          <Switch checked={followEnabled} onChange={setFollowEnabled} aria-label="Pedir para seguir antes de enviar o link" />
        </label>
        {followEnabled ? <textarea value={followText} onChange={(e) => setFollowText(e.target.value)} className={wizardTextareaCls} /> : null}
        <label className="flex items-center justify-between gap-3">
          <span className="type-caption text-[var(--ink)]">Pedir e-mail</span>
          <Switch checked={emailEnabled} onChange={setEmailEnabled} aria-label="Pedir e-mail" />
        </label>
        {emailEnabled ? <textarea value={emailText} onChange={(e) => setEmailText(e.target.value)} className={wizardTextareaCls} /> : null}
      </div>
    </div>
  );

  return (
    <WizardLayout
      previewHeader={
        <>
          <span className="type-caption text-[var(--ink-muted-48)]">Visualização</span>
          <Button type="button" size="toolbar" disabled={loading} onClick={() => void activate()}>
            {loading ? "Ativando…" : "Ativar"}
          </Button>
        </>
      }
      form={form}
      preview={
        <IgStoryPreview
          scene={scene}
          onScene={setScene}
          username={username}
          mediaUrl={thumb}
          replyText={replyPreview}
          dmText={previewText}
          dmButton={previewButton}
        />
      }
    />
  );
}
