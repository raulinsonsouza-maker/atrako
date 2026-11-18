import type { Metadata } from "next";
import { ArrowDown, ArrowUpRight, Check } from "lucide-react";
import ConsultoriaLeadForm from "./consultoria-lead-form";

export const metadata: Metadata = {
  title: "Vilaris | Consultoria Financeira para PME",
  description:
    "Pare de apagar incêndio no caixa. Consultoria financeira para PME: estancar sangrias, organizar margem e crescer com controle. Conversa sem compromisso.",
};

const ASSET = "/lp/vilaris/assets";

const pains = [
  "Fatura alto e o caixa continua apertado",
  "Não sabe quanto sobra de verdade em cada produto",
  "Dívida cara e renegociação sem dossiê",
  "BPO/contabilidade lançam — mas sem plano gerencial",
  "Sócio tira dinheiro sem regra e a operação sente",
] as const;

const results = [
  "Visibilidade de caixa em semanas, não em meses",
  "Margem clara por produto e por cliente",
  "Controles que a equipe consegue seguir",
  "Decisão de crédito e investimento com número",
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
  { n: "01", title: "Conversa", text: "Você conta o momento da empresa. Sem pitch longo." },
  { n: "02", title: "Diagnóstico", text: "Olhamos caixa, dívida e margem com os números reais." },
  { n: "03", title: "Plano", text: "Combinamos o horizonte — 3, 6 ou 12 meses — e o ritmo de encontros." },
] as const;

const faq = [
  {
    q: "Preciso trocar de contador ou BPO?",
    a: "Não. Eles continuam lançando. A Vilaris define o plano de contas gerencial e as regras; o fornecedor executa.",
  },
  {
    q: "Quantos encontros por mês?",
    a: "Nos primeiros 3 meses: 2 encontros (1h30–2h). Depois: 1 a 2, focados em governança e fechamento (DRE/fluxo). Canal assíncrono com SLA no dia a dia.",
  },
  {
    q: "Quanto custa?",
    a: "O investimento depende do porte e do horizonte. Alinhamos na conversa — sem preço engessado na página.",
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

function Brand({ href = "/" }: { href?: string }) {
  return (
    <a href={href} className="brand" aria-label="Vilaris — início">
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
          <nav aria-label="Navegação">
            <a href="#planos">Planos</a>
            <a href="#como">Como funciona</a>
            <a href="#faq">Dúvidas</a>
          </nav>
          <a href="#conversa" className="header-cta">
            Conversar <ArrowUpRight size={16} />
          </a>
        </div>
      </header>

      <main id="conteudo">
        {/* HERO */}
        <section className="cv-hero container" id="inicio">
          <p className="cv-eyebrow">
            <span className="status-dot" />
            CONSULTORIA FINANCEIRA PARA PME
          </p>
          <h1>
            Sua empresa fatura.
            <br />
            E o dinheiro <em>some?</em>
          </h1>
          <p className="cv-lead">
            Pare de apagar incêndio no caixa. A gente organiza margem, dívida e rotina financeira — para você
            decidir com número, não com feeling.
          </p>
          <div className="cv-hero-actions">
            <CTA>Quero conversar sobre meu caixa</CTA>
            <a className="cv-secondary" href="#planos">
              Ver os 3 caminhos <ArrowDown size={18} />
            </a>
          </div>
          <ul className="cv-trust">
            <li>Sem compromisso</li>
            <li>Valor só na conversa</li>
            <li>3, 6 ou 12 meses</li>
          </ul>
        </section>

        {/* PROBLEM */}
        <section className="cv-band cv-band-dark" id="dor">
          <div className="container">
            <p className="cv-eyebrow light">O problema</p>
            <h2>
              Se você se reconhece
              <br />
              em alguma destas frases…
            </h2>
            <ul className="cv-pain-list">
              {pains.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="cv-band-cta-line">
              …é exatamente o tipo de empresa que a Vilaris atende.
            </p>
            <CTA className="button button-on-dark">Quero sair desse ciclo</CTA>
          </div>
        </section>

        {/* RESULTS */}
        <section className="cv-section container" id="resultado">
          <p className="cv-eyebrow">O que muda</p>
          <h2>
            Clareza de caixa.
            <br />
            <em>Decisão com número.</em>
          </h2>
          <div className="cv-result-grid">
            {results.map((item) => (
              <article key={item}>
                <Check size={22} strokeWidth={1.5} aria-hidden="true" />
                <p>{item}</p>
              </article>
            ))}
          </div>
        </section>

        {/* HOW */}
        <section className="cv-section cv-section-soft" id="como">
          <div className="container">
            <p className="cv-eyebrow">Como funciona</p>
            <h2>
              Simples.
              <br />
              Direto ao ponto.
            </h2>
            <div className="cv-steps">
              {steps.map((s) => (
                <article key={s.n}>
                  <span>{s.n}</span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </article>
              ))}
            </div>
            <div className="cv-how-note">
              <p>
                <strong>Encontros + canal direto.</strong> Nos primeiros 3 meses, 2 encontros por mês. Depois, 1 a
                2 focados em fechamento. WhatsApp/Slack com resposta em horário comercial para decisões críticas.
              </p>
              <p>
                <strong>BPO e contabilidade continuam.</strong> Eles lançam. Você (com a Vilaris) define as regras
                gerenciais.
              </p>
            </div>
          </div>
        </section>

        {/* PLANS */}
        <section className="cv-section container" id="planos">
          <p className="cv-eyebrow">Escolha o horizonte</p>
          <h2>
            Três caminhos.
            <br />
            Um método.
          </h2>
          <p className="cv-section-lead">
            Começa no saneamento e sobe conforme a empresa precisa — sem preço na página.
          </p>
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

        {/* FAQ */}
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

        {/* FORM */}
        <section className="contact section cv-contact" id="conversa">
          <div className="container contact-grid">
            <div className="contact-copy">
              <p className="cv-eyebrow">
                <span className="status-dot" />
                PRÓXIMO PASSO
              </p>
              <h2>
                Vamos olhar
                <br />
                <em>seu caixa?</em>
              </h2>
              <p className="cv-form-copy">
                Deixe nome e empresa. Entramos em contato para entender o momento e indicar o horizonte certo.
              </p>
              <ul className="cv-form-bullets">
                <li>
                  <Check size={18} aria-hidden="true" /> Sem compromisso
                </li>
                <li>
                  <Check size={18} aria-hidden="true" /> Valor só na conversa
                </li>
                <li>
                  <Check size={18} aria-hidden="true" /> Resposta em horário comercial
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
