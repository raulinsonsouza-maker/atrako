"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  Hand,
  Instagram,
  MessageSquare,
  MoreVertical,
  Pencil,
  Plus,
  Redo2,
  Search,
  Undo2,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

type FluxoNo = {
  id: string;
  tipo: string;
  config: Record<string, unknown>;
  posX: number;
  posY: number;
  nextIds: string[];
};

type MediaItem = {
  id: string;
  caption?: string;
  media_url?: string;
  thumbnail_url?: string;
  media_type?: string;
  timestamp?: string;
};

type MatchMode = "any" | "exact" | "contains" | "starts_with";
type MediaFilter = "any" | "specific" | "next";
type PanelMode = "closed" | "pick" | "configure";

type TriggerOption = {
  id: string;
  triggerType: string;
  title: string;
  description: string;
  soon?: boolean;
};

const TRIGGER_OPTIONS: TriggerOption[] = [
  {
    id: "comment_feed",
    triggerType: "comment_keyword",
    title: "Comentário no Feed",
    description: "O usuário deixa um comentário em Publicação ou Reels",
  },
  {
    id: "story_reply",
    triggerType: "story_reply",
    title: "Resposta à Story",
    description: "Usuário responde ao seu story",
  },
  {
    id: "story_mention",
    triggerType: "story_mention",
    title: "Menção à Story",
    description: "Usuário menciona o seu perfil em um story",
  },
  {
    id: "keyword",
    triggerType: "keyword",
    title: "Mensagem Recebida",
    description: "Quando o usuário enviar uma mensagem",
  },
  {
    id: "live",
    triggerType: "live_comment",
    title: "Comentário em Live",
    description: "O usuário deixa um comentário em uma transmissão ao vivo",
  },
  {
    id: "welcome",
    triggerType: "welcome",
    title: "Primeira mensagem",
    description: "Quando o contato envia a primeira DM",
  },
  {
    id: "manual",
    triggerType: "manual",
    title: "Disparo Manual",
    description: "A automação será ativada manualmente",
  },
];

const NODE_LABELS: Record<string, string> = {
  trigger: "Gatilho",
  send_message: "Enviar mensagem",
  wait: "Aguardar",
  wait_reply: "Aguardar resposta",
  add_tag: "Adicionar tag",
  condition: "Condição",
  handoff_human: "Handoff humano",
  split: "A/B test",
  collect_phone: "Capturar telefone",
  send_poll: "Enviar enquete",
  dynamic_menu: "Menu dinâmico",
  notify_admin: "Notificar admin",
};

const MATCH_OPTIONS: { id: MatchMode; label: string }[] = [
  { id: "any", label: "Qualquer palavra-chave" },
  { id: "exact", label: "Palavra ou frase exata" },
  { id: "contains", label: "A mensagem contém a palavra" },
  { id: "starts_with", label: "A palavra aparece no começo" },
];

function triggerTitle(type: string) {
  return (
    TRIGGER_OPTIONS.find((t) => t.triggerType === type)?.title ??
    (type === "unset" ? "Sem gatilho" : type)
  );
}

