import type { Metadata } from "next";
import { ArrowUpRight, Check, MessageCircle, Users, Workflow } from "lucide-react";
import ConsultoriaLeadForm from "./consultoria-lead-form";

export const metadata: Metadata = {
  title: "Vilaris | Consultoria Financeira para PME",
  description:
    "Consultoria financeira sob medida: saneamento de caixa, estruturação e governança. Diagnóstico, controles e rituais para a empresa ver a cor do dinheiro.",
};

const ASSET = "/lp/vilaris/assets";

const profiles = [
  {
    horizon: "3 meses",
    title: "Saneamento & Estancamento",
    forWho: "Descontrole de caixa, dívida cara, margem invisível ou crise aguda.",
    focus: "Diagnóstico, estancar sangrias, reestruturar dívidas e implantar controles básicos.",
  },
  {
    horizon: "6 meses",
    title: "Estruturação & Eficiência",
    forWho: "Fatura bem, mas não vê a cor do dinheiro — ou precisa organizar para crescer.",
    focus: "Tudo do plano de 3 meses + precificação, margem, produtividade e capital de giro.",
  },
  {
    horizon: "12 meses",
    title: "Governança & Escala",
    forWho: "Empresa madura ou em expansão que busca EBITDA, captação e caixa excedente.",
    focus: "Tudo dos planos anteriores + orçamento, valuation/CAPEX e rituais de conselho.",
  },
] as const;

const premises = [
  {
    icon: Users,
    title: "Ritmo de encontros",
    text: "2 encontros/mês nos primeiros 3 meses (1h30–2h). Depois, 1 a 2 encontros focados em governança e fechamento (DRE/Fluxo).",
  },
  {
    icon: MessageCircle,
    title: "Acompanhamento assíncrono",
    text: "Canal direto (WhatsApp/Slack) com SLA definido — validação de decisões, propostas bancárias e dúvidas da equipe financeira.",
  },
  {
    icon: Workflow,
    title: "BPO e contabilidade",
    text: "Eles fornecem os insumos. Você define plano de contas gerencial e regras de categorização; eles executam os lançamentos.",
  },
] as const;

const phases = [
  {
    id: "fase-1",
    label: "Fase 1",
    months: "Meses 1–3",
    title: "Estancamento e visibilidade",
    summary:
      "Raio-X financeiro, plano de contas gerencial, mapa de dívidas, fluxo projetado, budget e primeira DRE gerencial com margem.",
    monthsDetail: [
      {
        m: "Mês 1",
        focus: "Imersão e diagnóstico 360º",
        deliverables: ["Raio-X Financeiro", "Plano de Contas Gerencial", "Mapa de Dívidas (CET e prazos)"],
      },
      {
        m: "Mês 2",
        focus: "Orçamento, caixa e bancos",
        deliverables: ["Fluxo de Caixa Projetado (90 dias / 12 meses)", "Budget por centro de custo", "Dossiê de renegociação/captação"],
      },
      {
        m: "Mês 3",
        focus: "Margem e capital de giro",
        deliverables: ["DRE Gerencial", "Matriz de Rentabilidade", "Plano de otimização de capital de giro"],
      },
    ],
  },
  {
    id: "fase-2",
    label: "Fase 2",
    months: "Meses 4–6",
    title: "Eficiência e precificação",
    summary:
      "Calculadora de markup, política de descontos, painel de produtividade, corte de despesas e política de aplicações.",
    monthsDetail: [
      {
        m: "Mês 4",
        focus: "Engenharia de precificação",
        deliverables: ["Calculadora dinâmica de markup", "Política comercial de descontos"],
      },
      {
        m: "Mês 5",
        focus: "Produtividade e despesas",
        deliverables: ["Painel de produtividade", "Plano de corte/renegociação de fornecedores"],
      },
      {
        m: "Mês 6",
        focus: "Tesouraria e revisão",
        deliverables: ["Política de aplicações financeiras", "Relatório Antes vs. Depois"],
      },
    ],
  },
  {
    id: "fase-3",
    label: "Fase 3",
    months: "Meses 7–12",
    title: "Governança e escala",
    summary:
      "Alinhamento contábil-fiscal, EVTE e captação, controles internos, orçamento do ano seguinte, valuation e board report.",
    monthsDetail: [
      {
        m: "Mês 7",
        focus: "Governança e fiscal",
        deliverables: ["Ata de alinhamento contábil", "Política de pró-labore e dividendos"],
      },
      {
        m: "Mês 8",
        focus: "Expansão e captação",
        deliverables: ["Estudo de viabilidade (VPL/TIR/Payback)", "Book de captação CAPEX"],
      },
      {
        m: "Mês 9",
        focus: "Controles internos",
        deliverables: ["Checklist de riscos e fraudes", "Manual de rotinas financeiras (SOP)"],
      },
      {
        m: "Meses 10–11",
        focus: "Orçamento do ano seguinte",
        deliverables: ["Premissas e cenários", "Orçamento anual consolidado", "Plano de remuneração variável"],
      },
      {
        m: "Mês 12",
        focus: "Fechamento e continuidade",
        deliverables: ["Board report anual", "Estimativa de valuation", "Proposta de conselho consultivo"],
      },
    ],
  },
] as const;

