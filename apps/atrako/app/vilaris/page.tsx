import { ArrowDown, ArrowUpRight, Compass, MoveUpRight, Check, Plus } from "lucide-react";
import LeadForm from "./lead-form";

const ASSET = "/lp/vilaris/assets";

const topics = [
  [
    "Direção profissional",
    "Entender onde você está, onde pretende chegar e quais caminhos precisam ser avaliados.",
  ],
  [
    "Transição e reposicionamento",
    "Estruturar uma mudança de área, empresa ou posição de forma mais consciente.",
  ],
  [
    "Crescimento corporativo",
    "Identificar movimentos que podem aproximar você de posições de maior responsabilidade.",
  ],
  [
    "Estratégia de carreira",
    "Deixar de reagir apenas às oportunidades que aparecem e começar a tomar decisões de maneira intencional.",
  ],
  [
    "Tomada de decisão",
    "Comparar cenários e definir prioridades para o seu próximo ciclo profissional.",
  ],
] as const;

const mentors = [
  {
    name: "Ronaldo Carneiro de Souza",
    role: "Consultor de RH · DISC e Eneagrama",
    photo: `${ASSET}/ronaldo.jpg`,
    bio: "Consultor de RH e mentor sênior com vasta experiência em desenvolvimento organizacional e gestão de pessoas. Possui passagem pelo Sicredi, onde coordenou a área de gestão de pessoas e formação como sargento de intendência do Exército Brasileiro. É especialista nas metodologias DISC e Eneagrama, entregando uma visão estratégica sobre comportamento humano, governança e formação de lideranças de alta performance.",
  },
  {
    name: "Guilherme Vilanova Carneiro",
    role: "Estratégia e finanças · sócio da Vilaris",
    photo: `${ASSET}/guilherme.jpg`,
    bio: "Especialista em estratégia corporativa e finanças, com 8 anos de mercado financeiro. Assumiu sua primeira gestão de equipes aos 24 anos, tendo atuado como Gerente de Agência em instituições como Sicredi e Cresol. É sócio da Vilaris Gestão & Estratégia, onde une sua vivência corporativa à mentoria para aceleração de carreira.",
  },
] as const;

function CTA({ children = "Quero avaliar meu momento profissional" }: { children?: React.ReactNode }) {
  return (
    <a className="button" href="#conversa">
      {children}
      <ArrowUpRight size={19} aria-hidden="true" />
    </a>
  );
}

function Brand() {
  return (
    <a href="#inicio" className="brand" aria-label="Vilaris — início">
      <img
        src={`${ASSET}/vilaris-logo.png`}
        alt="Vilaris — Gestão e Estratégia"
        width="3376"
        height="1082"
      />
    </a>
  );
}

