import { Suspense } from "react";
import Image from "next/image";
import {
  Leaf,
  FlaskConical,
  Scissors,
  ShieldAlert,
  HeartHandshake,
  BookMarked,
} from "lucide-react";
import { LpShell } from "@/components/shells/LpShell";
import { LpStickyCta } from "@/components/marketing/LpStickyCta";
import { LpCheckoutLink } from "@/components/marketing/LpCheckoutLink";
import { LpAutoVideo } from "@/components/marketing/LpAutoVideo";
import { LpTestimonials } from "@/components/marketing/LpTestimonials";
import { MetaPixel } from "@/components/meta/MetaPixel";
import { CheckoutForm } from "@/app/checkout/[productId]/CheckoutForm";
import { formatBRL } from "@/lib/utils";
import { ViewContentTracker } from "@/app/(marketing)/p/[slug]/ViewContentTracker";
import { PLANTAS_REVIEWS } from "@/components/marketing/lp/reviews-data";

const HERO_SRC = "/produtos/capa-plantas.png";
const MID_SRC = "/produtos/mockup-plantas-tablet.png";
const PROMO_VIDEO_SRC = "/produtos/promo-plantas.mp4";

const CONTENTS = [
  { title: "As plantas certas", hint: "Espécies que fazem parte do dia a dia em Minas", Icon: Leaf },
  { title: "Como preparar", hint: "Passo a passo sem chute", Icon: FlaskConical },
  { title: "O que usar", hint: "Folha, flor, raiz ou semente. Sem dúvida", Icon: Scissors },
  { title: "Cuidados", hint: "O que você precisa saber antes de usar", Icon: ShieldAlert },
  { title: "Para a família", hint: "Conhecimento para cuidar com mais segurança", Icon: HeartHandshake },
  { title: "Sempre à mão", hint: "Abra e consulte quando surgir a dúvida", Icon: BookMarked },
];

const DOUBTS = [
  "Qual parte usar?",
  "Como preparar?",
  "Quanto usar?",
  "Quando evitar?",
];

const FAQ = [
  {
    q: "O que eu recebo?",
    a: "O e-book digital Tratado das Plantas Medicinais Mineiras, Nativas e Cultivadas. Acesso na hora.",
  },
  {
    q: "Dá para ler no celular?",
    a: "Sim. No celular, no tablet ou no computador.",
  },
  {
    q: "Tem preparo e cuidados?",
    a: "Sim. Você encontra formas de preparo, partes utilizadas e os cuidados importantes.",
  },
  {
    q: "Substitui médico?",
    a: "Não. É um material educativo para consulta. Não substitui orientação profissional.",
  },
];

type BumpOffer = {
  id: string;
  offeredProductId: string;
  discountPercent: number;
  headline: string | null;
  description: string | null;
  offeredProduct: { id: string; name: string; priceCents: number };
};

type Props = {
  product: {
    id: string;
    name: string;
    priceCents: number;
    maxInstallments: number | null;
    description: string | null;
  };
  bump: BumpOffer | null;
  paymentSettings: {
    cardEnabled: boolean;
    pixEnabled: boolean;
    maxInstallments: number;
    minInstallments: number;
  };
  pixelId: string | null;
};

