"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { X, MessageSquare, Calendar, Activity, Clock, Send, CheckSquare, Circle } from "lucide-react";
import {
  getLead,
  listUsers,
  updateLeadNoRedirect,
} from "@/server/actions/lead";
import { listByLead, createActivityWithCalendarSync } from "@/server/actions/activity";
import { createTask, completeTask, listTasksByLead } from "@/server/actions/task";
import { getUserCalendarConnection } from "@/server/actions/calendar";
import { getPipelineWithStages } from "@/server/actions/pipeline";
import { updateLeadStage } from "@/server/actions/pipeline";
import {
  getConversationByLeadId,
  listMessages,
  sendWhatsAppMessage,
} from "@/server/actions/conversation";
import { listMessageTemplates } from "@/server/actions/messageTemplate";
import {
  Button,
  Input,
  Badge,
} from "@/design/components";
import { LeadRevenueIndicators } from "./LeadRevenueIndicators";
import { ScheduleMeetingModal } from "./ScheduleMeetingModal";
import { OpportunitiesSection } from "./OpportunitiesSection";
import { SalesSection } from "./SalesSection";
import { LossReasonSelect } from "./LossReasonSelect";
import type { ActivityType, LeadSource, LeadStatus } from "@prisma/client";
import { clsx } from "clsx";

const SOURCE_LABELS: Record<LeadSource, string> = {
  META: "Meta",
  GOOGLE: "Google",
  WHATSAPP: "WhatsApp",
  MANUAL: "Manual",
  OUTROS: "Outros",
};

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  CALL: "Ligação",
  EMAIL: "E-mail",
  WHATSAPP: "WhatsApp",
  NOTE: "Nota",
  MEETING: "Reunião",
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "Novo",
  CONTACTED: "Contato feito",
  QUALIFIED: "Qualificado",
  PROPOSAL: "Proposta",
  NEGOTIATION: "Negociação",
  WON: "Ganho",
  LOST: "Perdido",
};

function fmtCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

type SectionId = "principal" | "oportunidades" | "vendas";

export interface LeadAdminPanelProps {
  leadId: string | null;
  tenantId: string;
  open: boolean;
  onClose: () => void;
  onLeadUpdated?: () => void;
}

