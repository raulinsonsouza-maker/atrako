"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpRight, BarChart3 } from "lucide-react";

export interface ClienteCardData {
  id: string;
  nome: string;
  slug: string;
  logoUrl: string | null;
  segmento: string | null;
  segmentoCor?: string | null;
  totalLeads: number;
  conversao: number;
  totalCliques?: number;
  ativo?: boolean;
  squad?: number | null;
  hasGoogleConta?: boolean;
  hasMetaConta?: boolean;
}

export function ClienteCard({ cliente }: { cliente: ClienteCardData }) {
  const initials = cliente.nome
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <Link href={`/clientes/${cliente.id}`} className="block group">
      <Card className="card-hover relative h-full overflow-hidden rounded-2xl border-[var(--border)]">
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[var(--primary)] opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-[0.06]" />

        <CardContent className="flex h-full flex-col gap-5 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--muted)] to-[var(--border)] text-sm font-bold text-[var(--muted-foreground)]">
                {initials}
              </div>
              {cliente.segmento?.trim() && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white"
                  style={{ backgroundColor: cliente.segmentoCor ?? "var(--badge-digital)" }}
                >
                  <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.6)" }} />
                  {cliente.segmento.trim()}
                </span>
              )}
              {cliente.squad && (
                <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--muted)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                  S{cliente.squad}
                </span>
              )}
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-all group-hover:bg-[var(--primary)]/10 group-hover:text-[var(--primary)]">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>

          <div className="flex-1">
            <h3 className="text-lg font-bold leading-tight text-[var(--foreground)]">
              {cliente.nome}
            </h3>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">Unidade de negócio</p>
          </div>

          <div className="flex items-center justify-between border-t border-[var(--border)] pt-4">
            <div className="flex items-center gap-1.5">
              <BarChart3 className="h-3 w-3 text-[var(--muted-foreground)]" />
              <span className="text-[10px] font-medium text-[var(--muted-foreground)]">Ativo</span>
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] transition-colors group-hover:text-[var(--primary)]">
              Ver diagnóstico →
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
