import type { Metadata } from "next";
import {
  ArrowUpRight,
  Banknote,
  Check,
  ClipboardList,
  LineChart,
  MessageSquare,
  Search,
  Shield,
  TrendingUp,
} from "lucide-react";
import ConsultoriaLeadForm from "./consultoria-lead-form";

export const metadata: Metadata = {
  title: "Vilaris | Consultoria Financeira para PME",
  description:
    "Fatura sobe e o caixa não acompanha? Consultoria financeira para PME: estancar sangrias, organizar margem e decidir com número. Conversa sem compromisso.",
};

const ASSET = "/lp/vilaris/assets";

const pains = [
  {
    icon: Banknote,
    title: "Fatura alto. Caixa apertado.",
    text: "Entra dinheiro todo mês — e no fim sobra dúvida, não sobra caixa.",
  },
  {
    icon: LineChart,
    title: "Margem invisível",
    text: "Você não sabe o que dá lucro de verdade: produto, cliente ou canal.",
  },
  {
    icon: Shield,
    title: "Dívida cara sem mapa",
    text: "Renegocia no feeling, sem dossiê, CET nem prioridade clara.",
  },
  {
    icon: ClipboardList,
    title: "BPO lança. Ninguém governa.",
    text: "Contabilidade executa — falta plano gerencial e regra de categorização.",
  },
] as const;

const results = [
  {
    num: "01",
    title: "Caixa previsível",
    text: "Fluxo semanal e mensal para ver o buraco antes de cair nele.",
  },
  {
    num: "02",
    title: "Margem por produto",
    text: "Sabe o que paga a conta — e o que só ocupa a operação.",
  },
  {
    num: "03",
    title: "Rotina que a equipe segue",
    text: "Fechamento, crédito e cobrança com regra, não com improviso.",
  },
  {
    num: "04",
    title: "Decisão com número",
    text: "Crédito, investimento e retirada de sócio com lastro.",
  },
] as const;

const plans = [
  {
    months: "3",
    name: "Saneamento",
    hook: "Estancar o sangramento",
    forWho: "Caixa descontrolado, dívida cara ou crise aguda.",
    gets: ["Diagnóstico 360º", "Mapa de dívidas", "Fluxo e budget", "Primeira DRE gerencial"],
  },
  {
    months: "6",
    name: "Estruturação",
    hook: "Organizar para sobrar",
    forWho: "Fatura bem, mas não vê a cor do dinheiro.",
    gets: ["Tudo do plano 3 meses", "Precificação e markup", "Produtividade da equipe", "Capital de giro"],
    featured: true,
  },
  {
    months: "12",
    name: "Governança",
    hook: "Escalar com método",
    forWho: "Expansão, captação e caixa excedente.",
    gets: ["Tudo dos planos anteriores", "Orçamento e CAPEX", "Valuation", "Rituais de conselho"],
  },
] as const;

const steps = [
  {
    n: "1",
    icon: MessageSquare,
    title: "Conversa",
    text: "Você conta o momento da empresa. Sem pitch de 40 minutos.",
  },
  {
    n: "2",
    icon: Search,
    title: "Diagnóstico",
    text: "Caixa, dívida e margem com os extratos e o ERP — não com achismo.",
  },
  {
    n: "3",
    icon: TrendingUp,
    title: "Plano em ritmo",
    text: "3, 6 ou 12 meses. Encontros + canal direto para decisões críticas.",
  },
] as const;

const faq = [
  {
    q: "Preciso trocar de contador ou BPO?",
    a: "Não. Eles continuam lançando. A Vilaris define o plano de contas gerencial e as regras; o fornecedor executa.",
  },
  {
    q: "Quantos encontros por mês?",
    a: "Nos primeiros 3 meses: 2 encontros (1h30–2h). Depois: 1 a 2, focados em governança e fechamento. Canal assíncrono no dia a dia.",
  },
  {
    q: "Quanto custa?",
    a: "Depende do porte e do horizonte. Alinhamos na conversa — sem preço engessado na página.",
  },
  {
    q: "Serve para qual tamanho de empresa?",
    a: "PMEs que já faturam e precisam de controle, margem e caixa — do saneamento à governança.",
  },
] as const;

function CTA({
  children = "Quero conversar agora",
  className = "button",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <a className={className} href="#conversa">
      {children}
      <ArrowUpRight size={20} aria-hidden="true" />
    </a>
  );
}

function Brand() {
  return (
    <a href="/consultoria" className="brand" aria-label="Vilaris Consultoria — início">
      <img
        src={`${ASSET}/vilaris-logo.png`}
        alt="Vilaris — Gestão e Estratégia"
        width="3376"
        height="1082"
      />
    </a>
  );
}

