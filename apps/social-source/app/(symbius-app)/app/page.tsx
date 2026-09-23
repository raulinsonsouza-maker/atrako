import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Inbox,
  MessageSquare,
  Plug,
  Workflow,
} from "lucide-react";
import { getSession } from "@/lib/symbius/auth";
import { getOrganizationForSession } from "@/lib/symbius/tenant";
import { IgAccountProfileCard } from "@/components/symbius/IgAccountProfileCard";
import { prisma } from "@/lib/db";

export default async function SymbiusDashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const org = await getOrganizationForSession(session);
  if (!org.onboardingDone) redirect("/app/onboarding");
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
      href: "/app/connect",
    },
    {
      done: fluxosCount > 0,
      label: "Criar primeira automação",
      href: "/app/flows/new",
    },
    {
      done: inboxCount > 0,
      label: "Ver conversas na Inbox",
      href: "/app/inbox",
    },
  ];

  const quick = [
    {
      href: "/app/flows/new?template=comment_dm",
      title: "Comentário → DM",
      desc: "Keyword no post dispara Direct",
    },
    {
      href: "/app/flows/new?template=keyword_dm",
      title: "Keyword em DM",
      desc: "Resposta automática por palavra-chave",
    },
    {
      href: "/app/flows/new?template=welcome",
      title: "Boas-vindas",
      desc: "Primeira mensagem automática",
    },
  ];

  return (
    <div className="p-6 md:p-10">
      <h1 className="text-2xl font-bold">
        Olá, {session.nome.split(" ")[0]}
      </h1>
      <p className="mt-1 text-[var(--symbius-muted)]">{org.nome}</p>

      {!ig ? (
        <div className="symbius-card mt-8 border-dashed">
          <Plug className="h-10 w-10 text-[var(--symbius-primary)]" />
          <h2 className="mt-4 text-lg font-semibold">Conecte seu Instagram</h2>
          <p className="mt-2 max-w-md text-sm text-[var(--symbius-muted)]">
            Vincule sua conta Professional em poucos passos e comece a
            automatizar.
          </p>
          <Link
            href="/app/connect"
            className="symbius-btn-primary mt-6 inline-flex gap-2"
          >
            Conectar agora
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <div className="symbius-card">
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
          </div>
          <div className="symbius-card">
            <p className="text-sm text-[var(--symbius-muted)]">Canal</p>
            <p className="mt-2 text-2xl font-bold">Conectado</p>
          </div>
          <div className="symbius-card">
            <p className="text-sm text-[var(--symbius-muted)]">Contatos</p>
            <p className="mt-2 text-2xl font-bold">{contatosCount}</p>
          </div>
          <div className="symbius-card">
            <p className="text-sm text-[var(--symbius-muted)]">
              Automações LIVE
            </p>
            <p className="mt-2 text-2xl font-bold">{publishedCount}</p>
          </div>
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Comece aqui</h2>
        <p className="mt-1 text-sm text-[var(--symbius-muted)]">
          Automações rápidas para o Instagram
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {quick.map((q) => (
            <Link
              key={q.title}
              href={q.href}
              className="symbius-card transition-colors hover:bg-[var(--symbius-surface-hover)]"
            >
              <p className="font-semibold">{q.title}</p>
              <p className="mt-2 text-sm text-[var(--symbius-muted)]">{q.desc}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm text-[var(--symbius-primary)]">
                Criar <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Primeiros passos</h2>
        <ul className="mt-4 space-y-3">
          {steps.map((s) => (
            <li key={s.label}>
              <Link
                href={s.href}
                className="flex items-center gap-3 rounded-xl border border-[var(--symbius-border)] px-4 py-3 transition-colors hover:bg-[var(--symbius-surface-hover)]"
              >
                {s.done ? (
                  <CheckCircle2 className="h-5 w-5 text-[var(--symbius-accent)]" />
                ) : (
                  <Circle className="h-5 w-5 text-[var(--symbius-muted)]" />
                )}
                <span
                  className={
                    s.done
                      ? "text-[var(--symbius-muted)] line-through"
                      : "font-medium"
                  }
                >
                  {s.label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Link
          href="/app/inbox"
          className="symbius-card flex items-center gap-4 transition-colors hover:bg-[var(--symbius-surface-hover)]"
        >
          <Inbox className="h-8 w-8 text-[var(--symbius-primary)]" />
          <div>
            <p className="font-semibold">Inbox</p>
            <p className="text-sm text-[var(--symbius-muted)]">
              Conversas e respostas manuais
            </p>
          </div>
        </Link>
        <Link
          href="/app/flows"
          className="symbius-card flex items-center gap-4 transition-colors hover:bg-[var(--symbius-surface-hover)]"
        >
          <Workflow className="h-8 w-8 text-[var(--symbius-accent)]" />
          <div>
            <p className="font-semibold">Automação</p>
            <p className="text-sm text-[var(--symbius-muted)]">
              Fluxos e gatilhos
            </p>
          </div>
        </Link>
        <Link
          href="/app/contacts"
          className="symbius-card flex items-center gap-4 transition-colors hover:bg-[var(--symbius-surface-hover)] sm:col-span-2"
        >
          <MessageSquare className="h-8 w-8 text-[var(--symbius-primary)]" />
          <div>
            <p className="font-semibold">Contatos</p>
            <p className="text-sm text-[var(--symbius-muted)]">
              {contatosCount} pessoas que interagiram
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
