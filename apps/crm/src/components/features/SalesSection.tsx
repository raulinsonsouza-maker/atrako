"use client";

import { useState, useEffect, useCallback } from "react";
import { listSalesByLead, updateSale } from "@/server/actions/opportunity";
import { Button, Card, CardHeader, CardTitle, CardContent, Input, Modal } from "@/design/components";
import { Receipt } from "lucide-react";

function fmtCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export function SalesSection({ leadId, tenantId }: { leadId: string; tenantId: string }) {
  const [sales, setSales] = useState<Awaited<ReturnType<typeof listSalesByLead>>>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<{
    id: string;
    amount: string;
    soldAt: string;
    assignedToId: string;
    productOrService: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listSalesByLead(leadId, tenantId).then(setSales).finally(() => setLoading(false));
  }, [leadId, tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="text-neutral-500">Carregando vendas…</p>;

  return (
    <>
      <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-4 w-4" />
          Histórico de vendas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sales.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Nenhuma venda registrada.</p>
        ) : (
          <ul className="space-y-3">
            {sales.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-neutral-200 px-3 py-2 dark:border-neutral-700"
              >
                <div>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    {fmtCurrency(Number(s.amount))}
                  </span>
                  {s.productOrService && (
                    <span className="ml-2 text-sm text-neutral-600 dark:text-neutral-400">
                      — {s.productOrService}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm text-neutral-500 dark:text-neutral-400">
                  <span>{new Date(s.soldAt).toLocaleDateString("pt-BR")}</span>
                  {s.assignedTo && <span>{s.assignedTo.name}</span>}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setEdit({
                        id: s.id,
                        amount: String(s.amount ?? ""),
                        soldAt: s.soldAt ? new Date(s.soldAt).toISOString().slice(0, 10) : "",
                        assignedToId: s.assignedTo?.id ?? "",
                        productOrService: s.productOrService ?? "",
                      })
                    }
                  >
                    Editar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>

    <Modal
      open={!!edit}
      onClose={() => {
        if (saving) return;
        setEdit(null);
        setError(null);
      }}
      title="Editar venda"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setEdit(null)}>
            Cancelar
          </Button>
          <Button
            isLoading={saving}
            onClick={async () => {
              if (!edit) return;
              setSaving(true);
              setError(null);
              try {
                const normalized = edit.amount.includes(",")
                  ? edit.amount.replace(/\./g, "").replace(",", ".")
                  : edit.amount;
                const amount = Number(normalized);
                await updateSale(tenantId, {
                  saleId: edit.id,
                  amount: Number.isFinite(amount) ? amount : undefined,
                  soldAt: edit.soldAt ? new Date(edit.soldAt) : undefined,
                  assignedToId: edit.assignedToId || undefined,
                  productOrService: edit.productOrService || undefined,
                });
                setEdit(null);
                load();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Erro ao atualizar venda.");
              } finally {
                setSaving(false);
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
            label="Valor (R$)"
            value={edit.amount}
            onChange={(e) => setEdit({ ...edit, amount: e.target.value })}
            type="number"
          />
          <Input
            label="Produto/Serviço"
            value={edit.productOrService}
            onChange={(e) => setEdit({ ...edit, productOrService: e.target.value })}
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Data da venda</label>
            <input
              type="date"
              value={edit.soldAt}
              onChange={(e) => setEdit({ ...edit, soldAt: e.target.value })}
              className="w-full rounded-sm border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
            />
          </div>
          {error && <p className="text-sm text-error-600">{error}</p>}
        </div>
      )}
    </Modal>
    </>
  );
}
