"use client";

import { useEffect, useMemo, useState } from "react";
import { PhonePreview } from "./PhonePreview";
import { IgMediaPicker, type IgMediaItem } from "./IgMediaPicker";
import {
  ActivateButton,
  RadioOption,
  TagChip,
  ToggleRow,
  WizardBackButton,
  WizardFieldLabel,
  WizardLayout,
  WizardLinkButtonEditor,
  WizardSectionTitle,
  WizardTitle,
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
};

export function CommentDmWizard({
  defaultName = "Comentário → DM",
  initial,
  onCancel,
  onSaved,
  username = "seu_perfil",
}: CommentDmWizardProps) {
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
  const [previewTab, setPreviewTab] = useState<"post" | "comment" | "dm">(
    "comment",
  );
  const [loading, setLoading] = useState(false);
  const [loadingMedia, setLoadingMedia] = useState(true);

  function reloadMedia() {
    setLoadingMedia(true);
    setMediaWarning(null);
    fetch("/api/symbius/instagram/media")
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
    setPreviewTab("comment");
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
      if (editingId) {
        const res = await fetch("/api/symbius/flows", {
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
        const res = await fetch("/api/symbius/flows", {
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

  return (
    <WizardLayout
      form={
        <>
          <WizardBackButton onClick={onCancel} />

          <WizardTitle>Quando alguém faz um comentário</WizardTitle>

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
              selected={mediaFilter === "specific"}
              title="Uma publicação ou Reel específico"
              onClick={() => {
                setMediaFilter("specific");
                setPreviewTab("comment");
              }}
            >
              {mediaFilter === "specific" ? (
                <IgMediaPicker
                  media={media}
                  selectedId={mediaId}
                  onSelect={(id) => {
                    setMediaId(id);
                    setPreviewTab("comment");
                  }}
                  loading={loadingMedia}
                  warning={mediaWarning}
                  onRetry={reloadMedia}
                  fallbackIdInput
                  onFallbackIdChange={(id) => {
                    setMediaId(id);
                    setPreviewTab("comment");
                  }}
                />
              ) : null}
            </RadioOption>

            <RadioOption
              selected={mediaFilter === "any"}
              title="Qualquer publicação ou Reel"
              onClick={() => {
                setMediaFilter("any");
                setMediaId(null);
                setPreviewTab("post");
              }}
            />

            <RadioOption
              selected={mediaFilter === "next"}
              title="Próxima publicação ou Reel"
              onClick={() => {
                setMediaFilter("next");
                setMediaId(null);
                setPreviewTab("post");
              }}
            >
              {mediaFilter === "next" ? (
                <p className="text-[11px] leading-snug text-zinc-500">
                  A automação passa a valer para a próxima publicação ou Reel
                  que você fizer depois de ativar.
                </p>
              ) : null}
            </RadioOption>
          </section>

          <section className="mt-7">
            <WizardSectionTitle>E esse comentário possui</WizardSectionTitle>
            <div className="mt-2.5 space-y-2">
              <RadioOption
                selected={!anyKeyword}
                title="Uma palavra ou expressão específica"
                onClick={() => {
                  setAnyKeyword(false);
                  setPreviewTab("comment");
                }}
              >
                {!anyKeyword ? (
                  <div
                    className="mt-2 space-y-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      value={keywordInput}
                      onChange={(e) => {
                        setKeywordInput(e.target.value);
                        setKeywords(parseKeywords(e.target.value));
                        setPreviewTab("comment");
                      }}
                      className={wizardInputCls}
                      placeholder="Eu quero"
                    />
                    <p className="text-[11px] text-zinc-500">
                      Use vírgulas para separar as palavras
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {SUGGESTED.map((s) => (
                        <TagChip key={s} onClick={() => addSuggested(s)}>
                          {s}
                        </TagChip>
                      ))}
                    </div>
                  </div>
                ) : null}
              </RadioOption>

              <RadioOption
                selected={anyKeyword}
                title="Qualquer palavra"
                onClick={() => {
                  setAnyKeyword(true);
                  setPreviewTab("comment");
                }}
              />
            </div>

            <div className="mt-2.5">
              <ToggleRow
                label="Interagir com os comentários na publicação"
                checked={replyToComment}
                onChange={setReplyToComment}
              />
            </div>
          </section>

          <section className="mt-7">
            <WizardSectionTitle>Eles receberão</WizardSectionTitle>
            <div className="mt-2.5 space-y-2">
              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
                <div className="px-3.5 py-3">
                  <ToggleRow
                    bare
                    label="Uma mensagem de boas-vindas"
                    checked={welcomeEnabled}
                    onChange={setWelcomeEnabled}
                  />
                </div>
                {welcomeEnabled && (
                  <div className="space-y-2 border-t border-zinc-100 px-3.5 pb-3.5 pt-2.5">
                    <textarea
                      value={welcomeText}
                      onChange={(e) => {
                        setWelcomeText(e.target.value);
                        setPreviewTab("dm");
                      }}
                      className={wizardTextareaCls}
                    />
                    <input
                      value={welcomeButton}
                      onChange={(e) => {
                        setWelcomeButton(e.target.value);
                        setPreviewTab("dm");
                      }}
                      className={wizardInputCls}
                      placeholder="Texto do botão"
                    />
                  </div>
                )}
              </div>

              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
                <div className="px-3.5 py-3">
                  <ToggleRow
                    bare
                    label="Uma DM solicitando que sigam seu perfil antes de receber o link"
                    checked={followEnabled}
                    onChange={(v) => {
                      setFollowEnabled(v);
                      setPreviewTab("dm");
                    }}
                  />
                </div>
                {followEnabled && (
                  <div className="space-y-2 border-t border-zinc-100 px-3.5 pb-3.5 pt-2.5">
                    <textarea
                      value={followText}
                      onChange={(e) => {
                        setFollowText(e.target.value);
                        setPreviewTab("dm");
                      }}
                      className={wizardTextareaCls}
                    />
                    <input
                      value={followButton}
                      onChange={(e) => {
                        setFollowButton(e.target.value);
                        setPreviewTab("dm");
                      }}
                      className={wizardInputCls}
                      placeholder="Texto do botão"
                    />
                  </div>
                )}
              </div>

              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
                <div className="px-3.5 py-3">
                  <ToggleRow
                    bare
                    label="Uma DM solicitando o endereço de e-mail"
                    checked={emailEnabled}
                    onChange={(v) => {
                      setEmailEnabled(v);
                      setPreviewTab("dm");
                    }}
                  />
                </div>
                {emailEnabled && (
                  <div className="border-t border-zinc-100 px-3.5 pb-3.5 pt-2.5">
                    <textarea
                      value={emailText}
                      onChange={(e) => {
                        setEmailText(e.target.value);
                        setPreviewTab("dm");
                      }}
                      className={wizardTextareaCls}
                    />
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="mt-7 pb-4">
            <WizardSectionTitle>E então, eles vão receber</WizardSectionTitle>
            <div className="mt-2.5 space-y-2">
              <div className="rounded-xl border border-zinc-200 bg-white p-3.5">
                <p className="mb-2.5 text-[13px] font-medium text-zinc-800">
                  Uma DM contendo um link
                </p>
                <div className="space-y-2">
                  <textarea
                    value={rewardText}
                    onChange={(e) => {
                      setRewardText(e.target.value);
                      setPreviewTab("dm");
                    }}
                    className={`${wizardTextareaCls} min-h-[72px]`}
                  />
                  <WizardLinkButtonEditor
                    buttonLabel={rewardButton}
                    url={rewardUrl}
                    onChange={(button, url) => {
                      setRewardButton(button);
                      setRewardUrl(url);
                      setPreviewTab("dm");
                    }}
                  />
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
                <div className="px-3.5 py-3">
                  <ToggleRow
                    bare
                    label="Uma DM de lembrete, caso o link não tenha sido acessado"
                    checked={reminderEnabled}
                    onChange={(v) => {
                      setReminderEnabled(v);
                      setPreviewTab("dm");
                    }}
                  />
                </div>
                {reminderEnabled && (
                  <div className="space-y-2 border-t border-zinc-100 px-3.5 pb-3.5 pt-2.5">
                    <textarea
                      value={reminderText}
                      onChange={(e) => {
                        setReminderText(e.target.value);
                        setPreviewTab("dm");
                      }}
                      className={wizardTextareaCls}
                    />
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 text-[11px] text-zinc-500">
                        Enviar após
                      </span>
                      <input
                        type="number"
                        min={5}
                        max={1440}
                        value={reminderMinutes}
                        onChange={(e) =>
                          setReminderMinutes(Number(e.target.value) || 60)
                        }
                        className={`${wizardInputCls} w-20`}
                      />
                      <span className="text-[11px] text-zinc-500">minutos</span>
                    </div>
                  </div>
                )}
              </div>
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
          tab={previewTab}
          onTabChange={setPreviewTab}
          mediaUrl={thumb}
          caption={selected?.caption?.slice(0, 90) || "Sua publicação"}
          commentText={commentPreview}
          username={username}
          welcomeText={welcomeEnabled ? welcomeText : ""}
          welcomeButton={welcomeEnabled ? welcomeButton : ""}
          followText={followEnabled ? followText : ""}
          followButton={followEnabled ? followButton : ""}
          showFollowConfirmed={followEnabled}
          followerHandle="seguidor"
          emailText={emailEnabled ? emailText : ""}
          rewardText={rewardText}
          rewardButton={rewardButton}
          reminderText={reminderEnabled ? reminderText : ""}
          reminderMinutes={reminderEnabled ? reminderMinutes : undefined}
          showReward
        />
      }
    />
  );
}
