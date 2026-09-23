"use client";

import {
  Suspense,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type MouseEvent,
} from "react";
import type { Config } from "@puckeditor/core";
import { registerOverlayPortal } from "@puckeditor/core";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { CheckoutForm } from "@/components/commerce/CheckoutForm";
import { LpLeadForm } from "@/components/commerce/LpLeadForm";
import type { LpGoal } from "@/lib/criar/lp-schema";
import { useLpPuckCtx } from "@/lib/criar/puck/context";
import { LpPageRoot } from "@/components/criar/LpStyleGuidePlugin";
import {
  colorField,
  contrastInk,
  isDarkHex,
  resolveBg,
} from "@/lib/criar/puck/color-field";
import { imageField } from "@/lib/criar/puck/image-field";
import { checkoutProductField } from "@/lib/criar/puck/checkout-product-field";
import { formSelectField } from "@/lib/criar/puck/form-select-field";
import { LP_ELEMENT_COMPONENTS } from "@/lib/criar/puck/palette";

/** No editor (contentEditable) vira ReactNode; no Render público permanece string. */
type EditableText = string | ReactNode;

function asPlainText(value: EditableText): string {
  return typeof value === "string" ? value : "";
}

function hasEditableText(value: EditableText): boolean {
  if (value == null || value === false) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

/** Texto curto no painel (sem contentEditable — evita roubar foco ao digitar). */
const edText = (label: string) =>
  ({ type: "text" as const, label });
/** Texto longo: editável no canvas e no painel. */
const edArea = (label: string) =>
  ({ type: "textarea" as const, label, contentEditable: true });
/** Título curto editável no canvas. */
const edInline = (label: string) =>
  ({ type: "text" as const, label, contentEditable: true });

function PreviewSafeLink({
  href,
  className,
  children,
  style,
}: {
  href?: string;
  className?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const ctx = useLpPuckCtx();
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (ctx.preview) e.preventDefault();
  };
  return (
    <a
      href={href || "#"}
      className={className}
      style={style}
      onClick={onClick}
    >
      {children}
    </a>
  );
}

function MediaPlaceholder({ children }: { children: ReactNode }) {
  return (
    <div className="lp-media-placeholder">
      <span className="type-fine-print text-[var(--ink-muted-48)]">
        {children}
      </span>
    </div>
  );
}

function SafeImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [src]);

  if (!src.trim() || broken) {
    return (
      <MediaPlaceholder>
        {broken
          ? "URL inválida — cole outro link de imagem"
          : "Cole a URL da imagem no painel →"}
      </MediaPlaceholder>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src.trim()}
      alt={alt}
      className={className}
      onError={() => setBroken(true)}
    />
  );
}

export type LpPuckComponents = {
  Hero: {
    layout: "centered" | "split" | "split-form";
    /** @deprecated use bgColor */
    surface?: "parchment" | "canvas" | "brand" | "ink";
    bgColor: string;
    textColor: string;
    ctaBg: string;
    ctaText: string;
    eyebrow: EditableText;
    title: EditableText;
    subtitle: EditableText;
    ctaLabel: EditableText;
    ctaHref: string;
    formTitle: EditableText;
    /** CaptureForm do bloco (layout split-form). */
    formId: string;
    /** Imagem do painel (layout split) */
    mediaSrc: string;
  };
  Benefits: {
    title: EditableText;
    items: Array<{ text: EditableText }>;
    bgColor: string;
    textColor: string;
  };
  Stats: {
    items: Array<{ value: EditableText; label: EditableText }>;
    bgColor: string;
    textColor: string;
  };
  Quote: {
    text: EditableText;
    author: EditableText;
    bgColor: string;
    textColor: string;
  };
  CtaBand: {
    title: EditableText;
    subtitle: EditableText;
    ctaLabel: EditableText;
    ctaHref: string;
    /** @deprecated use bgColor */
    surface?: "brand" | "ink";
    bgColor: string;
    textColor: string;
    ctaBg: string;
    ctaText: string;
  };
  Heading: { text: EditableText; level: "h1" | "h2"; textColor: string };
  Paragraph: { text: EditableText; textColor: string };
  Image: { src: string; alt: string };
  Logo: { src: string; alt: EditableText; href: string };
  Slider: {
    items: Array<{ src: string; alt: string }>;
    bgColor: string;
  };
  Video: { url: string; title: string; bgColor: string };
  Icon: { symbol: EditableText; label: EditableText; accentColor: string };
  Box: {
    title: EditableText;
    text: EditableText;
    /** @deprecated use bgColor */
    surface?: "parchment" | "canvas";
    bgColor: string;
    textColor: string;
    accentColor: string;
  };
  Circle: { value: EditableText; label: EditableText; accentColor: string };
  Line: { label: EditableText; lineColor: string };
  Timer: {
    title: EditableText;
    hours: number;
    expiredLabel: EditableText;
    bgColor: string;
    textColor: string;
  };
  Menu: {
    items: Array<{ label: EditableText; href: string }>;
    ctaLabel: EditableText;
    ctaHref: string;
    ctaBg: string;
    ctaText: string;
  };
  Html: { code: string };
  CtaButton: {
    label: EditableText;
    href: string;
    bgColor: string;
    textColor: string;
  };
  Faq: {
    title: EditableText;
    items: Array<{ q: EditableText; a: EditableText }>;
    bgColor: string;
    textColor: string;
    accentColor: string;
  };
  AtrakoForm: {
    title: EditableText;
    bgColor: string;
    textColor: string;
    formId: string;
  };
  AtrakoCheckout: { placeholder?: string; bgColor: string; productId: string };
};

function sanitizeLpHtml(code: string) {
  return (code || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/javascript:/gi, "");
}

