"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  Puck,
  usePuck,
  type Data,
} from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import {
  AlignLeft,
  BarChart3,
  CheckCircle2,
  Circle as CircleIcon,
  Code2,
  CreditCard,
  ExternalLink,
  HelpCircle,
  Image as ImageIcon,
  Images,
  LayoutTemplate,
  Loader2,
  Megaphone,
  Menu as MenuIcon,
  Minus,
  Monitor,
  MousePointerClick,
  Quote,
  Redo2,
  Smartphone,
  Sparkles,
  Square,
  Timer as TimerIcon,
  Type,
  ClipboardList,
  Undo2,
  Video,
  BadgeCheck,
} from "lucide-react";
import { BackLink } from "@/components/ui/back-link";
import { IconButton } from "@/components/ui/icon-button";
import {
  LpCanvasChrome,
  LpComponentOverlay,
} from "@/components/criar/LpCanvasInsert";
import { createLpStyleGuidePlugin } from "@/components/criar/LpStyleGuidePlugin";
import { createLpPuckConfig } from "@/lib/criar/puck/config";
import {
  LpPuckProvider,
  type LpFormCatalogItem,
  type LpPuckProduct,
} from "@/lib/criar/puck/context";
import type { LpGoal } from "@/lib/criar/lp-schema";

type Props = {
  goal: LpGoal;
  data: Data;
  onChange: (data: Data) => void;
  product: LpPuckProduct;
  brandName: string;
  currency?: string;
  pageTitle?: string;
  pageName: string;
  onPageNameChange: (name: string) => void;
  path: string;
  goalLabel?: string | null;
  backHref: string;
  saving?: boolean;
  saveState?: "idle" | "dirty" | "saving" | "saved" | "error";
  canPublish?: boolean;
  onPublish: () => void;
  onToggleExtras: () => void;
  extrasOpen?: boolean;
  onOpenPreview: () => void;
  checkoutProduct?: LpPuckProduct | null;
  checkoutCatalog?: LpPuckProduct[];
  formSlug?: string | null;
  formCatalog?: LpFormCatalogItem[];
  onCheckoutCreated?: (product: LpPuckProduct) => void;
  onFormCreated?: (form: LpFormCatalogItem) => void;
};

type ElementMeta = {
  label: string;
  // Lucide icons accept string | number for strokeWidth — keep loose.
  Icon: ComponentType<{ className?: string; strokeWidth?: string | number }>;
};

type ViewportMode = "desktop" | "mobile";

type ViewportStore = {
  mode: ViewportMode;
  listeners: Set<() => void>;
};

const viewportGlobal = globalThis as typeof globalThis & {
  __atrakoLpViewport?: ViewportStore;
};

function getViewportStore(): ViewportStore {
  if (!viewportGlobal.__atrakoLpViewport) {
    viewportGlobal.__atrakoLpViewport = {
      mode: "desktop",
      listeners: new Set(),
    };
  }
  return viewportGlobal.__atrakoLpViewport;
}

function syncEditorViewportAttr(mode: ViewportMode) {
  const root = document.querySelector(".lp-puck-editor");
  if (!root) return;
  root.setAttribute("data-viewport", mode);
}

function getViewportMode() {
  return getViewportStore().mode;
}

function setViewportMode(mode: ViewportMode) {
  const store = getViewportStore();
  if (store.mode === mode) return;
  store.mode = mode;
  syncEditorViewportAttr(mode);
  store.listeners.forEach((l) => l());
}

function subscribeViewport(listener: () => void) {
  const store = getViewportStore();
  store.listeners.add(listener);
  return () => {
    store.listeners.delete(listener);
  };
}

function useStudioViewport() {
  const mode = useSyncExternalStore(
    subscribeViewport,
    getViewportMode,
    getViewportMode,
  );
  return { mode, setMode: setViewportMode };
}