export default function VilarisConsultoriaPage() {
  return (
    <div className="consultoria-lp">
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <header className="header">
        <div className="container header-inner">
          <Brand />
          <a href="#conversa" className="header-cta">
            Conversar <ArrowUpRight size={16} />
          </a>
        </div>
      </header>

      <main id="conteudo">
        <section className="cv-hero container" id="inicio">
          <p className="cv-eyebrow">
            <span className="status-dot" />
            CONSULTORIA FINANCEIRA · PME
          </p>
          <h1>
            O faturamento sobe.
            <br />
            O caixa <em>não acompanha.</em>
          </h1>
          <p className="cv-lead">
            A Vilaris entra na operação financeira da sua empresa para estancar sangrias, deixar a margem
            visível e transformar o caixa em rotina — não em susto no fim do mês.
          </p>
          <div className="cv-hero-actions">
            <CTA>Quero organizar meu caixa</CTA>
          </div>
        </section>

        <section className="cv-pain" id="dor">
          <div className="container">
            <div className="cv-pain-intro">
              <p className="cv-eyebrow">Sinal de alerta</p>
              <h2>
                Se o dinheiro entra
                <br />
                e some no caminho…
              </h2>
              <p>
                Não é falta de esforço. É falta de sistema financeiro. Estes são os sintomas mais comuns das
                PMEs que nos procuram:
              </p>
            </div>
            <div className="cv-pain-grid">
              {pains.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.title}>
                    <Icon size={26} strokeWidth={1.4} aria-hidden="true" />
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </article>
                );
              })}
            </div>
            <div className="cv-pain-foot">
              <p>Se isso soa familiar, o próximo passo é uma conversa objetiva sobre o seu caixa.</p>
              <CTA>Quero sair desse ciclo</CTA>
            </div>
          </div>
        </section>

        <section className="cv-results" id="resultado">
          <div className="container">
            <p className="cv-eyebrow light">O que você passa a ter</p>
            <h2>
              Controle real.
              <br />
              <em>Não relatório decorativo.</em>
            </h2>
            <div className="cv-results-grid">
              {results.map((item) => (
                <article key={item.num}>
                  <span>{item.num}</span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="cv-how" id="como">
          <div className="container">
            <p className="cv-eyebrow">Como funciona</p>
            <h2>
              Três passos.
              <br />
              Sem teatro.
            </h2>
            <div className="cv-how-track">
              {steps.map((s, i) => {
                const Icon = s.icon;
                return (
                  <article key={s.n}>
                    <div className="cv-how-icon">
                      <Icon size={28} strokeWidth={1.35} aria-hidden="true" />
                      <span>{s.n}</span>
                    </div>
                    <h3>{s.title}</h3>
                    <p>{s.text}</p>
                    {i < steps.length - 1 ? <div className="cv-how-line" aria-hidden="true" /> : null}
                  </article>
                );
              })}
            </div>
            <div className="cv-how-cards">
              <article>
                <h3>Encontros + canal direto</h3>
                <p>
                  2 encontros/mês nos primeiros 3 meses. Depois, 1 a 2 focados em fechamento. WhatsApp/Slack
                  para decisões críticas em horário comercial.
                </p>
              </article>
              <article>
                <h3>Seu BPO continua</h3>
                <p>
                  Contabilidade e BPO lançam. A Vilaris define plano de contas gerencial e as regras — para o
                  número fazer sentido.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="cv-section container" id="planos">
          <p className="cv-eyebrow">Horizontes</p>
          <h2>
            Três caminhos.
            <br />
            Um método.
          </h2>
          <p className="cv-section-lead">Do saneamento à governança. O valor entra na conversa.</p>
          <div className="cv-plans">
            {plans.map((p) => (
              <article key={p.months} className={p.featured ? "featured" : undefined}>
                {p.featured ? <span className="cv-badge">Mais escolhido</span> : null}
                <p className="cv-plan-months">
                  <strong>{p.months}</strong> meses
                </p>
                <h3>{p.name}</h3>
                <p className="cv-plan-hook">{p.hook}</p>
                <p className="cv-plan-for">{p.forWho}</p>
                <ul>
                  {p.gets.map((g) => (
                    <li key={g}>
                      <Check size={16} aria-hidden="true" />
                      {g}
                    </li>
                  ))}
                </ul>
                <CTA className={p.featured ? "button" : "button button-outline"}>Quero esse caminho</CTA>
              </article>
            ))}
          </div>
        </section>

        <section className="cv-section cv-section-soft" id="faq">
          <div className="container cv-faq">
            <p className="cv-eyebrow">Dúvidas</p>
            <h2>Perguntas rápidas</h2>
            <div className="cv-faq-list">
              {faq.map((item) => (
                <details key={item.q}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="cv-form-band" id="conversa">
          <div className="container cv-form-layout">
            <div className="cv-form-copy-block">
              <p className="cv-eyebrow light">
                <span className="status-dot" />
                COMECE AQUI
              </p>
              <h2>
                Pronto para
                <br />
                <em>enxergar o caixa?</em>
              </h2>
              <p>
                Deixe nome e empresa. Em horário comercial, a Vilaris retorna para entender o momento e indicar
                o horizonte certo — 3, 6 ou 12 meses.
              </p>
              <ul>
                <li>
                  <Check size={18} aria-hidden="true" /> Conversa objetiva, sem compromisso
                </li>
                <li>
                  <Check size={18} aria-hidden="true" /> Investimento alinhado na conversa
                </li>
                <li>
                  <Check size={18} aria-hidden="true" /> Sem troca obrigatória de BPO
                </li>
              </ul>
            </div>
            <ConsultoriaLeadForm />
          </div>
        </section>
      </main>

      <footer>
        <div className="container footer-top">
          <Brand />
          <p>
            Gestão & estratégia
            <br />
            para o caixa aparecer.
          </p>
          <a href="/">
            Mentoria de carreira <ArrowUpRight size={17} />
          </a>
        </div>
        <div className="container footer-bottom">
          <span>© 2026 Vilaris. Todos os direitos reservados.</span>
          <span>Consultoria financeira para PME.</span>
        </div>
      </footer>
    </div>
  );
}