function CTA({ children = "Quero conversar sobre minha empresa" }: { children?: React.ReactNode }) {
  return (
    <a className="button" href="#conversa">
      {children}
      <ArrowUpRight size={19} aria-hidden="true" />
    </a>
  );
}

function Brand() {
  return (
    <a href="/" className="brand" aria-label="Vilaris — início">
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
    <>
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <header className="header">
        <div className="container header-inner">
          <Brand />
          <nav aria-label="Navegação principal">
            <a href="#planos">Planos</a>
            <a href="#jornada">Jornada</a>
            <a href="#como">Como trabalhamos</a>
            <a href="/">Mentoria</a>
          </nav>
          <a href="#conversa" className="header-cta">
            Conversar <ArrowUpRight size={16} />
          </a>
        </div>
      </header>

      <main id="conteudo">
        <section className="hero container consultoria-hero" id="inicio">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="status-dot" />
              CONSULTORIA FINANCEIRA · PME
            </div>
            <h1>
              Sua empresa fatura.
              <br className="hero-break" />
              E o dinheiro <em>aparece?</em>
            </h1>
            <div className="hero-bottom">
              <div className="hero-description-group">
                <p className="hero-intro">
                  Diagnóstico, controles e governança para estancar sangrias, organizar a margem e escalar com
                  clareza.
                </p>
                <p className="hero-description">
                  Três horizontes — 3, 6 ou 12 meses — conforme o momento do negócio. O valor entra na conversa;
                  aqui você entende o caminho.
                </p>
              </div>
              <div className="hero-action">
                <CTA />
                <p className="microcopy">Sem compromisso de contratação.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="audience section" id="para-quem">
          <div className="container">
            <div className="section-heading">
              <p>Para quem é</p>
              <div>
                <h2>
                  Três momentos.
                  <br />
                  Um mesmo método.
                </h2>
              </div>
            </div>
            <div className="audience-grid consultoria-profiles">
              {profiles.map((p, i) => (
                <article key={p.horizon} className={i === 1 ? "growth-card" : undefined}>
                  <div className="card-top">
                    <span>{p.horizon.toUpperCase()}</span>
                  </div>
                  <h3>{p.title}</h3>
                  <p>{p.forWho}</p>
                  <ul>
                    <li>
                      <Check size={14} aria-hidden="true" />
                      {p.focus}
                    </li>
                  </ul>
                  <a href="#conversa">
                    Quero esse caminho <ArrowUpRight size={16} />
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section container" id="como">
          <div className="section-heading">
            <p>Operação</p>
            <div>
              <h2>
                Como
                <br />
                <em>trabalhamos</em>
              </h2>
            </div>
          </div>
          <div className="consultoria-premises">
            {premises.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title}>
                  <Icon size={22} strokeWidth={1.3} aria-hidden="true" />
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="journey section" id="planos">
          <div className="container">
            <div className="section-heading">
              <p>Arquitetura</p>
              <div>
                <h2>
                  Três planos.
                  <br />
                  <em>Modular.</em>
                </h2>
              </div>
            </div>
            <div className="consultoria-plans">
              {profiles.map((p, i) => (
                <article key={p.horizon}>
                  <span className="step-label">PLANO {i + 1}</span>
                  <h3>
                    {p.horizon}
                    <br />
                    <b>{p.title.split(" & ")[0]}</b>
                  </h3>
                  <p>{p.focus}</p>
                  <a className="text-link" href="#conversa" style={{ color: "inherit", borderColor: "#ffffff60" }}>
                    Quero esse caminho <ArrowUpRight size={14} />
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section container" id="jornada">
          <div className="section-heading">
            <p>Jornada</p>
            <div>
              <h2>
                O que acontece
                <br />
                mês a mês
              </h2>
            </div>
          </div>
          <div className="consultoria-phases">
            {phases.map((phase) => (
              <article key={phase.id} className="consultoria-phase">
                <div className="consultoria-phase-head">
                  <span className="step-label">
                    {phase.label} · {phase.months}
                  </span>
                  <h3>{phase.title}</h3>
                  <p>{phase.summary}</p>
                </div>
                <details className="consultoria-months">
                  <summary>
                    Ver detalhe mês a mês <ArrowUpRight size={14} />
                  </summary>
                  <ul>
                    {phase.monthsDetail.map((row) => (
                      <li key={row.m}>
                        <strong>
                          {row.m} — {row.focus}
                        </strong>
                        <span>{row.deliverables.join(" · ")}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              </article>
            ))}
          </div>
        </section>

        <section className="contact section" id="conversa">
          <div className="container contact-grid">
            <div className="contact-copy">
              <p className="eyebrow">
                <span className="status-dot" />
                PRÓXIMO PASSO
              </p>
              <h2>
                Vamos olhar
                <br />
                <em>o caixa juntos?</em>
              </h2>
              <p>
                Conte quem você é e qual é a empresa. Entramos em contato para entender o momento e indicar o
                horizonte certo — 3, 6 ou 12 meses.
              </p>
              <div className="contact-process">
                <span>01</span>
                <p>Você deixa nome e empresa.</p>
                <span>02</span>
                <p>Conversamos sobre o momento financeiro.</p>
                <span>03</span>
                <p>Alinhamos o plano e o investimento.</p>
              </div>
              <p className="contact-note">
                Sem preço na página.
                <br />
                Valor na conversa — sem pressão.
              </p>
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
            para decisões que constroem caixa.
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
    </>
  );
}