export function PlantasLanding({ product, bump, paymentSettings, pixelId }: Props) {
  const price = formatBRL(product.priceCents);

  return (
    <LpShell theme="plantas">
      <MetaPixel pixelId={pixelId} />
      <ViewContentTracker
        productId={product.id}
        value={product.priceCents / 100}
        name={product.name}
      />

      <section className="lp-hero pl-hero">
        <div className="pl-hero__inner">
          <div className="pl-hero__media lp-reveal">
            <Image
              src={HERO_SRC}
              alt="E-book Tratado das Plantas Medicinais"
              width={1905}
              height={1383}
              priority
              sizes="(max-width: 900px) 92vw, 520px"
              className="pl-hero__img"
            />
          </div>

          <div className="pl-hero__copy lp-reveal lp-reveal-d1">
            <p className="pl-hero__eyebrow">E-book digital</p>
            <h1 className="pl-hero__brand">Tratado das Plantas Medicinais</h1>
            <p className="pl-hero__promise">
              Cuide melhor de você e da sua família com o conhecimento certo sobre plantas.
            </p>
            <p className="pl-hero__lead">
              Um guia completo para consultar sempre que precisar. Preparo, cuidados e muito mais,
              por apenas <strong>{price}</strong>.
            </p>

            <div className="pl-hero__buy lp-reveal-d2">
              <div className="pl-hero__priceblock">
                <span>Hoje</span>
                <p className="lp-price">{price}</p>
              </div>
              <div id="lp-hero-cta" className="pl-hero__actions">
                <LpCheckoutLink className="lp-cta lp-cta--full">Quero meu e-book</LpCheckoutLink>
                <p className="pl-hero__micro">PIX na hora · Fica seu · Lê no celular</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-section pl-section pl-section--video" aria-label="Apresentação do e-book">
        <div className="lp-wrap pl-video">
          <p className="lp-section-label">Olha só</p>
          <h2>Esse conhecimento pode ser seu hoje.</h2>
          <div className="pl-video__frame">
            <LpAutoVideo
              src={PROMO_VIDEO_SRC}
              className="pl-video__media"
              ariaLabel="Apresentação visual do e-book Tratado das Plantas Medicinais"
            />
          </div>
        </div>
      </section>

      <section className="lp-section pl-section">
        <div className="lp-wrap">
          <p className="lp-section-label">Você já sentiu isso?</p>
          <h2>Você conhece a planta… mas trava na hora de usar.</h2>
          <div className="pl-doubt-grid" role="list">
            {DOUBTS.map((item) => (
              <div key={item} className="pl-doubt" role="listitem">
                <span className="pl-doubt__mark" aria-hidden>
                  ?
                </span>
                <span>{item}</span>
              </div>
            ))}
          </div>
          <p className="pl-bridge">
            Com o Tratado, a resposta fica no seu bolso: clara, organizada e pronta.
          </p>
        </div>
      </section>

      <section id="o-que-recebe" className="lp-section pl-section pl-section--surface">
        <div className="lp-wrap">
          <p className="lp-section-label">O que você leva</p>
          <h2>Tudo o que você precisa, sem enrolação.</h2>
          <ul className="pl-feature-grid">
            {CONTENTS.map(({ title, hint, Icon }) => (
              <li key={title} className="pl-feature">
                <span className="pl-feature__icon" aria-hidden>
                  <Icon size={20} strokeWidth={1.75} />
                </span>
                <div>
                  <strong>{title}</strong>
                  <span>{hint}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="lp-section pl-section pl-section--authority">
        <div className="lp-wrap">
          <p className="lp-section-label">Por que confiar</p>
          <h2>Não é mais um PDF da internet.</h2>
          <div className="pl-stats">
            <div className="pl-stat">
              <strong>40</strong>
              <span>anos de experiência da farmacêutica Telma</span>
            </div>
            <div className="pl-stat">
              <strong>80+</strong>
              <span>raizeiros ouvidos em Minas Gerais</span>
            </div>
            <div className="pl-stat">
              <strong>3</strong>
              <span>anos de aquarelas feitas à mão</span>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-section pl-section pl-section--mid">
        <div className="lp-wrap">
          <div className="pl-split">
            <div className="pl-split__copy">
              <p className="lp-section-label">Leve com você</p>
              <h2>Abre no celular. Resolve a dúvida. Seguimos a vida.</h2>
              <p className="lp-section__lead">
                É o tipo de material que você guarda e volta sempre: bonito, completo e feito
                para o dia a dia.
              </p>
              <LpCheckoutLink className="lp-cta">Quero ter o meu</LpCheckoutLink>
            </div>
            <div className="pl-mid-mockup">
              <Image
                src={MID_SRC}
                alt="Tratado das Plantas Medicinais no tablet"
                width={750}
                height={683}
                sizes="(max-width: 900px) 88vw, 420px"
                className="pl-mid-mockup__img"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="lp-section pl-section pl-section--surface">
        <div className="lp-wrap">
          <p className="lp-section-label">Internet vs Tratado</p>
          <h2>Pare de caçar informação em dez abas diferentes.</h2>
          <div className="pl-compare">
            <div className="pl-compare__col pl-compare__col--bad">
              <p className="pl-compare__label">Na internet</p>
              <ul>
                <li>Tudo espalhado</li>
                <li>Uma coisa em cada site</li>
                <li>Dúvida que não acaba</li>
              </ul>
            </div>
            <div className="pl-compare__vs" aria-hidden>
              vs
            </div>
            <div className="pl-compare__col pl-compare__col--good">
              <p className="pl-compare__label">No e-book</p>
              <ul>
                <li>Tudo junto</li>
                <li>Preparo e cuidados</li>
                <li>Consulta em segundos</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <LpTestimonials {...PLANTAS_REVIEWS} />

      <section id="checkout" className="lp-section lp-section--checkout pl-checkout">
        <div className="lp-checkout pl-checkout__panel">
          <div className="lp-checkout__intro">
            <p className="lp-section-label">Checkout</p>
            <h2>Leve o Tratado agora</h2>
            <p className="lp-checkout__promise">
              Nome, e-mail e CPF. Pague no PIX e o e-book libera nesta página.
            </p>

            <div className="pl-checkout-card">
              <div className="pl-checkout-card__top">
                <span className="pl-checkout-card__name">E-book completo</span>
                <p className="pl-checkout-card__price">{price}</p>
              </div>
              <ul className="pl-checkout-card__perks">
                <li>Acesso na hora</li>
                <li>Pagamento único</li>
                <li>Leitura no celular</li>
              </ul>
            </div>
          </div>

          <div id="checkout-form" className="lp-checkout__form">
            <Suspense fallback={<p className="lp-loading">Carregando…</p>}>
              <CheckoutForm
                embedded
                product={{
                  id: product.id,
                  name: product.name,
                  priceCents: product.priceCents,
                  maxInstallments: product.maxInstallments,
                  description: product.description,
                }}
                bump={bump}
                paymentSettings={{
                  cardEnabled: paymentSettings.cardEnabled,
                  pixEnabled: paymentSettings.pixEnabled,
                  maxInstallments: paymentSettings.maxInstallments,
                  minInstallments: paymentSettings.minInstallments,
                }}
              />
            </Suspense>
          </div>
        </div>
      </section>

      <section className="lp-section lp-section--faq pl-section">
        <div className="lp-wrap">
          <p className="lp-section-label">Ainda com dúvida?</p>
          <h2>Respostas rápidas</h2>
          <div className="lp-faq">
            {FAQ.map((item, index) => (
              <details key={item.q} className="lp-faq__item" open={index === 0}>
                <summary>
                  <span>{item.q}</span>
                  <span className="lp-faq__icon" aria-hidden />
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
          <div className="pl-faq-cta">
            <LpCheckoutLink className="lp-cta lp-cta--full">Quero meu e-book por {price}</LpCheckoutLink>
            <p className="pl-disclaimer">
              Material educativo. Não substitui orientação de profissionais de saúde.
            </p>
          </div>
        </div>
      </section>

      <LpStickyCta priceCents={product.priceCents} ctaLabel="Quero meu e-book" />
    </LpShell>
  );
}
