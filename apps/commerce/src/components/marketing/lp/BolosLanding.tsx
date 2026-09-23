import { Suspense } from "react";
import Image from "next/image";
import { LpShell } from "@/components/shells/LpShell";
import { LpStickyCta } from "@/components/marketing/LpStickyCta";
import { LpCheckoutLink } from "@/components/marketing/LpCheckoutLink";
import { LpTestimonials } from "@/components/marketing/LpTestimonials";
import { MetaPixel } from "@/components/meta/MetaPixel";
import { CheckoutForm } from "@/app/checkout/[productId]/CheckoutForm";
import { formatBRL } from "@/lib/utils";
import { ViewContentTracker } from "@/app/(marketing)/p/[slug]/ViewContentTracker";
import { BOLOS_REVIEWS } from "@/components/marketing/lp/reviews-data";

const HERO_SRC = "/produtos/capa-bolos.png";

const RECIPES = [
  {
    n: "01",
    title: "Bolo de Cenoura com Chocolate",
    hook: "Fofinho, úmido e com cobertura que derrete na boca.",
    src: "/produtos/bolo-cenoura.png",
    alt: "Bolo de cenoura com cobertura de chocolate e granulado",
  },
  {
    n: "02",
    title: "Bolo de Fubá com Doce de Leite",
    hook: "Douradinho, macio e com recheio cremoso no meio.",
    src: "/produtos/bolo-fuba.png",
    alt: "Bolo de fubá recheado com doce de leite",
  },
  {
    n: "03",
    title: "Bolo de Chocolate com Brigadeiro",
    hook: "Massa intensa, brigadeiro generoso e muito granulado.",
    src: "/produtos/bolo-chocolate.png",
    alt: "Bolo de chocolate recheado com brigadeiro e granulado",
  },
];

const PROMISES = [
  { k: "100", v: "receitas para escolher" },
  { k: "Fácil", v: "passo a passo claro" },
  { k: "Na hora", v: "libera após o PIX" },
];

const FAQ = [
  {
    q: "O que eu recebo?",
    a: "O e-book digital com as 100 receitas, liberado nesta página após o PIX.",
  },
  {
    q: "Dá para ler no celular?",
    a: "Sim. No celular, no tablet ou no computador.",
  },
  {
    q: "É pagamento único?",
    a: "Sim. Você paga uma vez e o material fica seu.",
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

export function BolosLanding({ product, bump, paymentSettings, pixelId }: Props) {
  const price = formatBRL(product.priceCents);

  return (
    <LpShell theme="bolos">
      <MetaPixel pixelId={pixelId} />
      <ViewContentTracker
        productId={product.id}
        value={product.priceCents / 100}
        name={product.name}
      />

      <section className="lp-hero bl-hero">
        <div className="bl-hero__stage">
          <div className="bl-hero__intro lp-reveal">
            <p className="bl-hero__eyebrow">E-book digital · 100 receitas</p>
            <h1 className="bl-hero__brand">Os 100 Melhores Bolos</h1>
          </div>

          <div className="bl-hero__media lp-reveal lp-reveal-d1">
            <Image
              src={HERO_SRC}
              alt="E-book Os 100 Melhores Bolos"
              width={1905}
              height={1383}
              priority
              sizes="(max-width: 900px) 88vw, 480px"
              className="bl-hero__img"
            />
          </div>

          <div className="bl-hero__offer lp-reveal lp-reveal-d2">
            <p className="bl-hero__promise">
              Bolo caseiro que dá água na boca. Receitas fáceis, testadas e prontas para o café.
            </p>

            <div id="lp-hero-cta" className="bl-hero__cta">
              <div className="bl-hero__price">
                <span>Hoje</span>
                <strong className="lp-price">{price}</strong>
              </div>
              <LpCheckoutLink className="lp-cta">Quero as 100 receitas</LpCheckoutLink>
              <p className="bl-hero__micro">Acesso na hora · pagamento único no PIX</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bl-promises" aria-label="Destaques">
        <div className="bl-promises__inner">
          {PROMISES.map((item) => (
            <div key={item.k} className="bl-promises__item">
              <strong>{item.k}</strong>
              <span>{item.v}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section bl-section bl-section--recipes">
        <div className="bl-wide">
          <header className="bl-section__head">
            <p className="lp-section-label">No e-book</p>
            <h2>Três gostos do que você vai assar</h2>
            <p className="lp-section__lead">
              São 100 opções. Estes já mostram o resultado que chega na sua mesa.
            </p>
          </header>

          <ol className="bl-recipes">
            {RECIPES.map((item) => (
              <li key={item.title} className="bl-recipe">
                <div className="bl-recipe__media">
                  <Image
                    src={item.src}
                    alt={item.alt}
                    width={1024}
                    height={1024}
                    sizes="(max-width: 800px) 94vw, 640px"
                    className="bl-recipe__img"
                  />
                </div>
                <div className="bl-recipe__copy">
                  <span className="bl-recipe__n" aria-hidden>
                    {item.n}
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.hook}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="bl-recipes__footer">
            <p>+ 97 receitas no mesmo e-book</p>
            <LpCheckoutLink className="lp-cta">Quero assar esses bolos</LpCheckoutLink>
          </div>
        </div>
      </section>

      <LpTestimonials {...BOLOS_REVIEWS} />

      <section id="checkout" className="lp-section lp-section--checkout bl-checkout">
        <div className="lp-checkout bl-checkout__panel">
          <div className="lp-checkout__intro">
            <p className="lp-section-label">Checkout</p>
            <h2>Leve as 100 receitas por {price}</h2>
            <p className="lp-checkout__promise">
              Nome, e-mail e CPF. Pague no PIX e o e-book libera aqui.
            </p>
            <ul className="bl-checkout__perks">
              <li>100 receitas</li>
              <li>Acesso imediato</li>
              <li>Pagamento único</li>
            </ul>
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

      <section className="lp-section lp-section--faq bl-section bl-section--faq">
        <div className="lp-wrap">
          <header className="bl-section__head">
            <p className="lp-section-label">FAQ</p>
            <h2>Antes de comprar</h2>
          </header>
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
          <div className="bl-faq-cta">
            <LpCheckoutLink className="lp-cta">
              Quero as 100 receitas por {price}
            </LpCheckoutLink>
          </div>
        </div>
      </section>

      <LpStickyCta priceCents={product.priceCents} ctaLabel="Quero as 100 receitas" />
    </LpShell>
  );
}