const ELEMENT_META: Record<string, ElementMeta> = {
  Heading: { label: "Título", Icon: Type },
  Paragraph: { label: "Parágrafo", Icon: AlignLeft },
  AtrakoForm: { label: "Formulário", Icon: ClipboardList },
  AtrakoCheckout: { label: "Checkout", Icon: CreditCard },
  CtaButton: { label: "Botão", Icon: MousePointerClick },
  Image: { label: "Imagem", Icon: ImageIcon },
  Logo: { label: "Logo", Icon: BadgeCheck },
  Slider: { label: "Slider", Icon: Images },
  Video: { label: "Vídeo", Icon: Video },
  Icon: { label: "Ícone", Icon: Sparkles },
  Box: { label: "Box", Icon: Square },
  Circle: { label: "Círculo", Icon: CircleIcon },
  Line: { label: "Linha", Icon: Minus },
  Timer: { label: "Timer", Icon: TimerIcon },
  Faq: { label: "FAQ", Icon: HelpCircle },
  Menu: { label: "Menu", Icon: MenuIcon },
  Html: { label: "HTML/CSS", Icon: Code2 },
  Hero: { label: "Hero", Icon: LayoutTemplate },
  Benefits: { label: "Benefícios", Icon: CheckCircle2 },
  Stats: { label: "Números", Icon: BarChart3 },
  Quote: { label: "Depoimento", Icon: Quote },
  CtaBand: { label: "Faixa CTA", Icon: Megaphone },
};

function ElementTile({ name }: { name: string }) {
  const meta = ELEMENT_META[name];
  const Icon = meta?.Icon ?? LayoutTemplate;
  const label = meta?.label ?? name;
  return (
    <div className="lp-el-tile">
      <Icon className="lp-el-tile-icon" strokeWidth={1.5} aria-hidden />
      <span className="lp-el-tile-label">{label}</span>
    </div>
  );
}

/** Preview mobile: coluna 375px centralizada (largura real de celular). */
function StudioPreview({
  children,
  goal,
}: {
  children: ReactNode;
  goal: LpGoal;
}) {
  const { mode } = useStudioViewport();

  useEffect(() => {
    syncEditorViewportAttr(mode);
  }, [mode]);

  const chrome = <LpCanvasChrome goal={goal}>{children}</LpCanvasChrome>;

  if (mode !== "mobile") return chrome;

  return (
    <div className="lp-editor-mobile-stage">
      <div className="lp-editor-mobile-frame" aria-label="Preview mobile">
        {chrome}
      </div>
    </div>
  );
}

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

let saveStateSnapshot: SaveState = "idle";
const saveStateListeners = new Set<() => void>();

function setSaveStateSnapshot(next: SaveState) {
  if (saveStateSnapshot === next) return;
  saveStateSnapshot = next;
  saveStateListeners.forEach((l) => l());
}

function subscribeSaveState(listener: () => void) {
  saveStateListeners.add(listener);
  return () => {
    saveStateListeners.delete(listener);
  };
}

function useSaveState() {
  return useSyncExternalStore(
    subscribeSaveState,
    () => saveStateSnapshot,
    () => "idle" as SaveState,
  );
}

type ChromeProps = {
  pageName: string;
  onPageNameChange: (name: string) => void;
  path: string;
  goalLabel?: string | null;
  backHref: string;
  saving?: boolean;
  canPublish?: boolean;
  onPublish: () => void;
  onToggleExtras: () => void;
  extrasOpen?: boolean;
  onOpenPreview: () => void;
};

