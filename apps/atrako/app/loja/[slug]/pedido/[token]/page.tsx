"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BrandThemeScope } from "@/components/brand/BrandThemeScope";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function StoreOrderStatusPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = use(params);

  const { data, refetch } = useQuery({
    queryKey: ["store-order", token],
    queryFn: async () => {
      const r = await fetch(`/api/atrako/commerce/public/orders/${token}`);
      if (!r.ok) throw new Error("fail");
      return r.json() as Promise<{
        order: {
          status: string;
          totalCents: number;
          pixQrCodeBase64: string | null;
          pixCopyPaste: string | null;
          items: { name: string; quantity: number; priceCents: number }[];
          store: { slug: string; name: string } | null;
        };
      }>;
    },
    refetchInterval: (q) => {
      const status = q.state.data?.order?.status;
      return status === "PENDING" ? 4000 : false;
    },
  });

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const order = data?.order;
  if (!order) return <p className="p-8 type-caption">Carregando pedido…</p>;

  const paid = order.status === "APPROVED" || order.status === "PAID";

  return (
    <BrandThemeScope className="min-h-dvh bg-[var(--canvas-parchment)] px-4 py-8">
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="type-tagline text-[var(--ink)]">
          {paid ? "Pedido confirmado" : "Aguardando pagamento"}
        </h1>
        <p className="type-body-strong tabular-nums">{brl(order.totalCents)}</p>
        <ul className="rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-white p-4 type-caption">
          {order.items.map((i, idx) => (
            <li key={idx} className="flex justify-between py-1">
              <span>
                {i.quantity}× {i.name}
              </span>
              <span className="tabular-nums">{brl(i.priceCents * i.quantity)}</span>
            </li>
          ))}
        </ul>

        {!paid && order.pixQrCodeBase64 ? (
          <div className="rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-white p-4 text-center">
            <p className="mb-3 type-caption text-[var(--ink-muted-48)]">Pague com Pix</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/png;base64,${order.pixQrCodeBase64}`}
              alt="QR Pix"
              className="mx-auto h-48 w-48"
            />
            {order.pixCopyPaste ? (
              <button
                type="button"
                className={cn(buttonVariants({ variant: "outline" }), "mt-3")}
                onClick={() => void navigator.clipboard.writeText(order.pixCopyPaste || "")}
              >
                Copiar código
              </button>
            ) : null}
          </div>
        ) : null}

        <Link href={`/loja/${slug}`} className={cn(buttonVariants({ variant: "primary" }), "inline-flex")}>
          Voltar à loja
        </Link>
      </div>
    </BrandThemeScope>
  );
}