/** Aceita YouTube / Vimeo com ou sem https. */
function youtubeEmbed(url: string): string | null {
  let raw = (url || "").trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
      const parts = u.pathname.split("/").filter(Boolean);
      const embedIdx = parts.indexOf("embed");
      if (embedIdx >= 0 && parts[embedIdx + 1]) {
        return `https://www.youtube.com/embed/${parts[embedIdx + 1]}`;
      }
      const shortsIdx = parts.indexOf("shorts");
      if (shortsIdx >= 0 && parts[shortsIdx + 1]) {
        return `https://www.youtube.com/embed/${parts[shortsIdx + 1]}`;
      }
      const liveIdx = parts.indexOf("live");
      if (liveIdx >= 0 && parts[liveIdx + 1]) {
        return `https://www.youtube.com/embed/${parts[liveIdx + 1]}`;
      }
    }
    if (host === "vimeo.com" || host.endsWith(".vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      return id && /^\d+$/.test(id)
        ? `https://player.vimeo.com/video/${id}`
        : null;
    }
  } catch {
    return null;
  }
  return null;
}

function useInteractivePortal(enabled = true) {
  const cleanupRef = useRef<(() => void) | void>(undefined);
  return (el: HTMLElement | null) => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = undefined;
    }
    if (el && enabled) {
      cleanupRef.current = registerOverlayPortal(el);
    }
  };
}