function SymbiusNode({ data, selected }: NodeProps) {
  const tipo = String(data.tipo ?? "node");
  const config = (data.config ?? {}) as Record<string, unknown>;
  const triggerConfigured = Boolean(data.triggerConfigured);
  const triggerLabel = String(data.triggerLabel ?? "Gatilho");
  const onAddTrigger = data.onAddTrigger as (() => void) | undefined;

  if (tipo === "trigger") {
    return (
      <div
        className={`w-[280px] rounded-2xl border-2 bg-white shadow-md ${
          selected ? "border-[#2d6cdf]" : "border-[#93c5fd]"
        }`}
      >
        <div className="flex items-center gap-1.5 rounded-t-xl bg-[#2d6cdf] px-3 py-1.5 text-xs font-bold text-white">
          <Zap className="h-3.5 w-3.5" />
          Gatilho
        </div>
        <div className="p-4">
          <p className="text-sm font-semibold text-zinc-800">
            {triggerConfigured
              ? triggerLabel
              : "Gatilho para acionar a automação"}
          </p>
          {triggerConfigured ? (
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              {String(data.triggerSummary ?? "Configurado")}
            </p>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddTrigger?.();
              }}
              className="mt-3 w-full rounded-xl bg-zinc-100 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-200"
            >
              Adicionar gatilho +
            </button>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-zinc-100 px-3 py-2 text-[11px] font-medium text-zinc-600">
          Próximo passo
          <Handle
            type="source"
            position={Position.Bottom}
            className="!relative !bottom-0 !left-0 !right-0 !top-0 !transform-none !h-5 !w-5 !rounded-full !border-2 !border-zinc-300 !bg-white !text-zinc-500"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-w-[200px] rounded-2xl border-2 bg-white px-4 py-3 shadow-md ${
        selected ? "border-[#2d6cdf]" : "border-zinc-200"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-[#2d6cdf] !bg-white"
      />
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#1d4ed8]">
        {NODE_LABELS[tipo] ?? tipo}
      </p>
      {tipo === "send_message" && (
        <p className="mt-2 line-clamp-3 text-sm text-zinc-800">
          {String(config.text ?? "")}
        </p>
      )}
      {tipo === "wait" && (
        <p className="mt-2 text-sm text-zinc-800">
          {String(config.minutes ?? 0)} min
        </p>
      )}
      {tipo === "add_tag" && (
        <p className="mt-2 text-sm text-zinc-800">#{String(config.tag ?? "")}</p>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !border-2 !border-emerald-400 !bg-white"
      />
    </div>
  );
}

const nodeTypes = { symbius: SymbiusNode };

function Toolbar({ onAddStep }: { onAddStep: () => void }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  return (
    <div className="absolute right-4 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2">
      <button
        type="button"
        onClick={onAddStep}
        className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#2d6cdf] text-white shadow-lg hover:bg-[#255bbd]"
        title="Adicionar passo"
      >
        <Plus className="h-5 w-5" />
      </button>
      <div className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white p-1 shadow-md">
        <button
          type="button"
          onClick={() => zoomIn()}
          className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-50"
          title="Zoom +"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => zoomOut()}
          className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-50"
          title="Zoom -"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => fitView({ padding: 0.2 })}
          className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-50"
          title="Ajustar"
        >
          <Hand className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled
          className="hidden"
          aria-hidden
          title="Desfazer"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled
          className="hidden"
          aria-hidden
          title="Refazer"
        >
          <Redo2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function FlowEditorInner({ fluxoId }: { fluxoId: string }) {
  const [nome, setNome] = useState("Sem título");
  const [status, setStatus] = useState("DRAFT");
  const [triggerType, setTriggerType] = useState("unset");
  const [keywordList, setKeywordList] = useState<string[]>([]);
  const [keywordDraft, setKeywordDraft] = useState("");
  const [matchMode, setMatchMode] = useState<MatchMode>("contains");
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("any");
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [mediaSearch, setMediaSearch] = useState("");
  const [mediaWarning, setMediaWarning] = useState<string | null>(null);
  const [nos, setNos] = useState<FluxoNo[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [panel, setPanel] = useState<PanelMode>("closed");
  const [configStep, setConfigStep] = useState(1);
  const [pendingTrigger, setPendingTrigger] = useState<string | null>(null);
  const [showMatchMenu, setShowMatchMenu] = useState(false);
  const [showMediaMenu, setShowMediaMenu] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const triggerConfigured =
    triggerType !== "unset" &&
    triggerType !== "none" &&
    (triggerType === "welcome" ||
      matchMode === "any" ||
      keywordList.length > 0);

  const triggerSummary = useMemo(() => {
    if (!triggerConfigured) return "";
    const parts: string[] = [triggerTitle(triggerType)];
    if (triggerType === "comment_keyword") {
      parts.push(
        mediaFilter === "specific"
          ? "Post específico"
          : mediaFilter === "next"
            ? "Próximo post"
            : "Qualquer post",
      );
    }
    if (matchMode === "any") parts.push("Qualquer palavra-chave");
    else if (keywordList.length)
      parts.push(keywordList.slice(0, 3).join(", "));
    return parts.join(" · ");
  }, [
    triggerConfigured,
    triggerType,
    mediaFilter,
    matchMode,
    keywordList,
  ]);

  const syncTriggerOntoNodes = useCallback(
    (list: Node[]) =>
      list.map((n) => {
        if (String(n.data.tipo) !== "trigger") return n;
        return {
          ...n,
          data: {
            ...n.data,
            triggerConfigured,
            triggerLabel: triggerTitle(triggerType),
            triggerSummary,
            onAddTrigger: () => {
              setPanel("pick");
              setConfigStep(1);
            },
          },
        };
      }),
    [triggerConfigured, triggerType, triggerSummary],
  );

  useEffect(() => {
    setNodes((prev) => syncTriggerOntoNodes(prev));
  }, [syncTriggerOntoNodes, setNodes]);

  useEffect(() => {
    fetch(`/api/symbius/flows/${fluxoId}`)
      .then((r) => r.json())
      .then((d) => {
        const f = d.fluxo;
        if (!f) return;
        setNome(f.nome);
        setStatus(f.status);
        setTriggerType(f.triggerType || "unset");
        const cfg = f.triggerConfig as {
          keywords?: string[];
          mediaFilter?: string;
          mediaId?: string;
          anyKeyword?: boolean;
          matchMode?: string;
        };
        const kws = cfg.keywords ?? [];
        setKeywordList(kws);
        if (cfg.anyKeyword) setMatchMode("any");
        else if (cfg.matchMode === "exact" || cfg.matchMode === "starts_with" || cfg.matchMode === "contains") {
          setMatchMode(cfg.matchMode);
        } else {
          setMatchMode(kws.length ? "contains" : "any");
        }
        setMediaFilter(
          cfg.mediaFilter === "specific"
            ? "specific"
            : cfg.mediaFilter === "next"
              ? "next"
              : "any",
        );
        setMediaId(cfg.mediaId ?? null);
        setNos(f.nos);
        const mapped: Node[] = f.nos.map((n: FluxoNo) => ({
          id: n.id,
          type: "symbius",
          position: { x: n.posX, y: n.posY },
          data: { tipo: n.tipo, config: n.config },
        }));
        setNodes(mapped);
        const e: Edge[] = [];
        for (const n of f.nos as FluxoNo[]) {
          for (const next of n.nextIds) {
            e.push({
              id: `${n.id}-${next}`,
              source: n.id,
              target: next,
              style: { stroke: "#d4d4d8", strokeWidth: 2 },
            });
          }
        }
        setEdges(e);

        // blank / unset: open trigger picker
        if ((f.triggerType || "unset") === "unset") {
          setPanel("pick");
        }
      });
  }, [fluxoId, setNodes, setEdges]);

  useEffect(() => {
    if (
      panel === "configure" &&
      (pendingTrigger === "comment_keyword" ||
        triggerType === "comment_keyword")
    ) {
      fetch("/api/symbius/instagram/media")
        .then((r) => r.json())
        .then((d) => {
          setMedia(d.media ?? []);
          setMediaWarning(
            typeof d.warning === "string" ? d.warning : null,
          );
        });
    }
  }, [panel, pendingTrigger, triggerType]);

  const onConnect = useCallback(
    (c: Connection) =>
      setEdges((eds) =>
        addEdge(
          { ...c, style: { stroke: "#d4d4d8", strokeWidth: 2 } },
          eds,
        ),
      ),
    [setEdges],
  );

  const selected = useMemo(
    () => nos.find((n) => n.id === selectedNode),
    [nos, selectedNode],
  );

  const filteredMedia = useMemo(() => {
    const q = mediaSearch.trim().toLowerCase();
    if (!q) return media;
    return media.filter((m) =>
      String(m.caption ?? "").toLowerCase().includes(q),
    );
  }, [media, mediaSearch]);

  function addNode(tipo: string) {
    const id = `temp-${Date.now()}`;
    const defaults: Record<string, Record<string, unknown>> = {
      send_message: { text: "Nova mensagem" },
      wait: { minutes: 5 },
      wait_reply: { replyValidation: "any", replyField: "text" },
      condition: { field: "text", operator: "contains", value: "" },
      collect_phone: {},
      add_tag: { tag: "lead" },
      notify_admin: { message: "Novo lead" },
      handoff_human: {},
    };
    const node: FluxoNo = {
      id,
      tipo,
      config: defaults[tipo] ?? {},
      posX: 280 + nos.length * 40,
      posY: 280 + nos.length * 80,
      nextIds: [],
    };
    setNos((prev) => [...prev, node]);
    setNodes((prev) => [
      ...prev,
      {
        id,
        type: "symbius",
        position: { x: node.posX, y: node.posY },
        data: { tipo, config: node.config },
      },
    ]);
    setSelectedNode(id);
    setAddMenuOpen(false);
    setPanel("closed");
  }

  function updateSelectedNode(patch: Partial<FluxoNo>) {
    if (!selectedNode) return;
    setNos((prev) =>
      prev.map((n) => (n.id === selectedNode ? { ...n, ...patch } : n)),
    );
    setNodes((prev) =>
      prev.map((n) =>
        n.id === selectedNode
          ? {
              ...n,
              data: {
                ...n.data,
                config: patch.config ?? n.data.config,
              },
            }
          : n,
      ),
    );
  }

  function pickTrigger(opt: TriggerOption) {
    if (opt.soon) return;
    setPendingTrigger(opt.triggerType);
    setTriggerType(opt.triggerType);
    if (opt.triggerType === "welcome") {
      setMatchMode("any");
      setKeywordList([]);
      setPanel("closed");
      return;
    }
    setConfigStep(1);
    setPanel("configure");
    if (opt.triggerType === "keyword" || opt.triggerType === "story_reply") {
      // skip media step
      setConfigStep(2);
    }
  }

  function addKeyword() {
    const v = keywordDraft.trim();
    if (!v) return;
    if (!keywordList.includes(v)) setKeywordList((prev) => [...prev, v]);
    setKeywordDraft("");
  }

  function finishTriggerConfig() {
    setPanel("closed");
    setShowMatchMenu(false);
    setShowMediaMenu(false);
  }

  async function save(publish = false) {
    setSaving(true);
    const nodePayload = nodes.map((n) => {
      const no = nos.find((x) => x.id === n.id);
      const nextIds = edges
        .filter((e) => e.source === n.id)
        .map((e) => e.target);
      return {
        id: n.id,
        tipo: String(no?.tipo ?? n.data.tipo),
        config: (no?.config ?? n.data.config) as Record<string, unknown>,
        posX: n.position.x,
        posY: n.position.y,
        nextIds,
      };
    });

    const triggerConfig: Record<string, unknown> = {
      keywords: keywordList,
      anyKeyword: matchMode === "any",
      matchMode: matchMode === "any" ? "contains" : matchMode,
    };
    if (triggerType === "comment_keyword") {
      triggerConfig.mediaFilter = mediaFilter;
      if (mediaFilter === "specific" && mediaId) {
        triggerConfig.mediaId = mediaId;
      }
    }

    const res = await fetch("/api/symbius/flows", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: fluxoId,
        nome,
        status: publish ? "PUBLISHED" : status,
        triggerType,
        triggerConfig,
        nodes: nodePayload,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setSavedAt(new Date());
      if (publish) setStatus("PUBLISHED");
    } else {
      const err = await res.json();
      alert(err.error ?? "Erro ao salvar");
    }
  }

  const activeTriggerType = pendingTrigger ?? triggerType;
  const isComment = activeTriggerType === "comment_keyword";
  const maxSteps = isComment ? 3 : 2;
  const step = isComment ? configStep : Math.min(configStep, 2);

  return (
    <div className="symbius-light fixed inset-0 z-50 flex flex-col bg-[#f4f5f7] text-zinc-900">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-3 md:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/app/flows"
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex min-w-0 items-center gap-1.5">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onBlur={() => void save(false)}
              className="max-w-[200px] truncate border-0 bg-transparent text-sm font-semibold text-zinc-900 outline-none md:max-w-xs"
            />
            <Pencil className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
          </div>
          {status === "PUBLISHED" && (
            <span className="rounded bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              LIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => save(false)}
            className="hidden rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 sm:inline-flex"
          >
            Salvar
          </button>
          <button
            type="button"
            disabled={saving || !triggerConfigured}
            onClick={() => save(true)}
            className="inline-flex items-center rounded-lg bg-[#2d6cdf] px-3 py-2 text-sm font-semibold text-white hover:bg-[#255bbd] disabled:opacity-50"
          >
            Visualizar e publicar
          </button>
          <button
            type="button"
            className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100"
          >
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* Left config panel */}
        {panel !== "closed" && (
          <aside className="absolute left-0 top-0 z-30 flex h-full w-full max-w-md flex-col border-r border-zinc-200 bg-white shadow-xl sm:w-[380px]">
            {panel === "pick" && (
              <>
                <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
                  <h2 className="font-bold">Gatilhos</h2>
                  <button
                    type="button"
                    onClick={() => setPanel("closed")}
                    className="rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                    Escolha o canal
                  </p>
                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm font-medium">
                    <Instagram className="h-4 w-4 text-pink-500" />
                    Instagram
                  </div>

                  <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                    Escolha o gatilho
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    Evento específico do Instagram que inicia sua automação.
                  </p>
                  <div className="mt-3 space-y-2">
                    {TRIGGER_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={opt.soon}
                        onClick={() => pickTrigger(opt)}
                        className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${
                          opt.soon
                            ? "cursor-not-allowed border-zinc-100 opacity-50"
                            : "border-zinc-200 hover:border-[#2d6cdf] hover:bg-sky-50/50"
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                            triggerType === opt.triggerType
                              ? "border-[#2d6cdf] bg-[#2d6cdf] text-white"
                              : "border-zinc-300"
                          }`}
                        >
                          {triggerType === opt.triggerType && (
                            <Check className="h-3 w-3" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="font-semibold text-zinc-900">
                              {opt.title}
                            </span>
                            {opt.soon && (
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-700">
                                Em breve
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block text-sm text-zinc-500">
                            {opt.description}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="border-t border-zinc-100 p-4">
                  <button
                    type="button"
                    onClick={() => setPanel("closed")}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2d6cdf] py-2.5 text-sm font-semibold text-white hover:bg-[#255bbd]"
                  >
                    <Check className="h-4 w-4" />
                    Continuar
                  </button>
                </div>
              </>
            )}

            {panel === "configure" && (
              <>
                <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (step > 1) setConfigStep(step - 1);
                        else setPanel("pick");
                      }}
                      className="rounded-lg p-1 text-zinc-600 hover:bg-zinc-100"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <h2 className="font-bold">
                      {triggerTitle(activeTriggerType)}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPanel("closed")}
                    className="rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="border-b border-zinc-100 px-4 py-3">
                  <p className="text-xs font-medium text-zinc-500">
                    Etapa {step} de {maxSteps}
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className="h-full rounded-full bg-[#2d6cdf] transition-all"
                      style={{ width: `${(step / maxSteps) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {/* Step 1 comment: which posts */}
                  {isComment && step === 1 && (
                    <div>
                      <h3 className="text-base font-bold leading-snug">
                        Em quais Comentário no Feed a automação deve funcionar?
                      </h3>
                      <div className="relative mt-4">
                        <button
                          type="button"
                          onClick={() => setShowMediaMenu((v) => !v)}
                          className="flex w-full items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-left text-sm font-medium"
                        >
                          {mediaFilter === "specific"
                            ? "Post específico"
                            : mediaFilter === "next"
                              ? "Meu próximo post"
                              : "Qualquer post"}
                          <span className="text-zinc-600">▾</span>
                        </button>
                        {showMediaMenu && (
                          <div className="absolute z-10 mt-1 w-full rounded-xl border border-zinc-200 bg-white py-1 shadow-lg">
                            {(
                              [
                                ["any", "Qualquer post"],
                                ["specific", "Post específico"],
                                ["next", "Meu próximo post"],
                              ] as const
                            ).map(([id, label]) => (
                              <button
                                key={id}
                                type="button"
                                onClick={() => {
                                  setMediaFilter(id);
                                  setShowMediaMenu(false);
                                  if (id !== "specific") setMediaId(null);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-zinc-50"
                              >
                                <span
                                  className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                                    mediaFilter === id
                                      ? "border-[#2d6cdf] bg-[#2d6cdf] text-white"
                                      : "border-zinc-300"
                                  }`}
                                >
                                  {mediaFilter === id && (
                                    <Check className="h-2.5 w-2.5" />
                                  )}
                                </span>
                                {label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {mediaFilter === "specific" && (
                        <div className="mt-5">
                          <p className="text-sm font-semibold">
                            Selecione os posts
                          </p>
                          {mediaWarning && (
                            <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-snug text-amber-900">
                              {mediaWarning}
                            </p>
                          )}
                          <div className="relative mt-2">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                            <input
                              value={mediaSearch}
                              onChange={(e) => setMediaSearch(e.target.value)}
                              placeholder="Buscar por legenda ou data"
                              className="w-full rounded-xl border border-zinc-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#2d6cdf]"
                            />
                          </div>
                          <div className="mt-3 grid max-h-64 grid-cols-3 gap-2 overflow-y-auto">
                            {filteredMedia.map((m) => {
                              const src = m.thumbnail_url || m.media_url;
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => setMediaId(m.id)}
                                  className={`overflow-hidden rounded-lg border-2 ${
                                    mediaId === m.id
                                      ? "border-[#2d6cdf]"
                                      : "border-transparent"
                                  }`}
                                >
                                  <div className="aspect-square bg-zinc-100">
                                    {src ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={src}
                                        alt=""
                                        className="h-full w-full object-cover"
                                      />
                                    ) : null}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                          {mediaWarning && (
                            <input
                              value={mediaId ?? ""}
                              onChange={(e) =>
                                setMediaId(e.target.value.trim() || null)
                              }
                              placeholder="Ou cole o ID da publicação"
                              className="mt-3 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-[#2d6cdf]"
                            />
                          )}
                        </div>
                      )}

                      {mediaFilter === "next" && (
                        <p className="mt-4 rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-900">
                          A automação valerá para a próxima publicação ou Reel
                          publicada após ativar o fluxo.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Keywords step */}
                  {((isComment && step === 2) ||
                    (!isComment &&
                      step === 2 &&
                      activeTriggerType !== "welcome")) && (
                    <div>
                      <h3 className="text-base font-bold leading-snug">
                        Quais palavras ou frases ativam a automação?
                      </h3>
                      <p className="mt-1 text-sm text-zinc-500">
                        As palavras-chave valem para todos os gatilhos desta
                        automação.
                      </p>

                      <div className="relative mt-4">
                        <p className="mb-1 text-[10px] font-semibold uppercase text-zinc-600">
                          Selecionado
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowMatchMenu((v) => !v)}
                          className="flex w-full items-center justify-between rounded-xl border border-zinc-200 px-3 py-2.5 text-left text-sm font-medium"
                        >
                          {MATCH_OPTIONS.find((m) => m.id === matchMode)?.label}
                          <span className="text-zinc-600">▾</span>
                        </button>
                        {showMatchMenu && (
                          <div className="absolute z-10 mt-1 w-full rounded-xl border border-zinc-200 bg-white py-1 shadow-lg">
                            {MATCH_OPTIONS.map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  setMatchMode(opt.id);
                                  setShowMatchMenu(false);
                                  if (opt.id === "any") setKeywordList([]);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-zinc-50"
                              >
                                <span
                                  className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                                    matchMode === opt.id
                                      ? "border-[#2d6cdf] bg-[#2d6cdf] text-white"
                                      : "border-zinc-300"
                                  }`}
                                >
                                  {matchMode === opt.id && (
                                    <Check className="h-2.5 w-2.5" />
                                  )}
                                </span>
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {matchMode !== "any" && (
                        <div className="mt-5">
                          <p className="text-sm font-semibold">
                            Adicionar palavra-chave
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {keywordList.map((k) => (
                              <span
                                key={k}
                                className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 text-sm font-medium text-sky-800"
                              >
                                {k}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setKeywordList((prev) =>
                                      prev.filter((x) => x !== k),
                                    )
                                  }
                                  className="text-sky-500 hover:text-sky-800"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </span>
                            ))}
                          </div>
                          <div className="mt-3 flex gap-2">
                            <input
                              value={keywordDraft}
                              onChange={(e) => setKeywordDraft(e.target.value)}
                              onKeyDown={(e) =>
                                e.key === "Enter" && addKeyword()
                              }
                              placeholder="Adicionar texto"
                              className="flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-[#2d6cdf]"
                            />
                            <button
                              type="button"
                              onClick={addKeyword}
                              className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2d6cdf] text-white"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 3 comment: next action hint */}
                  {isComment && step === 3 && (
                    <div>
                      <h3 className="text-base font-bold">Pronto para o fluxo</h3>
                      <p className="mt-2 text-sm text-zinc-500">
                        Gatilho configurado. Use o botão{" "}
                        <strong>+</strong> à direita para adicionar mensagens,
                        tags e waits no canvas.
                      </p>
                      <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
                        {triggerSummary}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 border-t border-zinc-100 p-4">
                  {step < maxSteps ? (
                    <button
                      type="button"
                      onClick={() => setConfigStep(step + 1)}
                      disabled={
                        (isComment &&
                          step === 1 &&
                          mediaFilter === "specific" &&
                          !mediaId) ||
                        (step === 2 &&
                          matchMode !== "any" &&
                          keywordList.length === 0)
                      }
                      className="flex-1 rounded-xl bg-[#2d6cdf] py-2.5 text-sm font-semibold text-white hover:bg-[#255bbd] disabled:opacity-50"
                    >
                      Continuar
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={finishTriggerConfig}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#2d6cdf] py-2.5 text-sm font-semibold text-white hover:bg-[#255bbd]"
                    >
                      <Check className="h-4 w-4" />
                      Salvar gatilho
                    </button>
                  )}
                </div>
              </>
            )}
          </aside>
        )}

        {/* Canvas */}
        <div className="relative min-h-0 flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onNodeClick={(_, n) => {
              setSelectedNode(n.id);
              if (String(n.data.tipo) === "trigger") {
                setPanel(triggerConfigured ? "configure" : "pick");
                setConfigStep(1);
                if (
                  triggerType === "keyword" ||
                  triggerType === "story_reply"
                ) {
                  setConfigStep(2);
                }
              } else {
                setPanel("closed");
              }
            }}
            onPaneClick={() => {
              setSelectedNode(null);
              setAddMenuOpen(false);
            }}
            fitView
            proOptions={{ hideAttribution: true }}
            className="bg-[#f4f5f7]"
          >
            <Background color="#e4e4e7" gap={20} size={1} />
          </ReactFlow>

          <Toolbar
            onAddStep={() => {
              setAddMenuOpen((v) => !v);
            }}
          />

          {addMenuOpen && (
            <div className="absolute right-20 top-[calc(50%-180px)] z-30 w-52 rounded-xl border border-zinc-200 bg-white p-2 text-zinc-900 shadow-xl">
              <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-600">
                Adicionar passo
              </p>
              {[
                "send_message",
                "wait",
                "wait_reply",
                "condition",
                "collect_phone",
                "add_tag",
                "notify_admin",
                "handoff_human",
              ].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => addNode(t)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                >
                  <MessageSquare className="h-4 w-4 shrink-0 text-[#0084ff]" />
                  {NODE_LABELS[t]}
                </button>
              ))}
            </div>
          )}

          {/* Node inspector */}
          {selected && selected.tipo !== "trigger" && (
            <div className="absolute bottom-16 left-4 z-20 w-80 rounded-2xl border border-zinc-200 bg-white p-4 text-zinc-900 shadow-xl">
              <p className="font-semibold text-zinc-900">
                {NODE_LABELS[selected.tipo]}
              </p>
              {selected.tipo === "send_message" && (
                <textarea
                  className="mt-3 min-h-[100px] w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#2d6cdf]"
                  value={String(selected.config.text ?? "")}
                  onChange={(e) =>
                    updateSelectedNode({
                      config: { ...selected.config, text: e.target.value },
                    })
                  }
                />
              )}
              {selected.tipo === "wait" && (
                <input
                  type="number"
                  className="mt-3 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                  value={Number(selected.config.minutes ?? 0)}
                  onChange={(e) =>
                    updateSelectedNode({
                      config: {
                        ...selected.config,
                        minutes: Number(e.target.value),
                      },
                    })
                  }
                />
              )}
              {selected.tipo === "add_tag" && (
                <input
                  className="mt-3 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                  value={String(selected.config.tag ?? "")}
                  onChange={(e) =>
                    updateSelectedNode({
                      config: { ...selected.config, tag: e.target.value },
                    })
                  }
                />
              )}
            </div>
          )}

          <div className="absolute bottom-3 right-4 z-20 flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm">
            <Check className="h-3.5 w-3.5 text-emerald-600" />
            {savedAt
              ? `Salvo em ${savedAt.toLocaleDateString("pt-BR")} às ${savedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
              : "Alterações ainda não salvas"}
          </div>
        </div>
      </div>
    </div>
  );
}

export function FlowEditor({ fluxoId }: { fluxoId: string }) {
  return (
    <ReactFlowProvider>
      <FlowEditorInner fluxoId={fluxoId} />
    </ReactFlowProvider>
  );
}
