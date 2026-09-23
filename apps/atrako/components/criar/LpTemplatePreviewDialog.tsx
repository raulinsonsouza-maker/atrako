"use client";

import {
  Component,
  useEffect,
  useMemo,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Render } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import { IconButton } from "@/components/ui/icon-button";
import { createLpPuckConfig } from "@/lib/criar/puck/config";
import { LpPuckProvider } from "@/lib/criar/puck/context";
import {
  buildTemplatePuck,
  getTemplateMeta,
  type LpTemplateId,
} from "@/lib/criar/puck/templates";

type Props = {
  templateId: LpTemplateId;
  onClose: () => void;
  onChoose: (id: LpTemplateId) => void;
};

function PreviewError({ message }: { message: string }) {
  return (
    <div className="lp-template-preview-error">
      <p className="type-caption-strong text-[var(--ink)]">
        Não foi possível renderizar o preview
      </p>
      <p className="mt-2 type-fine-print text-[var(--ink-muted-48)]">
        {message}
      </p>
    </div>
  );
}

class PreviewBoundary extends Component<
  { children: ReactNode; onError: (msg: string) => void },
  { error: string | null }
> {
  state: { error: string | null } = { error: null };

  static getDerivedStateFromError(err: Error) {
    return { error: err.message || "Erro de renderização" };
  }

  componentDidCatch(err: Error, _info: ErrorInfo) {
    this.props.onError(err.message || "Erro de renderização");
  }

  render() {
    if (this.state.error) {
      return <PreviewError message={this.state.error} />;
    }
    return this.props.children;
  }
}

/** Preview fullscreen do template — portal no body (acima do shell). */
export function LpTemplatePreviewDialog({
  templateId,
  onClose,
  onChoose,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = getTemplateMeta(templateId);
  const config = useMemo(() => createLpPuckConfig(), []);
  const puck = useMemo(() => {
    try {
      return buildTemplatePuck(templateId);
    } catch {
      return null;
    }
  }, [templateId]);

  useEffect(() => {
    setMounted(true);
    setError(null);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey, true);
    };
  }, [onClose, templateId]);

  if (!mounted) return null;

  const dialog = (
    <div
      className="lp-template-preview-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview: ${meta?.title ?? "template"}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="lp-template-preview-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="lp-create-modal-head">
          <div className="min-w-0 flex-1">
            <h3 className="type-caption-strong text-[var(--ink)]">
              {meta?.title ?? "Preview"}
            </h3>
            <p className="mt-1 type-micro-legal text-[var(--ink-muted-48)]">
              Pré-visualização ·{" "}
              {meta?.goal === "sales" ? "Vendas" : "Captura"}
            </p>
          </div>
          <IconButton type="button" aria-label="Fechar preview" onClick={onClose}>
            <X className="h-4 w-4" strokeWidth={1.75} />
          </IconButton>
        </header>

        <div className="lp-template-preview-body">
          {error || !puck ? (
            <PreviewError
              message={error || "Template inválido ou incompleto."}
            />
          ) : (
            <PreviewBoundary onError={setError}>
              <LpPuckProvider
                value={{
                  goal: meta?.goal ?? "leads",
                  preview: true,
                  product: {
                    id: "preview",
                    name: meta?.title ?? "Preview",
                    slug: "preview",
                    priceCents: meta?.goal === "sales" ? 9700 : 0,
                    description: null,
                    clienteId: "",
                  },
                  brandName: "Atrako",
                  currency: "BRL",
                  mpPublicKey: null,
                  formSlug: null,
                  formCatalog: [],
                  checkoutProduct:
                    meta?.goal === "sales"
                      ? {
                          id: "preview-checkout",
                          name: "Produto exemplo",
                          slug: "checkout",
                          priceCents: 9700,
                          description: null,
                          clienteId: "",
                          type: "FILE",
                        }
                      : null,
                  checkoutCatalog: [],
                }}
              >
                <div className="lp-template-preview-stage">
                  <div className="lp-page lp-template-preview-page">
                    <Render config={config} data={puck} />
                  </div>
                </div>
              </LpPuckProvider>
            </PreviewBoundary>
          )}
        </div>

        <div className="lp-template-preview-foot">
          <button
            type="button"
            className="lp-pages-btn-secondary"
            onClick={onClose}
          >
            Voltar
          </button>
          <button
            type="button"
            className="lp-pages-btn-primary"
            onClick={() => onChoose(templateId)}
          >
            Escolher este template
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
