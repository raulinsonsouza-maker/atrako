"use client";

import { useState, useEffect, useCallback } from "react";
import {
  listOpportunitiesByLead,
  createOpportunity,
  updateNegotiation,
  setWon,
  setLost,
} from "@/server/actions/opportunity";
import { Button, Input, Card, CardHeader, CardTitle, CardContent, Badge, Modal } from "@/design/components";
import { Briefcase, Trophy, XCircle } from "lucide-react";
import { LossReasonSelect } from "./LossReasonSelect";

function fmtCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

type Opp = Awaited<ReturnType<typeof listOpportunitiesByLead>>[number];

export function OpportunitiesSection({
  leadId,
  tenantId,
  users,
  variant = "card",
}: {
  leadId: string;
  tenantId: string;
  users: { id: string; name: string }[];
  variant?: "card" | "inline";
}) {
  const [opps, setOpps] = useState<Opp[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lossModal, setLossModal] = useState<{ id: string } | null>(null);
  const [lossReasonId, setLossReasonId] = useState<string>("");
  const [edit, setEdit] = useState<{
    id: string;
    name: string;
    value: string;
    expectedCloseAt: string;
    assignedToId: string;
    campaign: string;
    productOrService: string;
  } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [expectedCloseAt, setExpectedCloseAt] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [campaign, setCampaign] = useState("");
  const [productOrService, setProductOrService] = useState("");

  const load = useCallback(() => {
    listOpportunitiesByLead(leadId, tenantId).then(setOpps).finally(() => setLoading(false));
  }, [leadId, tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = parseFloat(value);
    if (!name.trim() || isNaN(v) || v < 0) return;
    setError(null);
    setSaving(true);
    try {
      await createOpportunity(tenantId, {
        leadId,
        name: name.trim(),
        value: v,
        expectedCloseAt: expectedCloseAt ? new Date(expectedCloseAt) : undefined,
        assignedToId: assignedToId || undefined,
        campaign: campaign.trim() || undefined,
        productOrService: productOrService.trim() || undefined,
      });
      setName("");
      setValue("");
      setExpectedCloseAt("");
      setAssignedToId("");
      setCampaign("");
      setProductOrService("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar");
    } finally {
      setSaving(false);
    }
  }

  async function onWon(id: string) {
    setError(null);
    try {
      await setWon(id, tenantId);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao marcar como ganha");
    }
  }

  async function onLost(id: string, reasonId?: string) {
    setError(null);
    setLossModal(null);
    setLossReasonId("");
    try {
      await setLost(id, tenantId, { lossReasonId: reasonId || undefined });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao marcar como perdida");
    }
  }

  if (loading) return <p className="text-neutral-500">Carregando oportunidades…</p>;

  const openOpps = opps.filter((o) => o.status === "OPEN");
  const closedOpps = opps.filter((o) => o.status !== "OPEN");

  const content = (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Venda plano anual"
            required
          />
          <Input
            label="Valor (R$)"
            type="number"
            step="0.01"
            min="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0,00"
            required
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Previsão de fechamento
            </label>
            <input
              type="date"
              value={expectedCloseAt}
              onChange={(e) => setExpectedCloseAt(e.target.value)}
              className="w-full rounded-sm border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Responsável</label>
            <select
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
              className="w-full rounded-sm border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
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
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Campanha"
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            placeholder="Opcional"
          />
          <Input
            label="Produto/Serviço"
            value={productOrService}
            onChange={(e) => setProductOrService(e.target.value)}
            placeholder="Opcional"
          />
        </div>
        <Button type="submit" size="sm" isLoading={saving}>
          Nova negociação
        </Button>
      </form>

      {error && <p className="text-sm text-error-600">{error}</p>}

      <div className="border-t border-neutral-200 pt-4 dark:border-neutral-700">
        <h4 className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">Em negociação</h4>
        {openOpps.length === 0 ? (
          <p className="text-sm text-neutral-500">Nenhuma negociação aberta.</p>
        ) : (
          <ul className="space-y-2">
            {openOpps.map((o) => (
              <li
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-neutral-200 px-3 py-2 dark:border-neutral-700"
              >
                <div className="min-w-0">
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">{o.name}</span>
                  <span className="ml-2 text-sm text-neutral-600 dark:text-neutral-400">
                    {fmtCurrency(Number(o.value))} · {o.stage.name}
                  </span>
                  {o.assignedTo && <span className="ml-2 text-xs text-neutral-500">— {o.assignedTo.name}</span>}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-success-600 hover:bg-success-50 hover:text-success-700 dark:hover:bg-success-900/30"
                    onClick={() => onWon(o.id)}
                  >
                    <Trophy className="mr-1 h-3 w-3" />
                    Ganhar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setEdit({
                        id: o.id,
                        name: o.name ?? "",
                        value: String(o.value ?? ""),
                        expectedCloseAt: o.expectedCloseAt ? new Date(o.expectedCloseAt).toISOString().slice(0, 10) : "",
                        assignedToId: o.assignedTo?.id ?? "",
                        campaign: o.campaign ?? "",
                        productOrService: o.productOrService ?? "",
                      })
                    }
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-error-600 hover:bg-error-50 hover:text-error-700 dark:hover:bg-error-900/30"
                    onClick={() => setLossModal({ id: o.id })}
                  >
                    <XCircle className="mr-1 h-3 w-3" />
                    Perder
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {closedOpps.length > 0 && (
        <div className="border-t border-neutral-200 pt-4 dark:border-neutral-700">
          <h4 className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">Encerradas</h4>
          <ul className="space-y-2">
            {closedOpps.map((o) => (
              <li
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-neutral-100 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800/50"
              >
                <span className="font-medium text-neutral-700 dark:text-neutral-300">{o.name}</span>
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  {fmtCurrency(Number(o.value))} · {o.stage.name}
                </span>
                <Badge variant={o.status === "WON" ? "success" : "error"}>
                  {o.status === "WON" ? "Ganha" : "Perdida"}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setEdit({
                      id: o.id,
                      name: o.name ?? "",
                      value: String(o.value ?? ""),
                      expectedCloseAt: o.expectedCloseAt ? new Date(o.expectedCloseAt).toISOString().slice(0, 10) : "",
                      assignedToId: o.assignedTo?.id ?? "",
                      campaign: o.campaign ?? "",
                      productOrService: o.productOrService ?? "",
                    })
                  }
                >
                  Editar
                </Button>
                {o.status === "LOST" && o.lossReason && (
                  <span className="w-full text-xs text-neutral-500">Motivo: {o.lossReason}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  return (
    <>
      {variant === "card" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Negociações
            </CardTitle>
          </CardHeader>
          <CardContent>{content}</CardContent>
        </Card>
      ) : (
        content
      )}

      <Modal
        open={!!lossModal}
        onClose={() => {
          setLossModal(null);
          setLossReasonId("");
        }}
        title="Marcar como perdida"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setLossModal(null);
                setLossReasonId("");
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="outline"
              className="text-error-600"
              onClick={() => lossModal && onLost(lossModal.id, lossReasonId)}
            >
              Confirmar perda
            </Button>
          </div>
        }
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Motivo da perda (opcional)
          </label>
          <LossReasonSelect
            tenantId={tenantId}
            name="lossReasonId"
            value={lossReasonId}
            onChange={(e) => setLossReasonId(e.target.value)}
            className="w-full rounded-sm border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
          />
        </div>
      </Modal>

      <Modal
        open={!!edit}
        onClose={() => {
          if (savingEdit) return;
          setEdit(null);
          setEditError(null);
        }}
        title="Editar negociação"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEdit(null)}>
              Cancelar
            </Button>
            <Button
              isLoading={savingEdit}
              onClick={async () => {
                if (!edit) return;
                setSavingEdit(true);
                setEditError(null);
                try {
                  const normalized = edit.value.includes(",")
                    ? edit.value.replace(/\./g, "").replace(",", ".")
                    : edit.value;
                  const value = Number(normalized);
                  await updateNegotiation(tenantId, {
                    opportunityId: edit.id,
                    name: edit.name.trim() || undefined,
                    value: Number.isFinite(value) ? value : undefined,
                    expectedCloseAt: edit.expectedCloseAt ? new Date(edit.expectedCloseAt) : null,
                    assignedToId: edit.assignedToId || null,
                    campaign: edit.campaign.trim() || null,
                    productOrService: edit.productOrService.trim() || null,
                  });
                  setEdit(null);
                  load();
                } catch (err) {
                  setEditError(err instanceof Error ? err.message : "Erro ao atualizar negociação.");
                } finally {
                  setSavingEdit(false);
                }
              }}
            >
              Salvar
            </Button>
          </div>
        }
        size="sm"
      >
        {edit && (
          <div className="space-y-3">
            <Input
              label="Nome"
              value={edit.name}
              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              required
            />
            <Input
              label="Valor (R$)"
              value={edit.value}
              onChange={(e) => setEdit({ ...edit, value: e.target.value })}
              type="number"
            />
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Previsão de fechamento
              </label>
              <input
                type="date"
                value={edit.expectedCloseAt}
                onChange={(e) => setEdit({ ...edit, expectedCloseAt: e.target.value })}
                className="w-full rounded-sm border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Responsável</label>
              <select
                value={edit.assignedToId}
                onChange={(e) => setEdit({ ...edit, assignedToId: e.target.value })}
                className="w-full rounded-sm border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
              >
                <option value="">—</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Campanha"
              value={edit.campaign}
              onChange={(e) => setEdit({ ...edit, campaign: e.target.value })}
            />
            <Input
              label="Produto/Serviço"
              value={edit.productOrService}
              onChange={(e) => setEdit({ ...edit, productOrService: e.target.value })}
            />
            {editError && <p className="text-sm text-error-600">{editError}</p>}
          </div>
        )}
      </Modal>
    </>
  );
}