function StudioTopBar({
  pageName,
  onPageNameChange,
  path,
  goalLabel,
  backHref,
  saving,
  canPublish,
  onPublish,
  onToggleExtras,
  extrasOpen,
  onOpenPreview,
}: ChromeProps) {
  const { history } = usePuck();
  const { mode, setMode } = useStudioViewport();
  const isMobile = mode === "mobile";
  const saveState = useSaveState();

  const saveLabel =
    saveState === "saving"
      ? "Salvando…"
      : saveState === "saved"
        ? "Salvo"
        : saveState === "dirty"
          ? "A salvar…"
          : saveState === "error"
            ? "Falha ao salvar"
            : null;

  return (
    <header className="lp-editor-top">
      <div className="lp-editor-top-leading">
        <BackLink href={backHref} className="lp-editor-back" />
        <div className="lp-editor-identity">
          <input
            className="lp-editor-name"
            value={pageName}
            onChange={(e) => onPageNameChange(e.target.value)}
            placeholder="Nome da página"
            aria-label="Nome da página"
          />
          <p className="lp-editor-path type-micro-legal" title={path}>
            {path}
            {goalLabel ? ` · ${goalLabel}` : null}
            {saveLabel ? (
              <>
                {" · "}
                <span className="lp-editor-save-state" data-state={saveState}>
                  {saveLabel}
                </span>
              </>
            ) : null}
          </p>
        </div>
      </div>

      <div className="lp-editor-viewports" role="group" aria-label="Visualização">
        <button
          type="button"
          className="lp-editor-viewport-btn"
          data-active={!isMobile ? "true" : undefined}
          aria-pressed={!isMobile}
          onClick={() => setMode("desktop")}
        >
          <Monitor className="lp-editor-viewport-icon" strokeWidth={1.75} aria-hidden />
          <span className="lp-editor-viewport-label">Desktop</span>
        </button>
        <button
          type="button"
          className="lp-editor-viewport-btn"
          data-active={isMobile ? "true" : undefined}
          aria-pressed={isMobile}
          onClick={() => setMode("mobile")}
        >
          <Smartphone className="lp-editor-viewport-icon" strokeWidth={1.75} aria-hidden />
          <span className="lp-editor-viewport-label">Mobile</span>
        </button>
      </div>

      <div className="lp-editor-top-actions">
        <div className="lp-editor-history" role="group" aria-label="Histórico">
          <IconButton
            type="button"
            className="lp-editor-icon-btn"
            aria-label="Desfazer"
            disabled={!history.hasPast}
            onClick={() => history.back()}
          >
            <Undo2 className="h-4 w-4" strokeWidth={1.75} />
          </IconButton>
          <IconButton
            type="button"
            className="lp-editor-icon-btn"
            aria-label="Refazer"
            disabled={!history.hasFuture}
            onClick={() => history.forward()}
          >
            <Redo2 className="h-4 w-4" strokeWidth={1.75} />
          </IconButton>
        </div>
        <span className="lp-editor-top-sep" aria-hidden />
        <button
          type="button"
          className="lp-pages-btn-secondary lp-editor-btn-quiet"
          data-active={extrasOpen ? "true" : undefined}
          onClick={onToggleExtras}
        >
          {extrasOpen ? "Fechar oferta" : "Oferta"}
        </button>
        <button
          type="button"
          className="lp-pages-btn-secondary lp-editor-btn-quiet"
          onClick={onOpenPreview}
        >
          <ExternalLink className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          Abrir
        </button>
        <button
          type="button"
          className="lp-pages-btn-primary"
          disabled={saving || canPublish === false}
          onClick={onPublish}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {saving ? "Publicando…" : "Publicar"}
        </button>
      </div>
    </header>
  );
}

const PUCK_IFRAME = { enabled: false } as const;

const PUCK_UI = {
  leftSideBarVisible: true,
  rightSideBarVisible: true,
} as const;

const PUCK_DICTIONARY = {
  "header-publish": "Publicar",
  "header-undo": "Desfazer",
  "header-redo": "Refazer",
  "header-toggle-leftsidebar": "Elementos",
  "header-toggle-rightsidebar": "Propriedades",
  "action-duplicate": "Duplicar",
  "action-delete": "Excluir",
  "action-selectparent": "Selecionar grupo",
  "label-page": "Página",
  "label-component": "Bloco",
  "outline-empty": "Arraste elementos para a página",
  "outline-header-title": "Camadas",
  "outline-item-duplicate": "Duplicar",
  "outline-item-delete": "Excluir",
  "drawer-category-other": "Outros",
  "plugin-blocks": "Elementos",
  "plugin-outline": "Camadas",
  "plugin-fields": "Props",
  "plugin-components": "Elementos",
  "viewport-switch": "Ver {label}",
} as const;

