import { notFound } from "next/navigation";
import { getDashboardContext } from "@/lib/dashboard-context";
import { getLead, updateLeadFromForm, listUsers } from "@/server/actions/lead";
import { listByLead, createActivityFromForm } from "@/server/actions/activity";
import { getUserCalendarConnection } from "@/server/actions/calendar";
import { listLossReasons } from "@/server/actions/lossReason";
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from "@/design/components";
import { TasksSection } from "@/components/features/TasksSection";
import { LeadRevenueIndicators } from "@/components/features/LeadRevenueIndicators";
import { SalesSection } from "@/components/features/SalesSection";
import { OpportunitiesSection } from "@/components/features/OpportunitiesSection";
import { LeadConversationBlock } from "@/components/features/LeadConversationBlock";
import { LeadDetailHeader } from "@/components/features/LeadDetailHeader";
import { LeadTagsSelector } from "@/components/features/LeadTagsSelector";
import { LeadCustomFields } from "@/components/features/LeadCustomFields";
import type { ActivityType, LeadSource, LeadStatus } from "@prisma/client";

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

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenantId } = await getDashboardContext();

  const [lead, users, activities, calendarConnection, lossReasons] = await Promise.all([
    getLead(id, tenantId),
    listUsers(tenantId),
    listByLead(id, tenantId),
    getUserCalendarConnection(tenantId).catch(() => null),
    listLossReasons(tenantId).catch(() => []),
  ]);

  if (!lead) notFound();

  const dealValue = lead.dealValue != null ? fmtCurrency(Number(lead.dealValue)) : null;
  const statusLabel = STATUS_LABELS[lead.status as LeadStatus] ?? lead.status;
  const isCalendarConnected = !!calendarConnection?.calendarId;

  return (
    <div className="space-y-6">
      <LeadDetailHeader
        lead={{
          id: lead.id,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          assignedTo: lead.assignedTo,
          stage: lead.stage,
          status: lead.status,
          dealValue: lead.dealValue != null ? Number(lead.dealValue) : null,
        }}
        statusLabel={statusLabel}
        dealValueFormatted={dealValue}
        isCalendarConnected={isCalendarConnected}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <LeadConversationBlock leadId={id} tenantId={tenantId} />
          <LeadRevenueIndicators leadId={id} tenantId={tenantId} />

          <Card>
            <CardHeader>
              <CardTitle>Atividades</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form action={createActivityFromForm} className="space-y-3">
                <input type="hidden" name="leadId" value={id} />
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Tipo</label>
                  <select
                    name="type"
                    className="w-full rounded-sm border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
                  >
                    {(Object.keys(ACTIVITY_LABELS) as ActivityType[]).map((k) => (
                      <option key={k} value={k}>
                        {ACTIVITY_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      Início (reunião)
                    </label>
                    <input
                      type="datetime-local"
                      name="startAt"
                      className="w-full rounded-sm border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      Fim (reunião)
                    </label>
                    <input
                      type="datetime-local"
                      name="endAt"
                      className="w-full rounded-sm border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Observação</label>
                  <textarea
                    name="content"
                    rows={2}
                    className="w-full rounded-sm border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
                  />
                </div>
                <Button type="submit">Adicionar</Button>
              </form>
              <div className="border-t border-neutral-200 pt-4 dark:border-neutral-700">
                <h4 className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">Histórico</h4>
                {activities.length === 0 ? (
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Nenhuma atividade.</p>
                ) : (
                  <ul className="space-y-3">
                    {activities.map((a) => (
                      <li key={a.id} className="flex gap-3 border-l-2 border-neutral-200 pl-3 dark:border-neutral-600">
                        <span className="shrink-0 text-xs text-neutral-400">
                          {new Date(a.createdAt).toLocaleString("pt-BR")}
                        </span>
                        <div>
                          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                            {ACTIVITY_LABELS[a.type]}
                            {a.user ? ` — ${a.user.name}` : ""}
                          </span>
                          {a.content && <p className="text-sm text-neutral-600 dark:text-neutral-400">{a.content}</p>}
                          {(a.startAt || a.endAt) && (
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                              {a.startAt ? `Início: ${new Date(a.startAt).toLocaleString("pt-BR")}` : "Início: —"}
                              {a.endAt ? ` · Fim: ${new Date(a.endAt).toLocaleString("pt-BR")}` : ""}
                            </p>
                          )}
                          {a.calendarEvent?.googleEventId && (
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                              Sincronizado com Google Calendar
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>

          <OpportunitiesSection leadId={id} tenantId={tenantId} users={users.map((u) => ({ id: u.id, name: u.name }))} />

          <SalesSection leadId={id} tenantId={tenantId} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contato</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={updateLeadFromForm} className="space-y-4">
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="source" value={lead.source} />
                <input type="hidden" name="assignedToId" value={lead.assignedToId ?? ""} />
                <input type="hidden" name="campaign" value={(lead as { campaign?: string | null }).campaign ?? ""} />
                <input type="hidden" name="ad" value={(lead as { ad?: string | null }).ad ?? ""} />
                <input type="hidden" name="lossReason" value={(lead as { lossReason?: string | null }).lossReason ?? ""} />
                <input
                  type="hidden"
                  name="dealValue"
                  value={(lead as { dealValue?: unknown }).dealValue != null ? String((lead as { dealValue?: unknown }).dealValue) : ""}
                />
                <Input label="Nome" name="name" defaultValue={lead.name} required />
                <Input label="E-mail" name="email" type="email" defaultValue={lead.email} required />
                <Input label="Telefone" name="phone" type="tel" defaultValue={lead.phone ?? ""} />
                <Button type="submit">Salvar</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tags</CardTitle>
            </CardHeader>
            <CardContent>
              <LeadTagsSelector leadId={id} tenantId={tenantId} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Campos Personalizados</CardTitle>
            </CardHeader>
            <CardContent>
              <LeadCustomFields leadId={id} tenantId={tenantId} />
            </CardContent>
          </Card>

          <TasksSection leadId={id} tenantId={tenantId} users={users.map((u) => ({ id: u.id, name: u.name }))} />

          <Card>
            <CardHeader>
              <CardTitle>Detalhes do lead</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={updateLeadFromForm} className="space-y-4">
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="name" value={lead.name} />
                <input type="hidden" name="email" value={lead.email} />
                <input type="hidden" name="phone" value={lead.phone ?? ""} />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  <Input
                    label="Campanha"
                    name="campaign"
                    defaultValue={(lead as { campaign?: string | null }).campaign ?? ""}
                    placeholder="ex: black-friday"
                  />
                  <Input
                    label="Anúncio"
                    name="ad"
                    defaultValue={(lead as { ad?: string | null }).ad ?? ""}
                    placeholder="ex: anúncio-1"
                  />
                  <div>
                    <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Valor do negócio (R$)</label>
                    <input
                      name="dealValue"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={(lead as { dealValue?: unknown }).dealValue != null ? String((lead as { dealValue?: unknown }).dealValue) : ""}
                      className="w-full rounded-sm border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Origem</label>
                    <select
                      name="source"
                      className="w-full rounded-sm border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
                      defaultValue={lead.source}
                    >
                      {(Object.keys(SOURCE_LABELS) as LeadSource[]).map((k) => (
                        <option key={k} value={k}>
                          {SOURCE_LABELS[k]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Responsável</label>
                    <select
                      name="assignedToId"
                      className="w-full rounded-sm border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
                      defaultValue={lead.assignedToId ?? ""}
                    >
                      <option value="">—</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Motivo da perda (se perdido)</label>
                  <select
                    name="lossReasonId"
                    defaultValue={(lead as { lossReasonId?: string | null }).lossReasonId ?? ""}
                    className="w-full rounded-sm border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
                  >
                    <option value="">Selecione um motivo...</option>
                    {lossReasons.map((reason) => (
                      <option key={reason.id} value={reason.id}>
                        {reason.name}
                      </option>
                    ))}
                  </select>
                  {lossReasons.length === 0 && (
                    <p className="mt-1 text-xs text-neutral-500">
                      Nenhum motivo cadastrado. Configure em{" "}
                      <a href="/dashboard/configuracoes" className="text-primary-600 hover:underline">
                        Configurações
                      </a>
                      .
                    </p>
                  )}
                </div>
                <Button type="submit">Salvar detalhes</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
