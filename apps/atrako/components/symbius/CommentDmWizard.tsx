"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Switch } from "@/components/ui";
import { BackLink } from "@/components/ui/back-link";
import { IgCommentPreview, type IgPreviewScene } from "./IgCommentPreview";
import { IgMediaPicker, type IgMediaItem } from "./IgMediaPicker";
import {
  RadioOption,
  TagChip,
  WizardLayout,
  wizardInputCls,
  wizardTextareaCls,
} from "./wizard-ui";

type MediaItem = IgMediaItem;

export type CommentDmConfig = {
  nome: string;
  mediaFilter: "any" | "specific" | "next";
  mediaId: string | null;
  anyKeyword: boolean;
  keywords: string[];
  replyToComment: boolean;
  publicReplies: string[];
  welcomeEnabled: boolean;
  welcomeText: string;
  welcomeButton: string;
  followEnabled: boolean;
  followText: string;
  followButton: string;
  emailEnabled: boolean;
  emailText: string;
  rewardText: string;
  rewardButton: string;
  rewardUrl: string;
  rewardLinks: Array<{ label: string; url: string }>;
  reminderEnabled: boolean;
  reminderText: string;
  reminderMinutes: number;
};

const SUGGESTED = ["Preço", "Link", "Comprar", "Eu quero"];

const DEFAULT_WELCOME =
  "Olá! Eu estou muito feliz que você está aqui, muito obrigado pelo seu interesse 😊\n\nClique abaixo e eu vou te mandar o link em um segundo ✨";

const DEFAULT_FOLLOW =
  "Obrigado pelo interesse! 💞 Este conteúdo exclusivo é apenas para seguidores. Siga a página que enviarei o link imediatamente!";

const DEFAULT_EMAIL =
  "Diga-me qual é seu e-mail para receber o link!";

const DEFAULT_REMINDER =
  "Se ainda estiver curiosa, não esqueça de tocar no link ⬇️ Acho que você irá adorar ❤️";

type CommentDmWizardProps = {
  defaultName?: string;
  initial?: Partial<CommentDmConfig> & { fluxoId?: string };
  onCancel: () => void;
  onSaved: (fluxoId: string) => void;
  username?: string;
  workspaceId?: string;
};

