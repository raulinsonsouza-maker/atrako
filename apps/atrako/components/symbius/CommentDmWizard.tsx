"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, Hash, Image as ImageIcon, Link2, Mail, MessageCircle, UserPlus } from "lucide-react";
import { Button, Switch } from "@/components/ui";
import { BackLink } from "@/components/ui/back-link";
import { ScriptBlock } from "@/components/atendimento/mensagens/ScriptBlock";
import { PhonePreview, type IgPreviewSection } from "./PhonePreview";
import { IgMediaPicker, type IgMediaItem } from "./IgMediaPicker";
import {
  RadioOption,
  TagChip,
  WizardFieldLabel,
  WizardLinkButtonEditor,
  useWorkspaceSaleLinks,
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
  const saleLinks = useWorkspaceSaleLinks(workspaceId);
  const editingId = initial?.fluxoId;
  const [nome, setNome] = useState(initial?.nome ?? defaultName);
  const [mediaFilter, setMediaFilter] = useState<"any" | "specific" | "next">(
    initial?.mediaFilter ?? "specific",
  );
  const [mediaId, setMediaId] = useState<string | null>(
    initial?.mediaId ?? null,
  );
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [mediaWarning, setMediaWarning] = useState<string | null>(null);
  const [anyKeyword, setAnyKeyword] = useState(initial?.anyKeyword ?? false);
  const [keywords, setKeywords] = useState<string[]>(
    initial?.keywords?.length ? initial.keywords : ["eu quero"],
  );
  const [keywordInput, setKeywordInput] = useState(
    (initial?.keywords ?? ["eu quero"]).join(", "),
  );
  const [replyToComment, setReplyToComment] = useState(
    initial?.replyToComment ?? false,
  );
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
  const [followButton, setFollowButton] = useState(
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
  const [rewardButton, setRewardButton] = useState(
    initial?.rewardButton ?? "Acessar",
  );
  const [rewardUrl, setRewardUrl] = useState(initial?.rewardUrl ?? "");
  const [reminderEnabled, setReminderEnabled] = useState(
    initial?.reminderEnabled ?? false,
  );
  const [reminderText, setReminderText] = useState(
    initial?.reminderText ?? DEFAULT_REMINDER,
  );
  const [reminderMinutes, setReminderMinutes] = useState(
    initial?.reminderMinutes ?? 30,
  );
  const [open, setOpen] = useState<IgPreviewSection | null>("welcome");
  function select(section: IgPreviewSection) {
    setOpen((current) => (current === section ? null : section));
  }
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
        if (d.warning) setMediaWarning(d.warning);
        if (!mediaId && items[0] && mediaFilter === "specific") {
          setMediaId(items[0].id);
        }
      })
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

  function addSuggested(s: string) {
    const next = parseKeywords(`${keywordInput}, ${s}`);
    setKeywordInput(next.join(", "));
    setKeywords(next);
    setAnyKeyword(false);
    setOpen("keyword");
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
    if (!rewardText.trim()) {
      alert("Escreva a DM com o link / acesso");
      return;
    }
    if (reminderEnabled && !rewardUrl.trim()) {
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
      replyToComment,
      welcomeEnabled,
      welcomeText: welcomeText.trim(),
      welcomeButton: welcomeButton.trim() || "Me envie o link",
      followEnabled,
      followText: followText.trim(),
      followButton: followButton.trim() || "Já sigo",
      emailEnabled,
      emailText: emailText.trim(),
      rewardText: rewardText.trim(),
      rewardButton: rewardButton.trim() || "Acessar",
      rewardUrl: rewardUrl.trim(),
      reminderEnabled,
      reminderText: reminderText.trim(),
      reminderMinutes,
    };

    setLoading(true);
    try {
      const baseUrl = workspaceId ? `/api/symbius/flows?workspaceId=${encodeURIComponent(workspaceId)}` : `/api/symbius/flows`;
      if (editingId) {
        const res = await fetch(baseUrl, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingId,
            nome: nome.trim(),
            status: "PUBLISHED",
            triggerType: "comment_keyword",
            triggerConfig,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Erro ao salvar");
        onSaved(editingId);
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
        onSaved(data.fluxo.id);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  const postSummary =
    mediaFilter === "specific"
      ? "Uma publicação"
      : mediaFilter === "next"
        ? "A próxima publicação"
        : "Qualquer publicação";
  const keywordSummary = anyKeyword ? "Qualquer palavra" : commentPreview;

  return (
    <div className="script-grid px-4 py-5 md:px-6">
      <div className="script-list">
        <div className="mb-2 flex items-center justify-between gap-3">
          <BackLink onClick={onCancel}>Automações</BackLink>
          <Button type="button" size="toolbar" disabled={loading} onClick={() => void activate()}>
            {loading ? "Ativando…" : "Ativar"}
          </Button>
        </div>
        <h1 className="type-tagline text-[var(--ink)]">Quando alguém comenta</h1>
        <p className="type-caption text-[var(--ink-muted-48)]">
          Toque num bloco ou num balão do celular para editar aquele passo.
        </p>

        <div className="mt-2">
          <WizardFieldLabel>Nome interno</WizardFieldLabel>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className={wizardInputCls} />
        </div>

        <ScriptBlock
          icon={ImageIcon}
          title="Publicação"
          summary={postSummary}
          open={open === "post"}
          onToggle={() => select("post")}
        >
          <div className="space-y-2">
            <RadioOption
              selected={mediaFilter === "specific"}
              title="Uma publicação ou Reel"
              onClick={() => setMediaFilter("specific")}
            >
              {mediaFilter === "specific" ? (
                <IgMediaPicker
                  media={media}
                  selectedId={mediaId}
                  onSelect={setMediaId}
                  loading={loadingMedia}
                  warning={mediaWarning}
                  onRetry={reloadMedia}
                  fallbackIdInput
                  onFallbackIdChange={setMediaId}
                />
              ) : null}
            </RadioOption>
            <RadioOption
              selected={mediaFilter === "any"}
              title="Qualquer publicação ou Reel"
              onClick={() => {
                setMediaFilter("any");
                setMediaId(null);
              }}
            />
            <RadioOption
              selected={mediaFilter === "next"}
              title="A próxima publicação ou Reel"
              onClick={() => {
                setMediaFilter("next");
                setMediaId(null);
              }}
            >
              {mediaFilter === "next" ? (
                <p className="type-fine-print leading-snug text-[var(--ink-muted-48)]">
                  Vale para a próxima publicação feita depois de ativar.
                </p>
              ) : null}
            </RadioOption>
          </div>
        </ScriptBlock>

        <ScriptBlock
          icon={Hash}
          title="Palavra do comentário"
          summary={keywordSummary}
          chips={anyKeyword ? undefined : keywords}
          open={open === "keyword"}
          onToggle={() => select("keyword")}
        >
          <div className="space-y-2">
            <RadioOption selected={!anyKeyword} title="Uma palavra ou expressão" onClick={() => setAnyKeyword(false)}>
              {!anyKeyword ? (
                <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    value={keywordInput}
                    onChange={(e) => {
                      setKeywordInput(e.target.value);
                      setKeywords(parseKeywords(e.target.value));
                    }}
                    className={wizardInputCls}
                    placeholder="Eu quero"
                  />
                  <p className="type-fine-print text-[var(--ink-muted-48)]">Separe as palavras com vírgula.</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTED.map((word) => (
                      <TagChip key={word} onClick={() => addSuggested(word)}>
                        {word}
                      </TagChip>
                    ))}
                  </div>
                </div>
              ) : null}
            </RadioOption>
            <RadioOption selected={anyKeyword} title="Qualquer palavra" onClick={() => setAnyKeyword(true)} />
            <label className="flex items-center justify-between gap-3 pt-1">
              <span className="type-caption text-[var(--ink)]">Responder o comentário em público</span>
              <Switch checked={replyToComment} onChange={setReplyToComment} aria-label="Responder o comentário em público" />
            </label>
          </div>
        </ScriptBlock>

        <ScriptBlock
          icon={MessageCircle}
          title="Boas-vindas"
          summary={welcomeEnabled ? welcomeText.split("\n")[0] : "Desligada"}
          chips={welcomeEnabled && welcomeButton ? [welcomeButton] : undefined}
          off={!welcomeEnabled}
          open={open === "welcome"}
          onToggle={() => select("welcome")}
          aside={
            <Switch
              checked={welcomeEnabled}
              onChange={setWelcomeEnabled}
              aria-label="Enviar boas-vindas"
            />
          }
        >
          <textarea value={welcomeText} onChange={(e) => setWelcomeText(e.target.value)} className={wizardTextareaCls} />
          <input
            value={welcomeButton}
            onChange={(e) => setWelcomeButton(e.target.value)}
            className={wizardInputCls}
            placeholder="Texto do botão"
          />
        </ScriptBlock>

        <ScriptBlock
          icon={UserPlus}
          title="Pedir para seguir"
          summary={followEnabled ? followText.split("\n")[0] : "Desligado"}
          off={!followEnabled}
          open={open === "follow"}
          onToggle={() => select("follow")}
          aside={<Switch checked={followEnabled} onChange={setFollowEnabled} aria-label="Pedir para seguir" />}
        >
          <textarea value={followText} onChange={(e) => setFollowText(e.target.value)} className={wizardTextareaCls} />
          <input
            value={followButton}
            onChange={(e) => setFollowButton(e.target.value)}
            className={wizardInputCls}
            placeholder="Texto do botão"
          />
        </ScriptBlock>

        <ScriptBlock
          icon={Mail}
          title="Pedir e-mail"
          summary={emailEnabled ? emailText.split("\n")[0] : "Desligado"}
          off={!emailEnabled}
          open={open === "email"}
          onToggle={() => select("email")}
          aside={<Switch checked={emailEnabled} onChange={setEmailEnabled} aria-label="Pedir e-mail" />}
        >
          <textarea value={emailText} onChange={(e) => setEmailText(e.target.value)} className={wizardTextareaCls} />
        </ScriptBlock>

        <ScriptBlock
          icon={Link2}
          title="Link"
          summary={rewardText.split("\n")[0]}
          chips={rewardButton ? [rewardButton] : undefined}
          open={open === "reward"}
          onToggle={() => select("reward")}
        >
          <textarea
            value={rewardText}
            onChange={(e) => setRewardText(e.target.value)}
            className={`${wizardTextareaCls} min-h-[72px]`}
          />
          <WizardLinkButtonEditor
            buttonLabel={rewardButton}
            url={rewardUrl}
            saleLinks={saleLinks}
            onChange={(button, url) => {
              setRewardButton(button);
              setRewardUrl(url);
            }}
          />
        </ScriptBlock>

        <ScriptBlock
          icon={Clock}
          title="Lembrete"
          summary={reminderEnabled ? `${reminderMinutes} min depois` : "Desligado"}
          off={!reminderEnabled}
          open={open === "reminder"}
          onToggle={() => select("reminder")}
          aside={<Switch checked={reminderEnabled} onChange={setReminderEnabled} aria-label="Enviar lembrete" />}
        >
          <textarea value={reminderText} onChange={(e) => setReminderText(e.target.value)} className={wizardTextareaCls} />
          <div className="flex items-center gap-2">
            <span className="type-fine-print text-[var(--ink-muted-48)]">Enviar após</span>
            <input
              type="number"
              min={5}
              max={1440}
              value={reminderMinutes}
              onChange={(e) => setReminderMinutes(Number(e.target.value) || 60)}
              className={`${wizardInputCls} w-20`}
            />
            <span className="type-fine-print text-[var(--ink-muted-48)]">minutos</span>
          </div>
        </ScriptBlock>
      </div>

      <PhonePreview
        section={open}
        onSection={setOpen}
        mediaUrl={thumb}
        caption={selected?.caption?.slice(0, 90) || "Sua publicação"}
        commentText={commentPreview}
        username={username}
        welcomeText={welcomeEnabled ? welcomeText : ""}
        welcomeButton={welcomeEnabled ? welcomeButton : ""}
        followText={followEnabled ? followText : ""}
        followButton={followEnabled ? followButton : ""}
        emailText={emailEnabled ? emailText : ""}
        rewardText={rewardText}
        rewardButton={rewardButton}
        reminderText={reminderEnabled ? reminderText : ""}
        reminderMinutes={reminderEnabled ? reminderMinutes : undefined}
        showReward
      />
    </div>
  );
}