export function LeadAdminPanel({
  leadId,
  tenantId,
  open,
  onClose,
  onLeadUpdated,
}: LeadAdminPanelProps) {
  const router = useRouter();
  const [lead, setLead] = useState<Awaited<ReturnType<typeof getLead>>>(null);
  const [users, setUsers] = useState<Awaited<ReturnType<typeof listUsers>>>([]);
  const [activities, setActivities] = useState<Awaited<ReturnType<typeof listByLead>>>([]);
  const [tasks, setTasks] = useState<Awaited<ReturnType<typeof listTasksByLead>>>([]);
  const [stages, setStages] = useState<NonNullable<Awaited<ReturnType<typeof getPipelineWithStages>>>["stages"]>([]);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>("principal");
  const [rightTab, setRightTab] = useState<"tarefas" | "atividades">("tarefas");
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [conv, setConv] = useState<Awaited<ReturnType<typeof getConversationByLeadId>>>(null);
  const [messages, setMessages] = useState<Awaited<ReturnType<typeof listMessages>>>([]);
  const [templates, setTemplates] = useState<Awaited<ReturnType<typeof listMessageTemplates>>>([]);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueAt, setTaskDueAt] = useState("");
  const [taskAssignedToId, setTaskAssignedToId] = useState("");
  const [taskSaving, setTaskSaving] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    try {
      const [l, u, a, t, pipe, cal] = await Promise.all([
        getLead(leadId, tenantId),
        listUsers(tenantId),
        listByLead(leadId, tenantId),
        listTasksByLead(leadId, tenantId),
        getPipelineWithStages(tenantId),
        getUserCalendarConnection(tenantId).catch(() => null),
      ]);
      setLead(l);
      setUsers(u);
      setActivities(a);
      setTasks(t);
      setStages(pipe?.stages ?? []);
      setCalendarConnected(!!cal?.calendarId);
    } catch {
      setLead(null);
    } finally {
      setLoading(false);
    }
  }, [leadId, tenantId]);

  const loadConv = useCallback(() => {
    if (!leadId) return;
    getConversationByLeadId(leadId, tenantId).then((c) => {
      setConv(c);
      if (c) listMessages(c.id, tenantId).then(setMessages);
      else setMessages([]);
    });
  }, [leadId, tenantId]);

  useEffect(() => {
    if (open && leadId) {
      load();
      loadConv();
      listMessageTemplates(tenantId).then(setTemplates);
    }
  }, [open, leadId, load, loadConv, tenantId]);

  useEffect(() => {
    if (!conv) return;
    const t = setInterval(() => listMessages(conv.id, tenantId).then(setMessages), 10000);
    return () => clearInterval(t);
  }, [conv?.id, tenantId]);

  const handleClose = () => {
    onClose();
    setLead(null);
    setActiveSection("principal");
    onLeadUpdated?.();
    router.refresh();
  };

  const handleUpdateLead = async (data: Parameters<typeof updateLeadNoRedirect>[2]) => {
    if (!leadId || !lead) return;
    setSaving(true);
    try {
      const updated = await updateLeadNoRedirect(leadId, tenantId, data);
      setLead(updated);
      onLeadUpdated?.();
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleStageChange = async (stageId: string) => {
    if (!leadId || !lead?.stageId || lead.stageId === stageId) return;
    try {
      await updateLeadStage(leadId, stageId, tenantId);
      setLead((prev) => (prev ? { ...prev, stageId, stage: stages.find((s) => s.id === stageId) ?? prev.stage } : null));
      onLeadUpdated?.();
      router.refresh();
    } catch {}
  };

  const handleActivityAdded = async () => {
    if (leadId) {
      const a = await listByLead(leadId, tenantId);
      setActivities(a);
    }
  };

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!conv || !messageText.trim() || sending) return;
    setSending(true);
    setMessageError(null);
    try {
      await sendWhatsAppMessage(tenantId, conv.id, messageText.trim());
      setMessageText("");
      listMessages(conv.id, tenantId).then(setMessages);
    } catch (err) {
      setMessageError(err instanceof Error ? err.message : "Falha ao enviar.");
    } finally {
      setSending(false);
    }
  }

  async function handleCompleteTask(id: string) {
    try {
      await completeTask(id, tenantId);
      load();
    } catch {}
  }

  const pendingTask = tasks.find((t) => !t.completedAt);

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!leadId || !taskTitle.trim()) return;
    setTaskError(null);
    setTaskSaving(true);
    try {
      await createTask(tenantId, {
        leadId,
        type: "manual",
        title: taskTitle.trim(),
        dueAt: taskDueAt ? new Date(taskDueAt) : undefined,
        assignedToId: taskAssignedToId || null,
      });
      setTaskTitle("");
      setTaskDueAt("");
      setTaskAssignedToId("");
      load();
    } catch (err) {
      setTaskError(err instanceof Error ? err.message : "Erro ao criar");
    } finally {
      setTaskSaving(false);
    }
  }

  function displayMessageContent(content: string) {
    if (/^\[[\w_-]+\]$/.test(content.trim())) return "Mensagem automática";
    return content;
  }

  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => e.key === "Escape" && handleClose();
    if (open) {
      document.addEventListener("keydown", onEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onEscape);
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const content = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lead-modal-title"
    >
      <div
        className="absolute inset-0 bg-neutral-900/50 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        className={clsx(
          "relative flex h-[90vh] max-h-[900px] w-full max-w-6xl flex-col overflow-hidden rounded-2xl",
          "bg-white shadow-2xl dark:bg-neutral-900",
          "border border-neutral-200/80 dark:border-neutral-700/80"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-5 py-3 dark:border-neutral-700">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            {loading ? (
              <div className="h-8 w-48 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
            ) : lead ? (
              <>
                <div>
                  <p className="text-xs font-medium text-neutral-400 dark:text-neutral-500">
                    Lead #{lead.id.slice(0, 8)}
                  </p>
                  <h2 id="lead-modal-title" className="truncate text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                    {lead.name}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={lead.stageId ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v) handleStageChange(v);
                    }}
                    className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
                  >
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <Badge
                    variant={
                      lead.status === "WON" ? "success" : lead.status === "LOST" ? "error" : "outline"
                    }
                  >
                    {STATUS_LABELS[lead.status as LeadStatus]}
                  </Badge>
                </div>
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {lead && (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setScheduleModalOpen(true)}
                  className="gap-1.5"
                >
                  <Calendar className="h-4 w-4" />
                  Agendar
                </Button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Main: two columns */}
        <div className="flex flex-1 min-h-0">
          {/* Left: Lead details */}
          <div className="flex w-[380px] shrink-0 flex-col border-r border-neutral-200 dark:border-neutral-700">
            <div className="flex border-b border-neutral-200 dark:border-neutral-700">
              {(["principal", "oportunidades", "vendas"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveSection(id)}
                  className={clsx(
                    "flex-1 px-4 py-3 text-sm font-medium transition-colors",
                    activeSection === id
                      ? "border-b-2 border-primary-500 text-primary-600 dark:text-primary-400"
                      : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                  )}
                >
                  {id === "principal" && "Principal"}
                  {id === "oportunidades" && "Oportunidades"}
                  {id === "vendas" && "Vendas"}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
                </div>
              ) : !lead ? (
                <p className="py-8 text-center text-neutral-500">Carregando…</p>
              ) : activeSection === "principal" ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    handleUpdateLead({
                      name: (fd.get("name") as string)?.trim() ?? "",
                      email: (fd.get("email") as string)?.trim() ?? "",
                      phone: ((fd.get("phone") as string)?.trim()) || undefined,
                      source: (fd.get("source") as LeadSource) || undefined,
                      assignedToId: (fd.get("assignedToId") as string) || null,
                      campaign: ((fd.get("campaign") as string)?.trim()) || undefined,
                      ad: ((fd.get("ad") as string)?.trim()) || undefined,
                      dealValue: (() => {
                        const v = (fd.get("dealValue") as string)?.trim();
                        if (!v) return undefined;
                        const n = Number(v.replace(",", "."));
                        return Number.isFinite(n) && n >= 0 ? n : undefined;
                      })(),
                      lossReasonId: ((fd.get("lossReasonId") as string)?.trim()) || null,
                    });
                  }}
                  className="space-y-4"
                >
                  <Input label="Nome" name="name" defaultValue={lead.name} required />
                  <Input label="E-mail" name="email" type="email" defaultValue={lead.email} required />
                  <Input label="Telefone" name="phone" type="tel" defaultValue={lead.phone ?? ""} />
                  <div>
                    <label className="mb-1 block text-sm font-medium text-neutral-600 dark:text-neutral-400">Origem</label>
                    <select
                      name="source"
                      defaultValue={lead.source}
                      className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
                    >
                      {(Object.keys(SOURCE_LABELS) as LeadSource[]).map((k) => (
                        <option key={k} value={k}>{SOURCE_LABELS[k]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-neutral-600 dark:text-neutral-400">Responsável</label>
                    <select
                      name="assignedToId"
                      defaultValue={lead.assignedToId ?? ""}
                      className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
                    >
                      <option value="">—</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                  <Input label="Campanha" name="campaign" defaultValue={(lead as { campaign?: string | null }).campaign ?? ""} placeholder="Opcional" />
                  <div>
                    <label className="mb-1 block text-sm font-medium text-neutral-600 dark:text-neutral-400">Valor do negócio (R$)</label>
                    <input
                      name="dealValue"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={lead.dealValue != null ? String(lead.dealValue) : ""}
                      className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-neutral-600 dark:text-neutral-400">Motivo da perda</label>
                    <LossReasonSelect
                      tenantId={tenantId}
                      name="lossReasonId"
                      defaultValue={(lead as { lossReasonId?: string | null }).lossReasonId ?? null}
                      className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
                    />
                  </div>
                  <Button type="submit" size="sm" isLoading={saving}>Salvar</Button>
                  <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700 mt-4">
                    <LeadRevenueIndicators leadId={lead.id} tenantId={tenantId} />
                  </div>
                </form>
              ) : activeSection === "oportunidades" ? (
                <OpportunitiesSection
                  leadId={lead.id}
                  tenantId={tenantId}
                  users={users.map((u) => ({ id: u.id, name: u.name }))}
                  variant="inline"
                />
              ) : (
                <SalesSection leadId={lead.id} tenantId={tenantId} />
              )}
            </div>
          </div>

          {/* Right: Conversation + Actions */}
          <div className="flex flex-1 flex-col min-w-0">
            {/* WhatsApp - foco principal */}
            <div className="flex shrink-0 flex-col min-h-[180px] max-h-[240px]">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-200 dark:border-neutral-700">
                <MessageSquare className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">WhatsApp</span>
              </div>
              {!conv ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-1 px-3 py-6">
                  <p className="text-xs text-neutral-500">Sem conversa. Envie mensagem pelo Atendimento.</p>
                  <a href="/dashboard/atendimento" className="text-xs font-medium text-primary-600 hover:underline">Ir para Atendimento</a>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto space-y-1.5 px-3 py-2 bg-neutral-50/80 dark:bg-neutral-800/40">
                    {messages.length === 0 ? (
                      <p className="py-3 text-center text-xs text-neutral-500">Nenhuma mensagem</p>
                    ) : (
                      messages.map((m) => (
                        <div
                          key={m.id}
                          className={clsx(
                            "max-w-[90%] rounded-lg px-2.5 py-1.5",
                            m.direction === "OUT"
                              ? "ml-auto bg-primary-100 text-primary-900 dark:bg-primary-900/40 dark:text-primary-100"
                              : "bg-white dark:bg-neutral-700 dark:text-neutral-100 shadow-sm"
                          )}
                        >
                          <p className="whitespace-pre-wrap text-sm">{displayMessageContent(m.content)}</p>
                          <p className="mt-0.5 text-[10px] opacity-60">{new Date(m.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <form onSubmit={handleSendMessage} className="flex gap-1.5 p-2 border-t border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
                    {templates.length > 0 && (
                      <select
                        className="shrink-0 w-24 rounded border border-neutral-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-600 dark:bg-neutral-800"
                        value=""
                        onChange={(e) => {
                          const t = templates.find((x) => x.id === e.target.value);
                          if (t) setMessageText(t.content);
                          e.target.value = "";
                        }}
                      >
                        <option value="">Modelo</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    )}
                    <input
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder="Digite aqui…"
                      className="flex-1 min-w-0 rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
                    />
                    <Button type="submit" size="sm" disabled={sending || !messageText.trim()} className="shrink-0">
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                  {messageError && <p className="px-3 pb-1 text-[10px] text-red-600">{messageError}</p>}
                </>
              )}
            </div>

            {/* Tarefa pendente - banner compacto */}
            {pendingTask && (
              <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-amber-200/80 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-900/15">
                <Clock className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                <span className="flex-1 truncate text-sm text-amber-900 dark:text-amber-100">{pendingTask.title}</span>
                <Button size="sm" variant="primary" onClick={() => handleCompleteTask(pendingTask.id)} className="shrink-0 text-xs">
                  Concluir
                </Button>
              </div>
            )}

            {/* Tabs: Tarefas | Atividades */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex shrink-0 border-b border-neutral-200 dark:border-neutral-700">
                <button
                  type="button"
                  onClick={() => setRightTab("tarefas")}
                  className={clsx(
                    "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors",
                    rightTab === "tarefas"
                      ? "border-b-2 border-primary-500 text-primary-600 dark:text-primary-400"
                      : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  )}
                >
                  <CheckSquare className="h-4 w-4" />
                  Tarefas
                </button>
                <button
                  type="button"
                  onClick={() => setRightTab("atividades")}
                  className={clsx(
                    "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors",
                    rightTab === "atividades"
                      ? "border-b-2 border-primary-500 text-primary-600 dark:text-primary-400"
                      : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  )}
                >
                  <Activity className="h-4 w-4" />
                  Atividades
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-3">
                {rightTab === "tarefas" ? (
                  <div className="space-y-3">
                    <form onSubmit={handleCreateTask} className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <input
                          value={taskTitle}
                          onChange={(e) => setTaskTitle(e.target.value)}
                          placeholder="Nova tarefa"
                          className="flex-1 min-w-[140px] rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800"
                        />
                        <input
                          type="date"
                          value={taskDueAt}
                          onChange={(e) => setTaskDueAt(e.target.value)}
                          className="rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800"
                        />
                        <select
                          value={taskAssignedToId}
                          onChange={(e) => setTaskAssignedToId(e.target.value)}
                          className="rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800"
                        >
                          <option value="">Responsável</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                        <Button type="submit" size="sm" isLoading={taskSaving} disabled={!taskTitle.trim()}>
                          Adicionar
                        </Button>
                      </div>
                      {taskError && <p className="text-xs text-red-600">{taskError}</p>}
                    </form>
                    <ul className="space-y-1">
                      {tasks.length === 0 ? (
                        <li className="py-4 text-center text-xs text-neutral-500">Nenhuma tarefa</li>
                      ) : (
                        tasks.map((t) => (
                          <li
                            key={t.id}
                            className={clsx(
                              "flex items-center gap-2 rounded px-2.5 py-1.5 text-sm",
                              t.completedAt ? "bg-neutral-50 dark:bg-neutral-800/50" : ""
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => !t.completedAt && handleCompleteTask(t.id)}
                              className="shrink-0 text-neutral-400 hover:text-primary-600"
                              aria-label={t.completedAt ? "Concluída" : "Concluir"}
                            >
                              {t.completedAt ? <CheckSquare className="h-4 w-4 text-primary-600" /> : <Circle className="h-4 w-4" />}
                            </button>
                            <span className={clsx("flex-1 truncate", t.completedAt && "line-through text-neutral-500")}>
                              {t.title}
                              {t.dueAt && <span className="ml-1 text-xs text-neutral-400">— {new Date(t.dueAt).toLocaleDateString("pt-BR")}</span>}
                            </span>
                            {t.assignedTo && <span className="shrink-0 text-xs text-neutral-400">{t.assignedTo.name}</span>}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                ) : lead && (
                  <div className="space-y-3">
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget);
                        await createActivityWithCalendarSync(tenantId, {
                          leadId: lead.id,
                          type: (fd.get("type") as ActivityType) || "NOTE",
                          content: ((fd.get("content") as string)?.trim()) || undefined,
                          startAt: (fd.get("startAt") as string)?.trim() ? new Date((fd.get("startAt") as string)) : undefined,
                          endAt: (fd.get("endAt") as string)?.trim() ? new Date((fd.get("endAt") as string)) : undefined,
                        });
                        handleActivityAdded();
                        e.currentTarget.reset();
                      }}
                      className="space-y-2"
                    >
                      <div className="flex flex-wrap gap-2 items-end">
                        <div className="min-w-[100px]">
                          <label className="mb-0.5 block text-[10px] font-medium text-neutral-500">Tipo</label>
                          <select
                            name="type"
                            className="w-full rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800"
                          >
                            {(Object.keys(ACTIVITY_LABELS) as ActivityType[]).map((k) => (
                              <option key={k} value={k}>{ACTIVITY_LABELS[k]}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1 min-w-[160px]">
                          <label className="mb-0.5 block text-[10px] font-medium text-neutral-500">Observação</label>
                          <input
                            name="content"
                            placeholder="O que foi feito"
                            className="w-full rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800"
                          />
                        </div>
                        <Button type="submit" size="sm">Adicionar</Button>
                      </div>
                      <div className="flex flex-wrap gap-3 text-[10px]">
                        <div>
                          <label className="text-neutral-500">Início</label>
                          <input
                            type="datetime-local"
                            name="startAt"
                            className="ml-1 rounded border border-neutral-300 bg-white px-2 py-1 text-xs dark:border-neutral-600 dark:bg-neutral-800"
                          />
                        </div>
                        <div>
                          <label className="text-neutral-500">Fim</label>
                          <input
                            type="datetime-local"
                            name="endAt"
                            className="ml-1 rounded border border-neutral-300 bg-white px-2 py-1 text-xs dark:border-neutral-600 dark:bg-neutral-800"
                          />
                        </div>
                      </div>
                    </form>
                    <ul className="space-y-1.5">
                      {activities.length === 0 ? (
                        <li className="py-3 text-center text-xs text-neutral-500">Nenhuma atividade</li>
                      ) : (
                        activities.slice(0, 12).map((a) => (
                          <li key={a.id} className="flex gap-2 border-l-2 border-neutral-200 pl-2 py-0.5 text-sm dark:border-neutral-600">
                            <span className="shrink-0 text-xs text-neutral-400 w-16">{new Date(a.createdAt).toLocaleDateString("pt-BR")}</span>
                            <span className="font-medium shrink-0">{ACTIVITY_LABELS[a.type]}</span>
                            {a.content && <span className="text-neutral-600 dark:text-neutral-400 truncate">{a.content}</span>}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {lead && (
        <ScheduleMeetingModal
          leadId={lead.id}
          leadName={lead.name}
          leadEmail={lead.email}
          open={scheduleModalOpen}
          onClose={() => setScheduleModalOpen(false)}
          isCalendarConnected={calendarConnected}
        />
      )}
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(content, document.body);
  }
  return null;
}