export function PuckLpEditor({
  goal,
  data,
  onChange,
  product,
  brandName,
  currency = "BRL",
  pageTitle = "Landing page",
  pageName,
  onPageNameChange,
  path,
  goalLabel,
  backHref,
  saving,
  saveState = "idle",
  canPublish,
  onPublish,
  onToggleExtras,
  extrasOpen,
  onOpenPreview,
  checkoutProduct = null,
  checkoutCatalog = [],
  formSlug = null,
  formCatalog = [],
  onCheckoutCreated,
  onFormCreated,
}: Props) {
  const config = useMemo(() => createLpPuckConfig(), []);
  const stylePlugin = useMemo(() => createLpStyleGuidePlugin(), []);
  const plugins = useMemo(() => [stylePlugin], [stylePlugin]);
  const { mode } = useStudioViewport();

  useEffect(() => {
    document.documentElement.dataset.lpStudio = "1";
    syncEditorViewportAttr(getViewportMode());
    return () => {
      delete document.documentElement.dataset.lpStudio;
    };
  }, []);

  useEffect(() => {
    setSaveStateSnapshot(saveState);
  }, [saveState]);

  const chromeRef = useRef<ChromeProps>({
    pageName,
    onPageNameChange,
    path,
    goalLabel,
    backHref,
    saving,
    canPublish,
    onPublish,
    onToggleExtras,
    extrasOpen,
    onOpenPreview,
  });
  chromeRef.current = {
    pageName,
    onPageNameChange,
    path,
    goalLabel,
    backHref,
    saving,
    canPublish,
    onPublish,
    onToggleExtras,
    extrasOpen,
    onOpenPreview,
  };

  const ctxValue = useMemo(
    () => ({
      goal,
      preview: true as const,
      product,
      brandName,
      currency,
      mpPublicKey: null as string | null,
      formSlug,
      formCatalog,
      checkoutProduct,
      checkoutCatalog,
      onCheckoutCreated,
      onFormCreated,
    }),
    [
      goal,
      product.id,
      product.name,
      product.slug,
      product.priceCents,
      product.clienteId,
      brandName,
      currency,
      formSlug,
      formCatalog,
      checkoutProduct?.id,
      checkoutProduct?.name,
      checkoutProduct?.priceCents,
      checkoutProduct?.type,
      checkoutCatalog,
      onCheckoutCreated,
      onFormCreated,
    ],
  );

  const HeaderOverride = useCallback(
    () => <StudioTopBar {...chromeRef.current} />,
    [],
  );
  const HeaderActionsOverride = useCallback(() => <></>, []);
  const PreviewOverride = useCallback(
    ({ children }: { children: ReactNode }) => (
      <StudioPreview goal={goal}>{children}</StudioPreview>
    ),
    [goal],
  );
  const OverlayOverride = useCallback(
    (props: Parameters<typeof LpComponentOverlay>[0]) => (
      <LpComponentOverlay {...props} />
    ),
    [],
  );
  const DrawerItemOverride = useCallback(
    ({ name }: { name: string }) => <ElementTile name={name} />,
    [],
  );
  const FieldsOverride = useCallback(
    ({
      children,
      itemSelector,
    }: {
      children: ReactNode;
      itemSelector?: unknown;
    }) =>
      itemSelector ? (
        <div className="lp-puck-fields">{children}</div>
      ) : (
        <div className="lp-puck-fields-empty">
          <p className="type-caption-strong text-[var(--ink)]">Propriedades</p>
          <p className="mt-2 type-fine-print text-[var(--ink-muted-48)]">
            Clique num bloco na página para editar textos, links e opções — ou
            abra Estilo na barra à esquerda.
          </p>
        </div>
      ),
    [],
  );

  const overrides = useMemo(
    () => ({
      header: HeaderOverride,
      headerActions: HeaderActionsOverride,
      preview: PreviewOverride,
      componentOverlay: OverlayOverride,
      drawerItem: DrawerItemOverride,
      fields: FieldsOverride,
    }),
    [
      HeaderOverride,
      HeaderActionsOverride,
      PreviewOverride,
      OverlayOverride,
      DrawerItemOverride,
      FieldsOverride,
    ],
  );

  return (
    <LpPuckProvider value={ctxValue}>
      <div className="lp-puck-editor" data-viewport={mode}>
        <Puck
          config={config}
          data={data}
          onChange={onChange}
          height="100%"
          headerTitle={pageTitle}
          headerPath=""
          plugins={plugins}
          ui={PUCK_UI}
          overrides={overrides}
          dictionary={PUCK_DICTIONARY}
          iframe={PUCK_IFRAME}
        />
      </div>
    </LpPuckProvider>
  );
}