export default function VilarisPage() {
  return (
    <>
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <header className="header">
        <div className="container header-inner">
          <Brand />
          <nav aria-label="Navegação principal">
            <a href="#mentoria">A mentoria</a>
            <a href="#jornada">Como funciona</a>
            <a href="#mentores">Os mentores</a>
          </nav>
          <a href="#conversa" className="header-cta">
            Vamos conversar <ArrowUpRight size={16} />
          </a>
        </div>
      </header>
      <main id="conteudo">
        <section className="hero container" id="inicio">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="status-dot" />
              ÚLTIMA TURMA DE 2026
            </div>
            <h1>
              Sua carreira não precisa
              <br className="hero-break" /> avançar <em>no improviso.</em>
            </h1>
            <div className="hero-bottom">
              <div className="hero-description-group">
                <p className="hero-intro">Construa com clareza o próximo movimento da sua vida profissional.</p>
                <p className="hero-description">
                  Para mudar de área, se reposicionar ou acelerar seu crescimento no mundo corporativo. Uma
                  mentoria estratégica para transformar possibilidades em uma direção clara.
                </p>
              </div>
              <div className="hero-action">
                <CTA />
                <p className="microcopy">O primeiro passo é uma conversa sobre você.</p>
              </div>
            </div>
          </div>
          <div className="hero-mosaic">
            <div className="mosaic-stat">
              <Compass size={27} strokeWidth={1.2} aria-hidden="true" />
              <div>
                <strong>
                  3 <span>meses*</span>
                </strong>
                <small>para construir seu próximo passo</small>
              </div>
              <a href="#mentoria" className="discover">
                <span>
                  <ArrowDown size={15} />
                </span>
                Conheça a mentoria
              </a>
            </div>
            <div className="mosaic-stat mosaic-stat-secondary">
              <MoveUpRight size={27} strokeWidth={1.2} aria-hidden="true" />
              <div>
                <strong>
                  6 <span>encontros</span>
                </strong>
                <small>uma jornada estruturada</small>
              </div>
              <p>
                Experiência para decidir.
                <br />
                <strong>Estratégia para avançar.</strong>
              </p>
            </div>
            <div className="hero-visual">
              <img
                src={`${ASSET}/architecture.jpg`}
                alt="Perspectiva de edifícios corporativos em direção ao céu"
                width="1600"
                height="1067"
                fetchPriority="high"
              />
              <div className="visual-tint" />
              <div className="visual-label">
                <span>MENTORIA DE CARREIRA</span>
                <ArrowUpRight size={23} />
              </div>
              <div className="visual-message">
                <span>O próximo capítulo</span>
                <span>
                  começa com <i>direção.</i>
                </span>
              </div>
              <div className="visual-foot">
                <span>CLAREZA. ESTRATÉGIA. MOVIMENTO.</span>
                <span>01 — 26</span>
              </div>
            </div>
            <div className="mosaic-stat mosaic-stat-last">
              <ArrowUpRight size={27} strokeWidth={1.2} aria-hidden="true" />
              <div>
                <strong>4 + 2</strong>
                <small>em grupo e individuais</small>
              </div>
            </div>
          </div>
        </section>

        <section className="reflection-band" id="mentoria">
          <div className="container reflection">
            <figure className="reflection-image" aria-hidden="true">
              <img src={`${ASSET}/architecture.jpg`} alt="" width="1600" height="1067" loading="lazy" />
            </figure>
            <div className="reflection-main">
              <div>
                <p className="eyebrow">UM NOVO OLHAR PARA SUA TRAJETÓRIA</p>
                <h2>
                  Talvez você não precise
                  <br />
                  trabalhar mais.
                  <br />
                  <em>Precisa decidir melhor.</em>
                </h2>
              </div>
              <div className="reflection-copy">
                <p>Chega um momento em que simplesmente continuar fazendo um bom trabalho não é suficiente.</p>
                <p>
                  Você pode ter construído uma carreira e perceber que já não quer continuar no mesmo caminho. Ou
                  estar pronto para assumir mais responsabilidade, ainda sem clareza sobre como avançar.
                </p>
                <p className="strong-copy">Algumas perguntas merecem mais do que uma resposta no improviso.</p>
                <div className="questions">
                  <span>Continuar ou mudar?</span>
                  <span>Qual área faz sentido?</span>
                  <span>Como chegar à liderança?</span>
                  <span>Qual é o próximo movimento?</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="audience section" id="para-quem">
          <div className="container">
            <div className="section-heading">
              <div>
                <p className="eyebrow">PARA QUEM É A MENTORIA</p>
                <h2>
                  Momentos diferentes.
                  <br />
                  <em>A mesma vontade de avançar.</em>
                </h2>
              </div>
              <p>
                Sua experiência é o ponto de partida.
                <br />
                O próximo movimento é a nossa construção.
              </p>
            </div>
            <div className="audience-grid">
              <article>
                <div className="card-top">
                  <Compass strokeWidth={1.3} size={36} />
                  <span>01 / REPOSICIONAR</span>
                </div>
                <h3>
                  Quero mudar
                  <br />
                  de direção.
                </h3>
                <p>
                  Você acumulou experiência e resultados, mas sente que chegou o momento de se reposicionar e
                  construir um novo caminho.
                </p>
                <ul>
                  <li>
                    <Check size={16} />
                    Mudar de área ou setor
                  </li>
                  <li>
                    <Check size={16} />
                    Buscar uma recolocação
                  </li>
                  <li>
                    <Check size={16} />
                    Reavaliar sua trajetória profissional
                  </li>
                </ul>
                <a href="#conversa">
                  Quero encontrar minha direção <ArrowUpRight size={19} />
                </a>
              </article>
              <figure className="audience-image" aria-hidden="true">
                <img src={`${ASSET}/architecture.jpg`} alt="" width="1600" height="1067" loading="lazy" />
              </figure>
              <article className="growth-card">
                <div className="card-top">
                  <MoveUpRight strokeWidth={1.3} size={36} />
                  <span>02 / CRESCER</span>
                </div>
                <h3>
                  Quero ir
                  <br />
                  mais longe.
                </h3>
                <p>
                  Você já está no mundo corporativo e quer construir uma estratégia consciente para acelerar sua
                  evolução profissional.
                </p>
                <ul>
                  <li>
                    <Check size={16} />
                    Assumir mais responsabilidade
                  </li>
                  <li>
                    <Check size={16} />
                    Chegar a uma posição de liderança
                  </li>
                  <li>
                    <Check size={16} />
                    Ampliar suas possibilidades
                  </li>
                </ul>
                <a href="#conversa">
                  Quero planejar meu crescimento <ArrowUpRight size={19} />
                </a>
              </article>
            </div>
            <p className="audience-note">
              A mentoria é especialmente indicada para profissionais de empresas estruturadas, instituições
              financeiras e cooperativas de crédito — sem se limitar a esses setores.
            </p>
          </div>
        </section>

        <section className="section container direction">
          <div className="direction-title">
            <p className="eyebrow">POSSIBILIDADES COM PROPÓSITO</p>
            <h2>
              Não é sobre ter
              <br />
              mais opções.
              <br />
              <em>
                É sobre saber
                <br />
                qual escolher.
              </em>
            </h2>
            <p>
              Uma decisão de carreira pode transformar os próximos 5, 10 ou 20 anos da sua vida. Vamos olhar para
              essas escolhas com a atenção que elas merecem.
            </p>
            <a className="text-link" href="#conversa">
              Vamos olhar para o seu momento <ArrowUpRight size={18} />
            </a>
          </div>
          <div className="topic-list">
            {topics.map(([title, description], i) => (
              <details key={title} open={i === 0}>
                <summary>
                  <span className="topic-index">0{i + 1}</span>
                  <h3>{title}</h3>
                  <Plus size={20} />
                </summary>
                <p>{description}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="journey section" id="jornada">
          <div className="container">
            <div className="section-heading">
              <div>
                <p className="eyebrow">COMO FUNCIONA</p>
                <h2>
                  Uma pausa para refletir.
                  <br />
                  <em>Um plano para seguir.</em>
                </h2>
              </div>
              <p>Aproximadamente 3 meses para olhar para sua carreira com outra perspectiva.</p>
            </div>
            <div className="journey-grid">
              <div className="journey-intro">
                <span className="journey-number">
                  06<span>encontros</span>
                </span>
                <p>
                  Momentos coletivos e acompanhamento individual. Uma jornada que conecta reflexão, troca e
                  decisões concretas.
                </p>
              </div>
              <article>
                <span className="step-label">AMPLIAR O OLHAR</span>
                <h3>
                  <b>4</b> encontros
                  <br />
                  em grupo
                </h3>
                <p>
                  Para aprofundar temas, compartilhar experiências e trabalhar desafios comuns ao desenvolvimento
                  profissional.
                </p>
                <span className="journey-bottom">
                  Troca que abre possibilidades <ArrowUpRight size={18} />
                </span>
              </article>
              <article>
                <span className="step-label">OLHAR PARA VOCÊ</span>
                <h3>
                  <b>2</b> encontros
                  <br />
                  individuais
                </h3>
                <p>
                  Um espaço dedicado ao seu contexto, às suas decisões e aos movimentos específicos da sua carreira.
                </p>
                <span className="journey-bottom">
                  Estratégia para o seu momento <ArrowUpRight size={18} />
                </span>
              </article>
            </div>
            <p className="journey-note">
              Precisa de um acompanhamento mais próximo? Uma configuração ampliada pode ser definida na conversa
              de diagnóstico.
            </p>
          </div>
        </section>

        <section className="manifesto container section">
          <span className="eyebrow">SUA TRAJETÓRIA É ÚNICA</span>
          <h2>
            Não existe uma carreira ideal para todo mundo.
            <br />
            Existe uma estratégia coerente com <em>o seu momento.</em>
          </h2>
          <p>
            Por isso, não partimos de uma fórmula pronta. Partimos do seu cenário, das suas possibilidades e das
            suas ambições.
          </p>
          <span className="manifesto-line" />
        </section>

        <section className="mentors section" id="mentores">
          <div className="container mentors-grid">
            <div>
              <p className="eyebrow">QUEM ESTARÁ AO SEU LADO</p>
              <h2>
                Experiência aplicada
                <br />
                às decisões <em>reais.</em>
              </h2>
              <p>
                Profissionais à frente da Vilaris, reunindo suas experiências para apoiar decisões de carreira,
                desenvolvimento e crescimento no mundo corporativo.
              </p>
            </div>
            <div className="mentor-names">
              {mentors.map((mentor) => (
                <article key={mentor.name}>
                  <details>
                    <summary>
                      <img
                        className="mentor-photo"
                        src={mentor.photo}
                        alt={mentor.name}
                        width={1400}
                        height={1120}
                        loading="lazy"
                      />
                      <span className="mentor-toggle" aria-hidden="true">
                        <ArrowUpRight size={16} />
                      </span>
                      <div>
                        <span>MENTOR</span>
                        <h3>{mentor.name}</h3>
                        <p>{mentor.role}</p>
                      </div>
                    </summary>
                    <div className="mentor-bio">
                      <div>
                        <p>{mentor.bio}</p>
                      </div>
                    </div>
                  </details>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section container investment">
          <div>
            <p className="eyebrow">INVISTA NO SEU PRÓXIMO CAPÍTULO</p>
            <h2>
              Seu próximo movimento
              <br />
              começa com <em>uma conversa.</em>
            </h2>
            <p>
              Antes da entrada no programa, queremos entender onde você está, o que pretende construir e se a
              mentoria faz sentido para seus objetivos.
            </p>
          </div>
          <div className="price-box">
            <span className="eyebrow">MENTORIA DE CARREIRA</span>
            <h3 className="conversation-title">
              O primeiro passo
              <br />
              é entender você.
            </h3>
            <p className="conversation-description">
              Uma conversa para avaliar seu momento e descobrir se a mentoria é o caminho para seus objetivos.
            </p>
            <p className="price-meta">
              ≈ 3 meses <span>·</span> 4 encontros em grupo <span>·</span> 2 encontros individuais
            </p>
            <CTA>Quero conversar sobre minha carreira</CTA>
          </div>
        </section>

        <section className="contact section" id="conversa">
          <div className="container contact-grid">
            <div className="contact-copy">
              <p className="eyebrow">
                <span className="status-dot" />
                SEU PRÓXIMO PASSO
              </p>
              <h2>
                Vamos falar sobre
                <br />
                <em>o seu futuro?</em>
              </h2>
              <p>
                Conte um pouco sobre o seu momento profissional. Nossa equipe entrará em contato para entender seus
                objetivos e apresentar os próximos passos.
              </p>
              <div className="contact-process">
                <span>01</span>
                <p>Você compartilha seu momento.</p>
                <span>02</span>
                <p>Conversamos sobre seus objetivos.</p>
                <span>03</span>
                <p>Avaliamos juntos o melhor caminho.</p>
              </div>
              <p className="contact-note">
                Sem compromisso de matrícula.
                <br />
                Com espaço para uma boa conversa.
              </p>
            </div>
            <LeadForm />
          </div>
        </section>

        <section className="closing section container">
          <p className="eyebrow">ÚLTIMA TURMA DE 2026</p>
          <h2>
            Daqui a um ano,
            <br />
            o que você quer
            <br />
            <em>ter colocado em movimento?</em>
          </h2>
          <p>O próximo capítulo da sua trajetória começa com uma decisão consciente.</p>
          <CTA />
        </section>
      </main>
      <footer>
        <div className="container footer-top">
          <Brand />
          <p>
            Estratégia para decisões
            <br />
            que constroem o próximo ciclo.
          </p>
          <a href="#inicio">
            Voltar ao início <ArrowUpRight size={17} />
          </a>
        </div>
        <div className="container footer-bottom">
          <span>© 2026 Vilaris. Todos os direitos reservados.</span>
          <span>*Duração aproximada do programa: 3 meses.</span>
        </div>
      </footer>
    </>
  );
}