export function CommentDmWizard({
  defaultName = "Comentário → DM",
  initial,
  onCancel,
  onSaved,
  username = "seu_perfil",
  workspaceId,
}: CommentDmWizardProps) {
  const [savedId, setSavedId] = useState<string | null>(initial?.fluxoId ?? null);
  const [nome] = useState(initial?.nome ?? defaultName);
  const [mediaFilter, setMediaFilter] = useState<"any" | "specific" | "next">(
    initial?.mediaFilter ?? "specific",
  );
  const [mediaId, setMediaId] = useState<string | null>(
    initial?.mediaId ?? null,
  );
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [mediaWarning, setMediaWarning] = useState<string | null>(null);
  const seedKeywords = initial?.keywords?.length ? initial.keywords : ["Eu quero"];
  const [anyKeyword, setAnyKeyword] = useState(initial?.anyKeyword ?? false);
  const [keywords, setKeywords] = useState<string[]>(seedKeywords);
  const [keywordInput, setKeywordInput] = useState(seedKeywords.join(", "));
  const [replyToComment, setReplyToComment] = useState(
    initial?.replyToComment ?? false,
  );
  const [publicReplies, setPublicReplies] = useState<string[]>(() => {
    const saved = initial?.publicReplies?.filter((item) => item.trim()) ?? [];
    return [saved[0] ?? "", saved[1] ?? "", saved[2] ?? ""];
  });
  const [step, setStep] = useState<"setup" | "message" | "live">("setup");
  const [scene, setScene] = useState<IgPreviewScene>("dm");
  const [whyWelcome, setWhyWelcome] = useState(false);
  const [liveId, setLiveId] = useState<string | null>(initial?.fluxoId ?? null);
  const [insights, setInsights] = useState<{ runs: number; sends: number; clicks: number; ctr: number; emails: number } | null>(null);
  const [welcomeEnabled, setWelcomeEnabled] = useState(
    initial?.welcomeEnabled ?? true,
  );
  const [welcomeText, setWelcomeText] = useState(
    initial?.welcomeText ?? DEFAULT_WELCOME,
  );
  const [welcomeButton, setWelcomeButton] = useState(
    initial?.welcomeButton ?? "Me envie o link",
  );
  const [followEnabled, setFollowEnabled] = useState(
    initial?.followEnabled ?? false,
  );
  const [followText, setFollowText] = useState(
    initial?.followText ?? DEFAULT_FOLLOW,
  );
  const [followButton] = useState(
    initial?.followButton ?? "Já sigo",
  );
  const [emailEnabled, setEmailEnabled] = useState(
    initial?.emailEnabled ?? false,
  );
  const [emailText, setEmailText] = useState(
    initial?.emailText ?? DEFAULT_EMAIL,
  );
  const [rewardText, setRewardText] = useState(
    initial?.rewardText ?? "Aqui está o seu acesso",
  );
  const [rewardButton] = useState(
    initial?.rewardButton ?? "Acessar",
  );
  const [rewardLinks, setRewardLinks] = useState<Array<{ label: string; url: string }>>(() => {
    if (initial?.rewardLinks?.length) return initial.rewardLinks.slice(0, 3);
    if (initial?.rewardUrl) return [{ label: initial.rewardButton ?? "Acessar", url: initial.rewardUrl }];
    return [{ label: "Acessar", url: "" }];
  });
  const [reminderEnabled, setReminderEnabled] = useState(
    initial?.reminderEnabled ?? false,
  );
  const [reminderText, setReminderText] = useState(
    initial?.reminderText ?? DEFAULT_REMINDER,
  );
  const [reminderMinutes, setReminderMinutes] = useState(
    initial?.reminderMinutes ?? 30,
  );
  const [loading, setLoading] = useState(false);
  const [loadingMedia, setLoadingMedia] = useState(true);

  function reloadMedia() {
    setLoadingMedia(true);
    setMediaWarning(null);
    const url = workspaceId ? `/api/symbius/instagram/media?workspaceId=${encodeURIComponent(workspaceId)}` : `/api/symbius/instagram/media`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        const items = (d.media ?? []) as MediaItem[];
        setMedia(items);
        const warning = d.warning || d.error;
        if (warning) setMediaWarning(String(warning));
        if (!mediaId && items[0] && mediaFilter === "specific") {
          setMediaId(items[0].id);
        }
      })
      .catch(() => setMediaWarning("Não foi possível listar as publicações."))
      .finally(() => setLoadingMedia(false));
  }

  useEffect(() => {
    reloadMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = media.find((m) => m.id === mediaId);
  const thumb =
    selected?.thumbnail_url || selected?.media_url || undefined;

  const commentPreview = useMemo(() => {
    if (anyKeyword) return "qualquer coisa";
    return keywords[0] || keywordInput.split(",")[0]?.trim() || "…";
  }, [anyKeyword, keywords, keywordInput]);

  function parseKeywords(raw: string): string[] {
    return raw
      .split(",")
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);
  }

  async function loadInsights(id: string) {
    const url = workspaceId
      ? `/api/symbius/flows/${id}?workspaceId=${encodeURIComponent(workspaceId)}`
      : `/api/symbius/flows/${id}`;
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    if (data.insights) setInsights(data.insights);
  }

  async function stopLive() {
    if (!liveId) return;
    await fetch(workspaceId ? `/api/symbius/flows?workspaceId=${encodeURIComponent(workspaceId)}` : "/api/symbius/flows", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: liveId, status: "DRAFT" }),
    });
    onSaved(liveId);
  }

  function addSuggested(s: string) {
    const next = parseKeywords(`${keywordInput}, ${s}`);
    setKeywordInput(next.join(", "));
    setKeywords(next);
    setAnyKeyword(false);
  }

  async function activate() {
    const kws = anyKeyword ? [] : parseKeywords(keywordInput);
    if (!nome.trim()) {
      alert("Digite um nome para a automação");
      return;
    }
    if (mediaFilter === "specific" && !mediaId) {
      alert("Selecione uma publicação");
      return;
    }
    if (!anyKeyword && kws.length === 0) {
      alert("Informe ao menos uma palavra-chave");
      return;
    }
    if (welcomeEnabled && !welcomeText.trim()) {
      alert("Escreva a mensagem de boas-vindas");
      return;
    }
    if (emailEnabled && !emailText.trim()) {
      alert("Escreva a mensagem pedindo o e-mail");
      return;
    }
    const replies = publicReplies.map((item) => item.trim()).filter(Boolean);
    const links = rewardLinks
      .map((item) => ({ label: item.label.trim() || "Acessar", url: item.url.trim() }))
      .filter((item) => item.url)
      .slice(0, 3);
    if (!rewardText.trim() && links.length === 0) {
      alert("Escreva a mensagem ou adicione um link");
      return;
    }
    if (reminderEnabled && links.length === 0) {
      alert("Adicione um link para usar o lembrete automático");
      return;
    }
    if (reminderEnabled && !reminderText.trim()) {
      alert("Escreva a mensagem de lembrete");
      return;
    }

    const triggerConfig = {
      keywords: kws,
      anyKeyword,
      mediaFilter,
      mediaId: mediaFilter === "specific" ? mediaId : undefined,
      replyToComment: replies.length > 0,
      publicReplies: replies,
      welcomeEnabled,
      welcomeText: welcomeText.trim(),
      welcomeButton: welcomeButton.trim() || "Me envie o link",
      followEnabled,
      followText: followText.trim(),
      followButton: followButton.trim() || "Já sigo",
      emailEnabled,
      emailText: emailText.trim(),
      rewardText: rewardText.trim(),
      rewardButton: links[0]?.label || rewardButton.trim() || "Acessar",
      rewardUrl: links[0]?.url ?? "",
      rewardLinks: links,
      reminderEnabled,
      reminderText: reminderText.trim(),
      reminderMinutes,
    };

    setLoading(true);
    try {
      const baseUrl = workspaceId ? `/api/symbius/flows?workspaceId=${encodeURIComponent(workspaceId)}` : `/api/symbius/flows`;
      if (savedId) {
        const res = await fetch(baseUrl, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: savedId,
            nome: nome.trim(),
            status: "PUBLISHED",
            triggerType: "comment_keyword",
            triggerConfig,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Erro ao salvar");
        setLiveId(savedId);
        setStep("live");
        void loadInsights(savedId);
      } else {
        const res = await fetch(baseUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nome: nome.trim(),
            template: "comment_dm",
            messageText: welcomeText.trim(),
            status: "PUBLISHED",
            triggerConfig,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Erro ao criar");
        setSavedId(data.fluxo.id);
        setLiveId(data.fluxo.id);
        setStep("live");
        void loadInsights(data.fluxo.id);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  const repliesFilled = publicReplies.map((item) => item.trim()).filter(Boolean);

  const form = step === "live" ? (
    <div className="space-y-4">
      <BackLink onClick={() => (liveId ? onSaved(liveId) : onCancel())}>Automações</BackLink>
      <h1 className="type-tagline text-[var(--ink)]">Automação ativa</h1>
      <div className="grid grid-cols-2 gap-3">
        <p className="type-caption text-[var(--ink-muted-48)]">Execuções <span className="type-body-strong text-[var(--ink)]">{insights?.runs ?? 0}</span></p>
        <p className="type-caption text-[var(--ink-muted-48)]">Envios <span className="type-body-strong text-[var(--ink)]">{insights?.sends ?? 0}</span></p>
        <p className="type-caption text-[var(--ink-muted-48)]">Cliques <span className="type-body-strong text-[var(--ink)]">{insights?.clicks ?? 0}</span></p>
        <p className="type-caption text-[var(--ink-muted-48)]">CTR <span className="type-body-strong text-[var(--ink)]">{insights?.ctr ?? 0}%</span></p>
        <p className="type-caption text-[var(--ink-muted-48)]">E-mails <span className="type-body-strong text-[var(--ink)]">{insights?.emails ?? 0}</span></p>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="toolbar" onClick={() => setStep("setup")}>Editar</Button>
        <Button type="button" variant="outline" size="toolbar" onClick={() => void stopLive()}>Parar</Button>
      </div>
    </div>
  ) : step === "message" ? (
    <div className="space-y-4">
      <BackLink onClick={() => setStep("setup")}>Voltar</BackLink>
      <h1 className="type-tagline text-[var(--ink)]">Eles receberão o link</h1>
      <p className="type-caption text-[var(--ink-muted-48)]">Até três links, ou só o texto.</p>
      <textarea value={rewardText} onChange={(e) => setRewardText(e.target.value)} className={wizardTextareaCls} />
      {rewardLinks.map((link, index) => (
        <div key={index} className="space-y-2">
          <input
            value={link.label}
            onChange={(e) => setRewardLinks((prev) => prev.map((item, i) => i === index ? { ...item, label: e.target.value } : item))}
            className={wizardInputCls}
            placeholder="Texto do botão"
          />
          <input
            value={link.url}
            onChange={(e) => setRewardLinks((prev) => prev.map((item, i) => i === index ? { ...item, url: e.target.value } : item))}
            className={wizardInputCls}
            placeholder="https://"
          />
        </div>
      ))}
      {rewardLinks.length < 3 ? (
        <button type="button" className="type-caption text-[var(--primary)]" onClick={() => setRewardLinks((prev) => [...prev, { label: "Acessar", url: "" }])}>
          Adicionar link
        </button>
      ) : null}
      <label className="flex items-center justify-between gap-3">
        <span className="type-caption text-[var(--ink)]">Lembrete se o link não for clicado</span>
        <Switch checked={reminderEnabled} onChange={setReminderEnabled} aria-label="Enviar lembrete" />
      </label>
      {reminderEnabled ? (
        <>
          <textarea value={reminderText} onChange={(e) => setReminderText(e.target.value)} className={wizardTextareaCls} />
          <div className="flex items-center gap-2">
            <span className="type-fine-print text-[var(--ink-muted-48)]">Enviar após</span>
            <input type="number" min={5} max={1440} value={reminderMinutes} onChange={(e) => setReminderMinutes(Number(e.target.value) || 30)} className={`${wizardInputCls} w-20`} />
            <span className="type-fine-print text-[var(--ink-muted-48)]">minutos</span>
          </div>
        </>
      ) : null}
      <Button type="button" size="toolbar" onClick={() => setStep("setup")}>Voltar ao gatilho</Button>
    </div>
  ) : (
    <div className="space-y-5">
      <BackLink onClick={onCancel}>Automações</BackLink>
      <h1 className="type-tagline text-[var(--ink)]">Quando alguém faz um comentário</h1>
      <div className="space-y-2">
        <RadioOption selected={mediaFilter === "specific"} title="Uma publicação ou Reel" onClick={() => setMediaFilter("specific")}>
          {mediaFilter === "specific" ? (
            <IgMediaPicker media={media} selectedId={mediaId} onSelect={setMediaId} loading={loadingMedia} warning={mediaWarning} onRetry={reloadMedia} fallbackIdInput onFallbackIdChange={setMediaId} />
          ) : null}
        </RadioOption>
        <RadioOption selected={mediaFilter === "any"} title="Qualquer publicação ou Reel" onClick={() => { setMediaFilter("any"); setMediaId(null); }} />
        <RadioOption selected={mediaFilter === "next"} title="Próxima publicação ou Reel" onClick={() => { setMediaFilter("next"); setMediaId(null); }} />
      </div>
      <div className="space-y-2">
        <p className="type-body-strong text-[var(--ink)]">E esse comentário possui</p>
        <RadioOption selected={!anyKeyword} title="Uma palavra ou expressão específica" onClick={() => setAnyKeyword(false)}>
          {!anyKeyword ? (
            <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
              <input value={keywordInput} onChange={(e) => { setKeywordInput(e.target.value); setKeywords(parseKeywords(e.target.value)); }} className={wizardInputCls} placeholder="Eu quero" />
              <p className="type-fine-print text-[var(--ink-muted-48)]">Use vírgulas para separar as palavras</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="type-fine-print text-[var(--ink-muted-48)]">Por exemplo:</span>
                {SUGGESTED.slice(0, 3).map((word) => (
                  <TagChip key={word} onClick={() => addSuggested(word)}>{word}</TagChip>
                ))}
              </div>
            </div>
          ) : null}
        </RadioOption>
        <RadioOption selected={anyKeyword} title="Qualquer palavra" onClick={() => setAnyKeyword(true)} />
        <label className="flex items-center justify-between gap-3 pt-1">
          <span className="type-caption text-[var(--ink)]">Interagir com os comentários deles na publicação</span>
          <Switch checked={replyToComment || repliesFilled.length > 0} onChange={(on) => { setReplyToComment(on); if (!on) setPublicReplies(["", "", ""]); }} aria-label="Interagir com os comentários deles na publicação" />
        </label>
        {replyToComment || repliesFilled.length > 0 ? (
          <div className="space-y-2">
            {publicReplies.map((value, index) => (
              <input key={index} value={value} onChange={(e) => setPublicReplies((prev) => prev.map((item, i) => i === index ? e.target.value : item))} className={wizardInputCls} placeholder={`Resposta pública ${index + 1}`} />
            ))}
          </div>
        ) : null}
      </div>
      <div className="space-y-3">
        <p className="type-body-strong text-[var(--ink)]">Eles receberão</p>
        <label className="flex items-center justify-between gap-3">
          <span className="type-caption text-[var(--ink)]">Uma mensagem de boas-vindas</span>
          <Switch checked={welcomeEnabled} onChange={setWelcomeEnabled} aria-label="Uma mensagem de boas-vindas" />
        </label>
        {welcomeEnabled ? (
          <div className="space-y-2">
            <textarea value={welcomeText} onChange={(e) => setWelcomeText(e.target.value.slice(0, 1000))} className={wizardTextareaCls} />
            <p className="text-right type-micro-legal text-[var(--ink-muted-48)]">{welcomeText.length}</p>
            <input value={welcomeButton} onChange={(e) => setWelcomeButton(e.target.value)} className={wizardInputCls} placeholder="Me envie o link" />
            <button type="button" className="type-fine-print text-[var(--primary)]" onClick={() => setWhyWelcome((v) => !v)}>
              Qual a importância de uma mensagem de boas-vindas?
            </button>
            {whyWelcome ? (
              <p className="type-fine-print text-[var(--ink-muted-48)]">
                O botão abre a conversa. Sem essa mensagem, só saem a resposta pública e a DM do link.
              </p>
            ) : null}
          </div>
        ) : null}
        <label className="flex items-center justify-between gap-3">
          <span className="type-caption text-[var(--ink)]">Uma DM pedindo que sigam o perfil antes do link</span>
          <Switch checked={followEnabled} onChange={setFollowEnabled} aria-label="Pedir para seguir" />
        </label>
        {followEnabled ? (
          <textarea value={followText} onChange={(e) => setFollowText(e.target.value)} className={wizardTextareaCls} />
        ) : null}
        <label className="flex items-center justify-between gap-3">
          <span className="type-caption text-[var(--ink)]">Uma DM solicitando o endereço de e-mail</span>
          <Switch checked={emailEnabled} onChange={setEmailEnabled} aria-label="Pedir e-mail" />
        </label>
        {emailEnabled ? (
          <textarea value={emailText} onChange={(e) => setEmailText(e.target.value)} className={wizardTextareaCls} />
        ) : null}
      </div>
      <Button type="button" variant="outline" size="toolbar" onClick={() => setStep("message")}>Próximo</Button>
    </div>
  );

  return (
    <WizardLayout
      previewHeader={
        <>
          <span className="type-caption text-[var(--ink-muted-48)]">Visualização</span>
          <Button type="button" size="toolbar" disabled={loading || step === "live"} onClick={() => void activate()}>
            {loading ? "Ativando…" : "Ativar"}
          </Button>
        </>
      }
      form={form}
      preview={
        <IgCommentPreview
          scene={scene}
          onScene={setScene}
          username={username}
          mediaUrl={thumb}
          caption={selected?.caption?.slice(0, 140)}
          commentText={commentPreview}
          welcomeText={welcomeText}
          welcomeButton={welcomeButton}
          showWelcome={welcomeEnabled}
        />
      }
    />
  );
}
