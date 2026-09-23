import Link from "next/link";
import {
  ArrowRight,
  MessageCircle,
  Sparkles,
  Workflow,
  Zap,
} from "lucide-react";

export default function LandingPage() {
  return (
    <main>
      <section className="relative overflow-hidden px-4 py-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(124,92,255,0.18),_transparent_60%)]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--symbius-border)] px-4 py-1 text-sm text-[var(--symbius-muted)]">
            <Sparkles className="h-4 w-4 text-[var(--symbius-accent)]" />
            Automações Instagram profissionais
          </p>
          <h1 className="text-4xl font-bold leading-tight sm:text-6xl">
            Automatize DMs e comentários com{" "}
            <span className="symbius-gradient-text">Symbius Flow</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--symbius-muted)]">
            Conecte sua conta Instagram Professional, crie fluxos visuais e
            converta comentários em conversas — tudo com inbox humana integrada.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/signup" className="symbius-btn-primary gap-2">
              Criar conta grátis
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/login" className="symbius-btn-outline">
              Já tenho conta
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="symbius-card overflow-hidden p-0">
          <div className="grid gap-0 md:grid-cols-2">
            <div className="border-b border-[var(--symbius-border)] p-8 md:border-b-0 md:border-r">
              <p className="text-sm text-[var(--symbius-muted)]">Builder visual</p>
              <div className="mt-4 space-y-3">
                {["Trigger: keyword", "Enviar DM", "Aguardar 2h", "Tag: interessado"].map(
                  (step, i) => (
                    <div
                      key={step}
                      className="flex items-center gap-3 rounded-xl border border-[var(--symbius-border)] bg-[var(--symbius-bg)] p-3"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--symbius-primary)]/20 text-sm font-bold text-[var(--symbius-primary)]">
                        {i + 1}
                      </span>
                      {step}
                    </div>
                  ),
                )}
              </div>
            </div>
            <div className="p-8">
              <p className="text-sm text-[var(--symbius-muted)]">Inbox unificada</p>
              <div className="mt-4 space-y-2">
                {[
                  { user: "@maria.c", msg: "Quero saber o preço!" },
                  { user: "@joao.dev", msg: "LINK" },
                  { user: "@ana.fit", msg: "Comentei no post 🔥" },
                ].map((c) => (
                  <div
                    key={c.user}
                    className="rounded-xl border border-[var(--symbius-border)] bg-[var(--symbius-bg)] p-3"
                  >
                    <p className="text-sm font-medium">{c.user}</p>
                    <p className="text-sm text-[var(--symbius-muted)]">{c.msg}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold">Tudo que você precisa</h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: MessageCircle, title: "Comentário → DM", desc: "Palavra-chave no post vira conversa privada automaticamente." },
            { icon: Zap, title: "Keywords em DM", desc: "Respostas instantâneas quando alguém manda a palavra certa." },
            { icon: Workflow, title: "Fluxos visuais", desc: "Arraste, conecte e publique automações sem código." },
            { icon: Sparkles, title: "Inbox humana", desc: "Assuma a conversa quando precisar de toque humano." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="symbius-card">
              <Icon className="h-8 w-8 text-[var(--symbius-primary)]" />
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-[var(--symbius-muted)]">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold">Como conectar</h2>
        <ol className="mt-10 space-y-6">
          {[
            "Tenha uma conta Instagram Professional (Business ou Creator)",
            "Vincule a uma Página do Facebook que você administra",
            "Conecte pelo Symbius Flow em poucos cliques — igual ManyChat",
          ].map((text, i) => (
            <li key={text} className="flex gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--symbius-primary)] font-bold">
                {i + 1}
              </span>
              <p className="pt-2 text-[var(--symbius-muted)]">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold">FAQ</h2>
        <div className="mt-8 space-y-4">
          {[
            {
              q: "Preciso de conta Business?",
              a: "Sim. Contas pessoais não funcionam com a API oficial da Meta.",
            },
            {
              q: "Posso enviar mensagem a qualquer hora?",
              a: "Automações funcionam dentro da janela de 24h após interação do usuário.",
            },
            {
              q: "Substitui o ManyChat?",
              a: "Para Instagram DMs, comentários e fluxos visuais — sim, com foco em simplicidade.",
            },
          ].map(({ q, a }) => (
            <details key={q} className="symbius-card group">
              <summary className="cursor-pointer font-medium">{q}</summary>
              <p className="mt-3 text-sm text-[var(--symbius-muted)]">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="border-t border-[var(--symbius-border)] px-4 py-16 text-center">
        <h2 className="text-2xl font-bold">Pronto para automatizar?</h2>
        <Link href="/signup" className="symbius-btn-primary mt-6 inline-flex gap-2">
          Começar grátis
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </main>
  );
}
