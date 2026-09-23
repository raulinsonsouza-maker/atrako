import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  MessageSquare,
  Plug,
  Workflow,
} from "lucide-react";
import { getSession } from "@/lib/symbius/auth";
import { getOrganizationForSession } from "@/lib/symbius/tenant";
import { IgAccountProfileCard } from "@/components/symbius/IgAccountProfileCard";
import { prisma } from "@/lib/db-social";

export default async function SymbiusDashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const org = await getOrganizationForSession(session);
  if (!org.onboardingDone) redirect("/social/onboarding");
  const ig =
    org.igAccounts.find((a) => a.status === "CONNECTED") ??
    org.igAccounts.find((a) => a.status === "NEEDS_REAUTH") ??
    org.igAccounts[0];

  const [contatosCount, fluxosCount, publishedCount, inboxCount] =
    await Promise.all([
      prisma.igContato.count({ where: { organizationId: org.id } }),
      prisma.igFluxo.count({ where: { organizationId: org.id } }),
      prisma.igFluxo.count({
        where: { organizationId: org.id, status: "PUBLISHED" },
      }),
      prisma.igConversa.count({ where: { organizationId: org.id } }),
    ]);

  const steps = [
    {
      done: Boolean(ig),
      label: "Conectar Instagram",
      href: "/social/connect",
    },
    {
      done: fluxosCount > 0,
      label: "Criar primeira automação",
      href: "/criar/p/instagram",
    },
    {
      done: inboxCount > 0,
      label: "Ver conversas na Inbox",
      href: "/social/inbox",
    },
  ];

  const quick = [
    {
      href: "/criar/p/instagram",
      title: "Nova automação",
      desc: "Comentário, story ou keyword → DM",
      icon: MessageSquare,
    },
    {
      href: "/criar/p/instagram",
      title: "Keyword em DM",
      desc: "Resposta automática por palavra-chave",
      icon: Workflow,
    },
    {
      href: "/social/flows",
      title: "Ver fluxos",
      desc: "Gerenciar automações ativas",
      icon: Plug,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--canvas)]">
            <MessageSquare className="h-5 w-5 text-[var(--primary)]" strokeWidth={1.75} />
          </span>
          <div>
            <h1 className="type-tagline text-[var(--ink)]">Instagram</h1>
            <p className="type-caption text-[var(--ink-muted-48)]">
              Instagram, automações e inbox ·{" "}
              <Link href="/config/conexoes" className="text-[var(--primary)] hover:underline">
                Integrações
              </Link>
            </p>
          </div>
        </div>
        {ig ? (
          <span className="inline-flex items-center gap-1.5 rounded-sm bg-[var(--success)]/10 px-2.5 py-1 type-fine-print text-[var(--success)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
            @{ig.igUsername || "conectado"}
          </span>
        ) : null}
      </header>

      {!ig ? (
        <div className="utility-card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between !p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--canvas-parchment)]">
              <Plug className="h-5 w-5 text-[var(--primary)]" strokeWidth={1.75} />
            </span>
            <div>
              <h2 className="type-body-strong text-[var(--ink)]">Conecte seu Instagram</h2>
              <p className="mt-1 max-w-md type-caption text-[var(--ink-muted-48)]">
                Conta Professional em poucos passos para automatizar comentários, DMs e inbox.
              </p>
            </div>
          </div>
          <Link
            href="/social/connect"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius-xs)] bg-[var(--primary)] px-[22px] py-2.5 type-button-utility text-[var(--on-primary)] transition active:scale-95"
          >
            Conectar agora
            <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="utility-card !p-4 sm:col-span-2 lg:col-span-1">
            <IgAccountProfileCard
              compact
              account={{
                id: ig.id,
                igUserId: ig.igUserId,
                igUsername: ig.igUsername,
                igProfilePictureUrl: ig.igProfilePictureUrl,
                status: ig.status,
                messagesEnabled: ig.messagesEnabled,
              }}
            />
          </div>
          <div className="utility-card !p-4">
            <p className="type-caption text-[var(--ink-muted-48)]">Contatos</p>
            <p className="mt-1 type-tagline tabular-nums text-[var(--ink)]">{contatosCount}</p>
          </div>
          <div className="utility-card !p-4">
            <p className="type-caption text-[var(--ink-muted-48)]">Automações LIVE</p>
            <p className="mt-1 type-tagline tabular-nums text-[var(--ink)]">{publishedCount}</p>
          </div>
          <div className="utility-card !p-4">
            <p className="type-caption text-[var(--ink-muted-48)]">Conversas</p>
            <p className="mt-1 type-tagline tabular-nums text-[var(--ink)]">{inboxCount}</p>
          </div>
        </div>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="type-body-strong text-[var(--ink)]">Comece aqui</h2>
          <p className="mt-0.5 type-caption text-[var(--ink-muted-48)]">
            Automações rápidas para o Instagram
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {quick.map((q) => {
            const Icon = q.icon;
            return (
              <Link
                key={q.title}
                href={q.href}
                className="utility-card group !p-4 transition hover:bg-[var(--surface-pearl)] active:scale-[0.99]"
              >
                <Icon className="h-5 w-5 text-[var(--ink-muted-80)]" strokeWidth={1.75} />
                <p className="mt-3 type-caption-strong text-[var(--ink)]">{q.title}</p>
                <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">{q.desc}</p>
                <span className="mt-3 inline-flex items-center gap-1 type-fine-print text-[var(--primary)]">
                  Criar
                  <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-[var(--hairline)] bg-[var(--canvas)]">
        <div className="border-b border-[var(--hairline)] px-4 py-3">
          <h2 className="type-body-strong text-[var(--ink)]">Primeiros passos</h2>
        </div>
        <ul className="divide-y divide-[var(--divider-soft)]">
          {steps.map((s) => (
            <li key={s.label}>
              <Link
                href={s.href}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-[var(--surface-pearl)] active:scale-[0.99]"
              >
                {s.done ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--success)]" strokeWidth={1.75} />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-[var(--ink-muted-48)]" strokeWidth={1.75} />
                )}
                <span
                  className={
                    s.done
                      ? "type-caption text-[var(--ink-muted-48)] line-through"
                      : "type-caption-strong text-[var(--ink)]"
                  }
                >
                  {s.label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