function TimerBlock({
  title,
  hours,
  expiredLabel,
  bgColor,
  textColor,
}: LpPuckComponents["Timer"]) {
  const durationMs = Math.max(1, Number(hours) || 72) * 3600000;
  const [deadline, setDeadline] = useState(() => Date.now() + durationMs);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setDeadline(Date.now() + durationMs);
  }, [durationMs]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const left = Math.max(0, deadline - now);
  const totalSec = Math.floor(left / 1000);
  const days = Math.floor(totalSec / 86400);
  const hrs = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const expired = left <= 0;
  const bg = resolveBg(bgColor, undefined, "#ffffff");
  const text = textColor || contrastInk(bg);

  return (
    <section
      className="lp-block lp-timer"
      data-tone={isDarkHex(bg) ? "dark" : "light"}
      style={{ background: bg, color: text }}
    >
      <h2 className="lp-section-title">{title}</h2>
      {expired ? (
        <p className="lp-timer-expired type-body" style={{ opacity: 0.8 }}>
          {hasEditableText(expiredLabel) ? expiredLabel : "Oferta encerrada"}
        </p>
      ) : (
        <ul className="lp-timer-grid" aria-label="Contagem regressiva">
          {[
            { v: days, l: "dias" },
            { v: hrs, l: "horas" },
            { v: mins, l: "min" },
            { v: secs, l: "seg" },
          ].map((u) => (
            <li key={u.l} className="lp-timer-unit">
              <span className="lp-timer-value">
                {String(u.v).padStart(2, "0")}
              </span>
              <span className="lp-timer-label type-fine-print">{u.l}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SliderBlock({ items, bgColor }: LpPuckComponents["Slider"]) {
  const ctx = useLpPuckCtx();
  const slides = (items || []).filter((i) => i?.src?.trim());
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const chromeRef = useInteractivePortal(ctx.preview);
  const bg = resolveBg(bgColor, undefined, "#f5f5f7");

  useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [slides.length, index]);

  useEffect(() => {
    if (ctx.preview || slides.length <= 1) return;
    const id = window.setInterval(() => {
      setDir(1);
      setIndex((i) => (i + 1) % slides.length);
    }, 5600);
    return () => window.clearInterval(id);
  }, [slides.length, ctx.preview, index]);

  const current = slides[index] || slides[0];
  const caption = current?.alt?.trim() || "";
  const go = (next: -1 | 1) => {
    if (slides.length <= 1) return;
    setDir(next);
    setIndex((i) => (i + next + slides.length) % slides.length);
  };
  const jump = (i: number) => {
    if (i === index) return;
    setDir(i > index ? 1 : -1);
    setIndex(i);
  };

  return (
    <section
      className="lp-block lp-slider"
      data-tone={isDarkHex(bg) ? "dark" : "light"}
      style={{ background: bg }}
    >
      {current ? (
        <div className="lp-slider-stage">
          <div className="lp-slider-viewport">
            <div
              className="lp-slider-frame"
              key={current.src + index}
              data-dir={dir > 0 ? "next" : "prev"}
            >
              <SafeImage
                src={current.src}
                alt={caption || `Slide ${index + 1}`}
                className="lp-slider-img shadow-product"
              />
              <div className="lp-slider-veil" aria-hidden />
            </div>

            {slides.length > 1 ? (
              <div className="lp-slider-chrome" ref={chromeRef}>
                <button
                  type="button"
                  className="lp-slider-nav-btn lp-slider-nav-btn--prev"
                  aria-label="Anterior"
                  onClick={() => go(-1)}
                >
                  <ChevronLeft strokeWidth={1.75} aria-hidden />
                </button>
                <button
                  type="button"
                  className="lp-slider-nav-btn lp-slider-nav-btn--next"
                  aria-label="Próximo"
                  onClick={() => go(1)}
                >
                  <ChevronRight strokeWidth={1.75} aria-hidden />
                </button>

                <div className="lp-slider-footer">
                  <div
                    className="lp-slider-progress"
                    role="tablist"
                    aria-label="Slides"
                  >
                    {slides.map((_, i) => (
                      <button
                        key={`${i}-${i === index ? index : "idle"}`}
                        type="button"
                        className="lp-slider-progress-seg"
                        data-active={i === index ? "true" : undefined}
                        data-preview={ctx.preview ? "true" : undefined}
                        aria-label={`Slide ${i + 1}`}
                        aria-selected={i === index}
                        onClick={() => jump(i)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {caption ? (
            <p className="lp-slider-caption type-fine-print">{caption}</p>
          ) : null}
        </div>
      ) : (
        <MediaPlaceholder>
          Envie imagens nos slides (painel →)
        </MediaPlaceholder>
      )}
    </section>
  );
}

function FaqBlock({
  title,
  items,
  bgColor,
  textColor,
  accentColor,
}: LpPuckComponents["Faq"]) {
  const ctx = useLpPuckCtx();
  const list = items || [];
  const [open, setOpen] = useState(0);
  const listRef = useInteractivePortal(ctx.preview);
  const bg = resolveBg(bgColor, undefined, "#f5f5f7");
  const text = textColor || contrastInk(bg);
  const accent = accentColor || "#0066cc";

  return (
    <section
      className="lp-block lp-faq"
      id="faq"
      data-tone={isDarkHex(bg) ? "dark" : "light"}
      style={
        {
          background: bg,
          color: text,
          "--lp-faq-accent": accent,
        } as CSSProperties
      }
    >
      <h2 className="lp-section-title">
        {hasEditableText(title) ? title : "Perguntas frequentes"}
      </h2>
      <div className="lp-faq-list" ref={listRef}>
        {list.map((item, i) => {
          const isOpen = open === i;
          return (
            <div
              key={i}
              className="lp-faq-item"
              data-open={isOpen ? "true" : undefined}
            >
              <div
                className="lp-faq-head"
                onClick={(e) => {
                  const t = e.target as HTMLElement;
                  if (
                    t.closest(
                      '[contenteditable="true"], [contenteditable="plaintext-only"]',
                    )
                  ) {
                    return;
                  }
                  setOpen(isOpen ? -1 : i);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOpen(isOpen ? -1 : i);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-expanded={isOpen}
              >
                <span className="lp-faq-index type-micro-legal" aria-hidden>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="lp-faq-q type-caption-strong">
                  {hasEditableText(item.q) ? item.q : "Pergunta"}
                </span>
                <span className="lp-faq-icon" aria-hidden>
                  <ChevronDown strokeWidth={1.75} />
                </span>
              </div>
              <div
                className="lp-faq-panel"
                data-open={isOpen ? "true" : undefined}
              >
                <div className="lp-faq-a type-body">
                  {hasEditableText(item.a) ? item.a : "Resposta"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FormPreview({
  title,
  formId,
}: {
  title: EditableText;
  formId?: string;
}) {
  const ctx = useLpPuckCtx();
  const resolved = resolveFormSlug(ctx, formId);
  if (!resolved && ctx.preview) {
    return (
      <div className="lp-convert-card lp-convert-card--float">
        <p className="lp-convert-kicker type-fine-print">Formulário</p>
        <h3 className="lp-convert-title">Escolha o formulário</h3>
        <p className="mt-2 type-fine-print text-[var(--ink-muted-48)]">
          Selecione ou crie um formulário neste bloco.
        </p>
      </div>
    );
  }
  return (
    <div className="lp-convert-card lp-convert-card--float">
      <h3 className="lp-convert-title">
        {hasEditableText(title) ? title : "Deixe seus dados"}
      </h3>
      <div className="lp-convert-fields" aria-hidden>
        <div className="lp-convert-field">
          <span className="type-micro-legal text-[var(--ink-muted-48)]">
            Nome
          </span>
          <div className="lp-convert-input" />
        </div>
        <div className="lp-convert-field">
          <span className="type-micro-legal text-[var(--ink-muted-48)]">
            E-mail
          </span>
          <div className="lp-convert-input" />
        </div>
        <div className="lp-convert-field">
          <span className="type-micro-legal text-[var(--ink-muted-48)]">
            WhatsApp
          </span>
          <div className="lp-convert-input" />
        </div>
        <div className="lp-cta lp-cta--full" role="presentation">
          Continuar
        </div>
      </div>
      <p className="mt-3 text-center type-micro-legal text-[var(--ink-muted-48)]">
        Leads no CRM ao publicar
      </p>
    </div>
  );
}

function HeroShowcase() {
  const ctx = useLpPuckCtx();
  return (
    <div className="lp-hero-showcase" aria-hidden>
      <div className="lp-hero-showcase-bar" />
      <p className="lp-hero-showcase-kicker type-fine-print">
        {ctx.brandName || "Sua marca"}
      </p>
      <p className="lp-hero-showcase-title type-caption-strong">
        {ctx.product.name || "Sua oferta"}
      </p>
      <div className="lp-hero-showcase-rows">
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}

function HeroBlock(props: LpPuckComponents["Hero"]) {
  const ctx = useLpPuckCtx();
  const brand = hasEditableText(props.eyebrow) ? props.eyebrow : ctx.brandName;
  const layout = props.layout || "centered";
  const bg = resolveBg(props.bgColor, props.surface, "#f5f5f7");
  const text = props.textColor || contrastInk(bg);
  const ctaBg = props.ctaBg || "#0066cc";
  const ctaText = props.ctaText || contrastInk(ctaBg);
  const isSplit = layout === "split" || layout === "split-form";
  const showForm = layout === "split-form";
  const showCta =
    layout !== "split-form" && hasEditableText(props.ctaLabel);
  const media = (props.mediaSrc || "").trim();

  const copy = (
    <div className="lp-hero-copy">
      {brand ? (
        <p className="lp-hero-eyebrow type-fine-print">{brand}</p>
      ) : null}
      <h1 className="lp-hero-title">{props.title}</h1>
      <p className="lp-hero-sub type-body">{props.subtitle}</p>
      {showCta ? (
        <div className="lp-hero-actions">
          <PreviewSafeLink
            href={props.ctaHref || "#form"}
            className="lp-cta"
            style={{ background: ctaBg, color: ctaText }}
          >
            {props.ctaLabel}
          </PreviewSafeLink>
        </div>
      ) : null}
    </div>
  );

  let aside: ReactNode = null;
  if (showForm) {
    const formSlug = resolveFormSlug(ctx, props.formId);
    aside = (
      <div className="lp-hero-aside" id="form">
        {ctx.preview ? (
          <FormPreview title={props.formTitle} formId={props.formId} />
        ) : (
          <div className="lp-convert-card lp-convert-card--float">
            <LpLeadForm
              title={asPlainText(props.formTitle) || "Deixe seus dados"}
              formSlug={formSlug}
              workspaceId={ctx.product.clienteId}
              productId={ctx.product.id}
              pageSlug={ctx.product.slug}
            />
          </div>
        )}
      </div>
    );
  } else if (layout === "split") {
    aside = (
      <div className="lp-hero-aside">
        {media ? (
          <div className="lp-hero-media">
            <SafeImage
              src={media}
              alt=""
              className="lp-hero-media-img shadow-product"
            />
          </div>
        ) : (
          <HeroShowcase />
        )}
      </div>
    );
  }

  return (
    <section
      className={`lp-block lp-hero lp-hero--${layout}`}
      data-tone={isDarkHex(bg) ? "dark" : "light"}
      style={{ background: bg, color: text }}
    >
      <div className={`lp-hero-inner${isSplit ? " lp-hero-inner--split" : ""}`}>
        {copy}
        {aside}
      </div>
    </section>
  );
}

function BenefitsBlock({
  title,
  items,
  bgColor,
  textColor,
}: LpPuckComponents["Benefits"]) {
  const ctx = useLpPuckCtx();
  const raw = items || [];
  const list = ctx.preview
    ? raw
    : raw.filter((i) => hasEditableText(i?.text));
  const bg = resolveBg(bgColor, undefined, "#ffffff");
  const text = textColor || contrastInk(bg);

  return (
    <section
      className="lp-block lp-benefits"
      id="beneficios"
      data-tone={isDarkHex(bg) ? "dark" : "light"}
      style={{ background: bg, color: text }}
    >
      <h2 className="lp-section-title">{title}</h2>
      {list.length === 0 ? (
        <p className="type-fine-print" style={{ opacity: 0.55 }}>
          Adicione benefícios no painel
        </p>
      ) : (
        <ul
          className="lp-benefits-grid"
          data-cols={list.length > 3 ? "2" : "1"}
        >
          {list.map((item, i) => (
            <li key={i} className="lp-benefit-card">
              <span className="lp-benefit-mark" aria-hidden>
                ✓
              </span>
              <span className="type-body">
                {hasEditableText(item.text) ? item.text : "Novo benefício"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StatsBlock({
  items,
  bgColor,
  textColor,
}: LpPuckComponents["Stats"]) {
  const ctx = useLpPuckCtx();
  const raw = items || [];
  const list = ctx.preview
    ? raw
    : raw.filter((i) => hasEditableText(i?.value));
  if (list.length === 0) return null;
  const bg = resolveBg(bgColor, undefined, "#ffffff");
  const text = textColor || contrastInk(bg);

  return (
    <section
      className="lp-block lp-stats"
      data-tone={isDarkHex(bg) ? "dark" : "light"}
      style={{ background: bg, color: text }}
    >
      <ul className="lp-stats-grid">
        {list.map((item, i) => (
          <li key={i} className="lp-stat">
            <span className="lp-stat-value">
              {hasEditableText(item.value) ? item.value : "0"}
            </span>
            <span className="lp-stat-label type-fine-print">
              {hasEditableText(item.label) ? item.label : "métrica"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function QuoteBlock({
  text,
  author,
  bgColor,
  textColor,
}: LpPuckComponents["Quote"]) {
  const ctx = useLpPuckCtx();
  if (!hasEditableText(text) && !ctx.preview) return null;
  const bg = resolveBg(bgColor, undefined, "#f5f5f7");
  const textCol = textColor || contrastInk(bg);
  return (
    <section
      className="lp-block lp-quote"
      data-tone={isDarkHex(bg) ? "dark" : "light"}
      style={{ background: bg, color: textCol }}
    >
      <blockquote className="lp-quote-card">
        <span className="lp-quote-mark" aria-hidden>
          “
        </span>
        <p className="lp-quote-text">
          {hasEditableText(text) ? text : "Sua citação aqui"}
        </p>
        <footer className="lp-quote-author type-fine-print">
          {hasEditableText(author) ? author : "Autor"}
        </footer>
      </blockquote>
    </section>
  );
}

function CtaBandBlock(props: LpPuckComponents["CtaBand"]) {
  const bg = resolveBg(props.bgColor, props.surface, "#1d1d1f");
  const text = props.textColor || contrastInk(bg);
  const ctaBg = props.ctaBg || contrastInk(bg, "#1d1d1f", "#ffffff");
  const ctaText = props.ctaText || contrastInk(ctaBg);
  return (
    <section
      className="lp-block lp-cta-band"
      data-tone={isDarkHex(bg) ? "dark" : "light"}
      style={{ background: bg, color: text }}
    >
      <div className="lp-cta-band-inner">
        <h2 className="lp-cta-band-title">{props.title}</h2>
        <p className="lp-cta-band-sub type-body">{props.subtitle}</p>
        <PreviewSafeLink
          href={props.ctaHref || "#form"}
          className="lp-cta"
          style={{ background: ctaBg, color: ctaText }}
        >
          {hasEditableText(props.ctaLabel) ? props.ctaLabel : "Quero começar"}
        </PreviewSafeLink>
      </div>
    </section>
  );
}

function CheckoutPreview({
  product: sellOverride,
}: {
  product?: ReturnType<typeof useLpPuckCtx>["checkoutProduct"];
}) {
  const ctx = useLpPuckCtx();
  const sell = sellOverride ?? null;
  if (!sell && ctx.preview) {
    return (
      <div className="lp-convert-card lp-convert-card--float">
        <p className="lp-convert-kicker type-fine-print">Checkout</p>
        <h3 className="lp-convert-title">Escolha o que cobrar</h3>
        <p className="mt-2 type-fine-print text-[var(--ink-muted-48)]">
          Selecione ou crie um checkout neste bloco.
        </p>
      </div>
    );
  }
  if (!sell) {
    return (
      <div className="lp-convert-card lp-convert-card--float">
        <p className="lp-convert-kicker type-fine-print">Checkout</p>
        <h3 className="lp-convert-title">Checkout indisponível</h3>
      </div>
    );
  }
  const price = (sell.priceCents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: ctx.currency,
  });
  const typeLabel = sell.type ? ` · ${sell.type}` : "";
  return (
    <div className="lp-convert-card lp-convert-card--float">
      <p className="lp-convert-kicker type-fine-print">Checkout</p>
      <h3 className="lp-convert-title">{sell.name || "Checkout"}</h3>
      <p className="lp-convert-price">
        {price}
        <span className="type-micro-legal text-[var(--ink-muted-48)]">
          {typeLabel}
        </span>
      </p>
      <div className="lp-convert-fields" aria-hidden>
        <div className="lp-convert-field">
          <span className="type-micro-legal text-[var(--ink-muted-48)]">
            E-mail
          </span>
          <div className="lp-convert-input" />
        </div>
        <div className="lp-cta lp-cta--full lp-cta--ink" role="presentation">
          Pagar com Mercado Pago
        </div>
      </div>
      <p className="mt-3 text-center type-micro-legal text-[var(--ink-muted-48)]">
        Pix e cartão · entrega após pagamento
      </p>
    </div>
  );
}

function resolveFormSlug(
  ctx: ReturnType<typeof useLpPuckCtx>,
  blockFormId?: string,
): string | null {
  const fid = (blockFormId || "").trim();
  if (fid) {
    const fromCat = ctx.formCatalog?.find((f) => f.id === fid);
    if (fromCat?.slug) return fromCat.slug;
    return null;
  }
  // Legado: form só na página
  return ctx.formSlug ?? null;
}

function AtrakoFormBlock({
  title,
  formId,
}: {
  title: EditableText;
  formId?: string;
}) {
  const ctx = useLpPuckCtx();
  const formSlug = resolveFormSlug(ctx, formId);
  if (ctx.preview) return <FormPreview title={title} formId={formId} />;
  return (
    <LpLeadForm
      title={asPlainText(title) || "Deixe seus dados"}
      formSlug={formSlug}
      workspaceId={ctx.product.clienteId}
      productId={ctx.product.id}
      pageSlug={ctx.product.slug}
    />
  );
}

function resolveSellProduct(
  ctx: ReturnType<typeof useLpPuckCtx>,
  blockProductId?: string,
) {
  const pid = (blockProductId || "").trim();
  if (pid && ctx.checkoutCatalog?.length) {
    const fromCat = ctx.checkoutCatalog.find((p) => p.id === pid);
    if (fromCat) return fromCat;
  }
  if (pid && ctx.checkoutProduct?.id === pid) return ctx.checkoutProduct;
  // Legado: bloco sem productId → default da página
  if (!pid) return ctx.checkoutProduct ?? null;
  return null;
}

function AtrakoCheckoutBlock({ productId }: { productId?: string }) {
  const ctx = useLpPuckCtx();
  const sell = resolveSellProduct(ctx, productId);
  const bump =
    sell && ctx.bumpByProductId
      ? ctx.bumpByProductId[sell.id] ?? null
      : ctx.bump;
  if (ctx.preview) return <CheckoutPreview product={sell} />;
  if (!sell || sell.priceCents <= 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--canvas)] p-6 text-center">
        <p className="type-caption-strong text-[var(--ink)]">
          Checkout indisponível
        </p>
        <p className="mt-2 type-fine-print text-[var(--ink-muted-48)]">
          Escolha o que cobrar neste bloco.
        </p>
      </div>
    );
  }
  return (
    <Suspense
      fallback={<p className="type-caption text-[var(--ink-muted-48)]">…</p>}
    >
      <CheckoutForm
        product={{
          id: sell.id,
          name: sell.name,
          slug: sell.slug,
          priceCents: sell.priceCents,
          description: sell.description,
          type: sell.type,
        }}
        brandName={ctx.brandName}
        currency={ctx.currency}
        mpPublicKey={ctx.mpPublicKey}
        bump={bump}
        pageProductId={ctx.product.id}
        pageSlug={ctx.product.slug}
      />
    </Suspense>
  );
}

function VideoBlock({ url, title, bgColor }: LpPuckComponents["Video"]) {
  const ctx = useLpPuckCtx();
  const embed = youtubeEmbed(url);
  const bg = resolveBg(bgColor, undefined, "#f5f5f7");
  return (
    <section
      className="lp-block lp-video"
      data-tone={isDarkHex(bg) ? "dark" : "light"}
      style={{ background: bg }}
    >
      {embed ? (
        <div className="lp-video-frame" data-preview={ctx.preview || undefined}>
          <iframe
            src={embed}
            title={title || "Vídeo"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </div>
      ) : (
        <MediaPlaceholder>
          Cole o link do YouTube ou Vimeo no painel →
        </MediaPlaceholder>
      )}
    </section>
  );
}

function LogoBlock({
  src,
  alt,
  href,
}: LpPuckComponents["Logo"]) {
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [src]);

  const name = hasEditableText(alt) ? alt : "Logo";
  const showImg = Boolean(src?.trim()) && !broken;
  const inner = showImg ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src.trim()}
      alt={asPlainText(alt) || "Logo"}
      className="lp-logo-img"
      onError={() => setBroken(true)}
    />
  ) : (
    <span className="lp-logo-fallback type-caption-strong">{name}</span>
  );

  return (
    <section className="lp-block lp-logo" data-surface="canvas">
      {href ? (
        <PreviewSafeLink href={href} className="lp-logo-link">
          {inner}
        </PreviewSafeLink>
      ) : (
        inner
      )}
    </section>
  );
}

const baseComponents: Config<LpPuckComponents>["components"] = {
  Hero: {
    label: "Hero",
    fields: {
      layout: {
        type: "radio",
        label: "Layout",
        options: [
          { label: "Central", value: "centered" },
          { label: "Com form", value: "split-form" },
          { label: "Com imagem", value: "split" },
        ],
      },
      eyebrow: edText("Eyebrow"),
      title: edArea("Título"),
      subtitle: edArea("Subtítulo"),
      ctaLabel: edText("Botão"),
      ctaHref: {
        type: "text",
        label: "Link do botão",
        placeholder: "#form ou https://…",
      },
      formTitle: edText("Título do form"),
      formId: formSelectField("Formulário"),
      mediaSrc: imageField("Imagem"),
      bgColor: colorField("Fundo"),
      ctaBg: colorField("Botão"),
    },
    defaultProps: {
      layout: "centered",
      bgColor: "#f5f5f7",
      textColor: "#1d1d1f",
      ctaBg: "#0066cc",
      ctaText: "#ffffff",
      eyebrow: "",
      title: "Headline da oferta",
      subtitle: "Uma frase clara sobre o benefício principal.",
      ctaLabel: "Quero começar",
      ctaHref: "#form",
      formTitle: "Deixe seus dados",
      formId: "",
      mediaSrc: "",
    },
    resolveFields: (data, { changed, lastFields }) => {
      // Recriar fields a cada tecla remonta o input e rouba o foco.
      if (lastFields && !changed.layout && !changed.id) {
        return lastFields;
      }

      const layout = data.props.layout || "centered";
      const base = {
        layout: {
          type: "radio" as const,
          label: "Layout",
          options: [
            { label: "Central", value: "centered" },
            { label: "Com form", value: "split-form" },
            { label: "Com imagem", value: "split" },
          ],
        },
        eyebrow: edText("Eyebrow"),
        title: edArea("Título"),
        subtitle: edArea("Subtítulo"),
        bgColor: colorField("Fundo"),
      };

      if (layout === "split-form") {
        return {
          ...base,
          formTitle: edText("Título do form"),
          formId: formSelectField("Formulário"),
        };
      }

      if (layout === "split") {
        return {
          ...base,
          mediaSrc: imageField("Imagem"),
          ctaLabel: edText("Botão"),
          ctaHref: {
            type: "text" as const,
            label: "Link",
            placeholder: "#checkout ou https://…",
          },
          ctaBg: colorField("Botão"),
        };
      }

      return {
        ...base,
        ctaLabel: edText("Botão"),
        ctaHref: {
          type: "text" as const,
          label: "Link",
          placeholder: "#form ou https://…",
        },
        ctaBg: colorField("Botão"),
      };
    },
    render: (props) => <HeroBlock {...props} />,
  },
  Benefits: {
    label: "Benefícios",
    fields: {
      title: edArea("Título da seção"),
      bgColor: colorField("Fundo"),
      items: {
        type: "array",
        label: "Itens",
        getItemSummary: (item) => asPlainText(item.text) || "Benefício",
        arrayFields: {
          text: edInline("Benefício"),
        },
        defaultItemProps: { text: "Novo benefício" },
      },
    },
    defaultProps: {
      title: "O que você leva",
      bgColor: "#ffffff",
      textColor: "#1d1d1f",
      items: [
        { text: "Resultado claro" },
        { text: "Passo a passo" },
        { text: "Suporte incluso" },
      ],
    },
    render: (props) => <BenefitsBlock {...props} />,
  },
  Stats: {
    label: "Números",
    fields: {
      bgColor: colorField("Fundo"),
      items: {
        type: "array",
        label: "Métricas",
        getItemSummary: (item) =>
          `${asPlainText(item.value) || "0"} · ${asPlainText(item.label) || "métrica"}`,
        arrayFields: {
          value: edInline("Valor"),
          label: edInline("Rótulo"),
        },
        defaultItemProps: { value: "100%", label: "resultado" },
      },
    },
    defaultProps: {
      bgColor: "#ffffff",
      textColor: "#1d1d1f",
      items: [
        { value: "3×", label: "mais conversões" },
        { value: "48h", label: "para o 1º resultado" },
        { value: "100%", label: "no CRM" },
      ],
    },
    render: (props) => <StatsBlock {...props} />,
  },
  Quote: {
    label: "Depoimento",
    fields: {
      text: edArea("Citação"),
      author: edInline("Autor"),
      bgColor: colorField("Fundo"),
    },
    defaultProps: {
      text: "Mudou a forma como fechamos negócios.",
      author: "Cliente",
      bgColor: "#f5f5f7",
      textColor: "#1d1d1f",
    },
    render: (props) => <QuoteBlock {...props} />,
  },
  CtaBand: {
    label: "Faixa CTA",
    fields: {
      title: edText("Título"),
      subtitle: edArea("Subtítulo"),
      ctaLabel: edText("Texto do botão"),
      ctaHref: {
        type: "text",
        label: "Link",
        placeholder: "#form ou https://…",
      },
      bgColor: colorField("Fundo"),
      ctaBg: colorField("Botão"),
    },
    defaultProps: {
      title: "Pronto para começar?",
      subtitle: "Sem compromisso.",
      ctaLabel: "Quero começar",
      ctaHref: "#form",
      bgColor: "#1d1d1f",
      textColor: "#ffffff",
      ctaBg: "#ffffff",
      ctaText: "#1d1d1f",
    },
    render: (props) => <CtaBandBlock {...props} />,
  },
  Heading: {
    label: "Título",
    fields: {
      text: edArea("Texto"),
      textColor: colorField("Texto"),
      level: {
        type: "radio",
        label: "Nível",
        options: [
          { label: "Principal", value: "h1" },
          { label: "Seção", value: "h2" },
        ],
      },
    },
    defaultProps: {
      text: "Headline da oferta",
      level: "h1",
      textColor: "#1d1d1f",
    },
    render: ({ text, level, textColor }) => (
      <section className="lp-block" data-surface="canvas">
        {level === "h2" ? (
          <h2 className="lp-section-title" style={{ color: textColor }}>
            {text}
          </h2>
        ) : (
          <h1 className="lp-hero-title" style={{ color: textColor }}>
            {text}
          </h1>
        )}
      </section>
    ),
  },
  Paragraph: {
    label: "Parágrafo",
    fields: {
      text: edArea("Texto"),
      textColor: colorField("Texto"),
    },
    defaultProps: {
      text: "Descreva o benefício principal em uma ou duas frases.",
      textColor: "#333333",
    },
    render: ({ text, textColor }) => (
      <section className="lp-block" data-surface="canvas">
        <p
          className="lp-prose type-body"
          style={{ color: textColor || undefined }}
        >
          {text}
        </p>
      </section>
    ),
  },
  Image: {
    label: "Imagem",
    fields: {
      src: imageField("Imagem"),
      alt: { type: "text", label: "Descrição (alt)", placeholder: "O que a imagem mostra" },
    },
    defaultProps: { src: "", alt: "Imagem" },
    render: ({ src, alt }) => (
      <section className="lp-block lp-media" data-surface="parchment">
        <SafeImage
          src={src || ""}
          alt={alt || "Imagem"}
          className="lp-media-img shadow-product"
        />
      </section>
    ),
  },
  Logo: {
    label: "Logo",
    fields: {
      src: imageField("Logo"),
      alt: edText("Nome da marca"),
      href: {
        type: "text",
        label: "Link ao clicar",
        placeholder: "# ou https://…",
      },
    },
    defaultProps: { src: "", alt: "Logo", href: "#" },
    render: ({ src, alt, href }) => (
      <LogoBlock src={src} alt={alt} href={href} />
    ),
  },
  Slider: {
    label: "Slider",
    fields: {
      items: {
        type: "array",
        label: "Slides",
        getItemSummary: (item, i) => {
          const n = (i ?? 0) + 1;
          if (item.src?.trim()) {
            return item.alt?.trim() || `Slide ${n}`;
          }
          return `Slide ${n}`;
        },
        arrayFields: {
          src: imageField("Foto"),
          alt: {
            type: "text",
            label: "Legenda",
            placeholder: "Opcional",
          },
        },
        defaultItemProps: { src: "", alt: "" },
        min: 1,
        max: 8,
      },
      bgColor: colorField("Fundo"),
    },
    defaultProps: {
      bgColor: "#f5f5f7",
      items: [{ src: "", alt: "" }],
    },
    render: (props) => <SliderBlock {...props} />,
  },
  Video: {
    label: "Vídeo",
    fields: {
      url: {
        type: "text",
        label: "Link YouTube ou Vimeo",
        placeholder: "youtube.com/watch?v=…",
      },
      title: { type: "text", label: "Título (acessibilidade)" },
      bgColor: colorField("Fundo"),
    },
    defaultProps: { url: "", title: "Vídeo", bgColor: "#f5f5f7" },
    render: (props) => <VideoBlock {...props} />,
  },
  Icon: {
    label: "Ícone",
    fields: {
      symbol: edText("Emoji / símbolo"),
      label: edText("Texto"),
      accentColor: colorField("Cor"),
    },
    defaultProps: { symbol: "✦", label: "Destaque", accentColor: "#0066cc" },
    render: ({ symbol, label, accentColor }) => (
      <section className="lp-block lp-icon-block" data-surface="canvas">
        <div className="lp-icon-card">
          <span
            className="lp-icon-symbol"
            aria-hidden
            style={
              {
                background: `color-mix(in srgb, ${accentColor || "#0066cc"} 12%, white)`,
                color: accentColor || "#0066cc",
              } as CSSProperties
            }
          >
            {hasEditableText(symbol) ? symbol : "✦"}
          </span>
          <p className="type-caption-strong text-[var(--ink)]">
            {hasEditableText(label) ? label : "Texto"}
          </p>
        </div>
      </section>
    ),
  },
  Box: {
    label: "Box",
    fields: {
      title: edText("Título"),
      text: edArea("Texto"),
      bgColor: colorField("Fundo"),
      accentColor: colorField("Faixa"),
    },
    defaultProps: {
      title: "Destaque",
      text: "Use este box para um benefício, garantia ou prova social.",
      bgColor: "#f5f5f7",
      textColor: "#1d1d1f",
      accentColor: "#0066cc",
    },
    render: ({ title, text, bgColor, textColor, accentColor, surface }) => {
      const bg = resolveBg(bgColor, surface, "#f5f5f7");
      const textCol = textColor || contrastInk(bg);
      return (
        <section className="lp-block" data-surface="canvas">
          <div
            className="lp-box-card"
            style={{
              background: bg,
              color: textCol,
              borderLeftColor: accentColor || "#0066cc",
            }}
          >
            <h3 className="type-caption-strong">{title}</h3>
            <p className="mt-2 type-body" style={{ opacity: 0.86 }}>
              {text}
            </p>
          </div>
        </section>
      );
    },
  },
  Circle: {
    label: "Círculo",
    fields: {
      value: edText("Valor / inicial"),
      label: edText("Rótulo"),
      accentColor: colorField("Cor"),
    },
    defaultProps: { value: "A", label: "Avatar", accentColor: "#0066cc" },
    render: ({ value, label, accentColor }) => (
      <section className="lp-block lp-circle-block" data-surface="canvas">
        <div
          className="lp-circle"
          style={
            {
              background: `color-mix(in srgb, ${accentColor || "#0066cc"} 14%, white)`,
              color: accentColor || "#0066cc",
            } as CSSProperties
          }
        >
          <span className="lp-circle-value">
            {hasEditableText(value) ? value : "A"}
          </span>
        </div>
        <p className="mt-3 type-fine-print text-[var(--ink-muted-48)]">
          {hasEditableText(label) ? label : "Rótulo"}
        </p>
      </section>
    ),
  },
  Line: {
    label: "Linha",
    fields: {
      label: edText("Texto no meio (opcional)"),
      lineColor: colorField("Linha"),
    },
    defaultProps: { label: "", lineColor: "#d2d2d7" },
    render: ({ label, lineColor }) => (
      <section className="lp-block lp-line-block" data-surface="canvas">
        <div
          className="lp-line"
          role="separator"
          style={
            {
              "--lp-line-color": lineColor || "#d2d2d7",
            } as CSSProperties
          }
        >
          <span className="lp-line-label type-fine-print">
            {hasEditableText(label) ? label : "\u00a0"}
          </span>
        </div>
      </section>
    ),
  },
  Timer: {
    label: "Timer",
    fields: {
      title: edText("Título"),
      hours: {
        type: "number",
        label: "Horas restantes",
        min: 1,
        max: 720,
      },
      expiredLabel: edText("Texto quando acabar"),
      bgColor: colorField("Fundo"),
    },
    defaultProps: {
      title: "Oferta termina em",
      hours: 72,
      expiredLabel: "Oferta encerrada",
      bgColor: "#ffffff",
      textColor: "#1d1d1f",
    },
    render: (props) => <TimerBlock {...props} />,
  },
  Menu: {
    label: "Menu",
    fields: {
      items: {
        type: "array",
        label: "Links",
        getItemSummary: (item) => asPlainText(item.label) || "Link",
        arrayFields: {
          label: edText("Texto"),
          href: {
            type: "text",
            label: "Link",
            placeholder: "#beneficios ou https://…",
          },
        },
        defaultItemProps: { label: "Início", href: "#" },
        min: 1,
        max: 8,
      },
      ctaLabel: edText("Botão (opcional)"),
      ctaHref: {
        type: "text",
        label: "Link do botão",
        placeholder: "#form",
      },
      ctaBg: colorField("Botão"),
    },
    defaultProps: {
      items: [
        { label: "Início", href: "#" },
        { label: "Benefícios", href: "#beneficios" },
        { label: "FAQ", href: "#faq" },
      ],
      ctaLabel: "Começar",
      ctaHref: "#form",
      ctaBg: "#0066cc",
      ctaText: "#ffffff",
    },
    render: ({ items, ctaLabel, ctaHref, ctaBg, ctaText }) => (
      <section className="lp-block lp-menu" data-surface="canvas">
        <nav className="lp-menu-bar" aria-label="Navegação da página">
          <ul className="lp-menu-links">
            {(items || []).map((item, i) => (
              <li key={i}>
                <PreviewSafeLink
                  href={item.href || "#"}
                  className="lp-menu-link type-caption"
                >
                  {hasEditableText(item.label) ? item.label : "Link"}
                </PreviewSafeLink>
              </li>
            ))}
          </ul>
          {hasEditableText(ctaLabel) ? (
            <PreviewSafeLink
              href={ctaHref || "#form"}
              className="lp-cta lp-menu-cta"
              style={{
                background: ctaBg || "#0066cc",
                color: ctaText || contrastInk(ctaBg || "#0066cc"),
              }}
            >
              {ctaLabel}
            </PreviewSafeLink>
          ) : null}
        </nav>
      </section>
    ),
  },
  Html: {
    label: "HTML/CSS",
    fields: {
      code: {
        type: "textarea",
        label: "HTML (scripts e iframes são removidos)",
      },
    },
    defaultProps: {
      code: '<div class="type-body" style="text-align:center;padding:24px">Bloco HTML customizado</div>',
    },
    render: ({ code }) => {
      const html = sanitizeLpHtml(code);
      return (
        <section className="lp-block lp-html" data-surface="canvas">
          {html.trim() ? (
            <div
              className="lp-html-inner"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <MediaPlaceholder>Cole HTML no painel →</MediaPlaceholder>
          )}
        </section>
      );
    },
  },
  CtaButton: {
    label: "Botão",
    fields: {
      label: edText("Texto"),
      href: {
        type: "text",
        label: "Link",
        placeholder: "#form, #checkout ou URL",
      },
      bgColor: colorField("Botão"),
    },
    defaultProps: {
      label: "Quero começar",
      href: "#form",
      bgColor: "#0066cc",
      textColor: "#ffffff",
    },
    render: ({ label, href, bgColor, textColor }) => (
      <section className="lp-block lp-cta-row" data-surface="canvas">
        <PreviewSafeLink
          href={href || "#form"}
          className="lp-cta"
          style={{
            background: bgColor || "#0066cc",
            color: textColor || contrastInk(bgColor || "#0066cc"),
          }}
        >
          {hasEditableText(label) ? label : "Quero começar"}
        </PreviewSafeLink>
      </section>
    ),
  },
  Faq: {
    label: "FAQ",
    fields: {
      title: edText("Título da seção"),
      bgColor: colorField("Fundo"),
      accentColor: colorField("Ícone"),
      items: {
        type: "array",
        label: "Perguntas",
        getItemSummary: (item) => asPlainText(item.q) || "Pergunta",
        arrayFields: {
          q: edInline("Pergunta"),
          a: edArea("Resposta"),
        },
        defaultItemProps: { q: "Nova pergunta?", a: "Resposta." },
        min: 1,
        max: 20,
      },
    },
    defaultProps: {
      title: "Perguntas frequentes",
      bgColor: "#f5f5f7",
      textColor: "#1d1d1f",
      accentColor: "#0066cc",
      items: [
        { q: "Como funciona?", a: "Você preenche e recebe o próximo passo." },
        {
          q: "Preciso de cartão?",
          a: "Não. Só os dados do formulário.",
        },
      ],
    },
    render: (props) => <FaqBlock {...props} />,
  },
  AtrakoForm: {
    label: "Formulário",
    fields: {
      title: edText("Título"),
      formId: formSelectField("Formulário"),
      bgColor: colorField("Fundo"),
    },
    defaultProps: {
      title: "Deixe seus dados",
      formId: "",
      bgColor: "#ffffff",
      textColor: "#1d1d1f",
    },
    render: ({ title, bgColor, textColor, formId }) => {
      const bg = resolveBg(bgColor, undefined, "#ffffff");
      const text = textColor || contrastInk(bg);
      return (
        <section
          id="form"
          className="lp-block lp-convert"
          data-tone={isDarkHex(bg) ? "dark" : "light"}
          style={{ background: bg, color: text }}
        >
          <AtrakoFormBlock title={title} formId={formId} />
        </section>
      );
    },
  },
  AtrakoCheckout: {
    label: "Checkout",
    fields: {
      productId: checkoutProductField("O que cobrar"),
      bgColor: colorField("Fundo"),
    },
    defaultProps: { placeholder: "", bgColor: "#f5f5f7", productId: "" },
    render: ({ bgColor, productId }) => {
      const bg = resolveBg(bgColor, undefined, "#f5f5f7");
      return (
        <section
          id="checkout"
          className="lp-block lp-convert"
          data-tone={isDarkHex(bg) ? "dark" : "light"}
          style={{ background: bg }}
        >
          <AtrakoCheckoutBlock productId={productId} />
        </section>
      );
    },
  },
};

/** Config Puck — mesma paleta para leads, vendas e híbridas. */
export function createLpPuckConfig(_goal?: LpGoal): Config<LpPuckComponents> {
  const components = { ...baseComponents };

  return {
    components,
    root: {
      fields: {
        primaryColor: {
          type: "text",
          label: "Cor principal (Style guide)",
          visible: false,
        },
      },
      defaultProps: {
        primaryColor: "",
      },
      render: ({ children, primaryColor }) => (
        <LpPageRoot primaryColor={primaryColor}>{children}</LpPageRoot>
      ),
    },
    categories: {
      elements: {
        title: "Elementos",
        components: [...LP_ELEMENT_COMPONENTS],
        defaultExpanded: true,
      },
    },
  };
}
