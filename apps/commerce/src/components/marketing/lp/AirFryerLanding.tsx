import { Suspense } from "react";
import Image from "next/image";
import { LpShell } from "@/components/shells/LpShell";
import { LpStickyCta } from "@/components/marketing/LpStickyCta";
import { LpCheckoutLink } from "@/components/marketing/LpCheckoutLink";
import { LpAutoVideo } from "@/components/marketing/LpAutoVideo";
import { LpTestimonials } from "@/components/marketing/LpTestimonials";
import { MetaPixel } from "@/components/meta/MetaPixel";
import { CheckoutForm } from "@/app/checkout/[productId]/CheckoutForm";
import { formatBRL } from "@/lib/utils";
import { ViewContentTracker } from "@/app/(marketing)/p/[slug]/ViewContentTracker";
import { AIR_FRYER_REVIEWS } from "@/components/marketing/lp/reviews-data";

const COVER_SRC = "/produtos/capa-airfryer.png";
const RECIPE_VIDEO_SRC = "/produtos/receita-airfryer.mp4";

const BENEFITS = [
  {
    title: "50 ideias prontas para a semana",
    body: "Café, almoço, jantar e lanches. Você abre, escolhe e faz. Sem ficar perdido no WhatsApp atrás de receita.",
  },
  {
    title: "Comida gostosa sem pesar",
    body: "Aquele crocante que todo mundo ama, com bem menos óleo. Dá para comer bem e ainda se sentir leve.",
  },
  {
    title: "Feito para o dia corrido",
    body: "Receitas rápidas, com ingredientes de mercado. Ideal para quem chega cansada e ainda quer jantar de verdade.",
  },
  {
    title: "Você leva na hora",
    body: "Paga no PIX e o guia aparece nesta página. Ainda hoje você já pode escolher a primeira receita.",
  },
];

const FAQ = [
  {
    q: "Como eu recebo depois de pagar?",
    a: "Na hora. Assim que o PIX confirma, o guia libera nesta mesma tela para você baixar. Também chega no e-mail, para guardar e abrir de novo quando quiser.",
  },
  {
    q: "Demora para liberar?",
    a: "Quase nunca. Na maioria das vezes é questão de segundos. Você paga e já consegue acessar.",
  },
  {
    q: "Serve na Air Fryer que eu tenho em casa?",
    a: "Sim. As receitas são simples de seguir e se adaptam fácil, seja o modelo menor ou o maior.",
  },
  {
    q: "E se eu não sou boa de cozinha?",
    a: "Melhor ainda. O guia foi feito para quem quer resultado sem complicar: passo a passo claro e ingredientes fáceis de achar.",
  },
  {
    q: "Vou pagar todo mês?",
    a: "Não. É só uma vez. Você paga R$ 19,90, leva as 50 receitas e o material fica seu.",
  },
  {
    q: "Consigo usar no celular enquanto cozinho?",
    a: "Sim. Abre no celular, no tablet ou no computador. Dá para deixar na bancada e ir seguindo.",
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

export function AirFryerLanding({ product, bump, paymentSettings, pixelId }: Props) {
  const price = formatBRL(product.priceCents);

  return (
    <LpShell theme="airfryer">
      <MetaPixel pixelId={pixelId} />
      <ViewContentTracker
        productId={product.id}
        value={product.priceCents / 100}
        name={product.name}
      />

      <section className="lp-hero">
        <div className="lp-hero__inner">
          <div className="lp-hero__media lp-reveal">
            <Image
              src={COVER_SRC}
              alt="Guia Simples e Saudáveis com 50 receitas na Air Fryer"
              fill
              priority
              sizes="(max-width: 900px) 100vw, 560px"
              className="lp-hero__img"
            />
          </div>

          <div className="lp-hero__copy">
            <div className="lp-hero__copy-inner lp-reveal lp-reveal-d1">
              <p className="lp-kicker">50 receitas prontas</p>
              <h1 className="lp-product-name">Simples e Saudáveis</h1>
              <p className="lp-promise">Pare de abrir a Air Fryer e não saber o que fazer.</p>
              <p className="lp-lead">
                Leve <strong>50 receitas</strong> gostosas e leves para o dia a dia. Jantar pronto
                em minutos, sem fritura pesada e sem ficar caçando ideia na internet.
              </p>

              <div className="lp-offer lp-reveal-d2">
                <div className="lp-offer__price">
                  <span className="lp-offer__label">Por tempo limitado</span>
                  <p className="lp-price">{price}</p>
                </div>
                <ul className="lp-offer__perks">
                  <li>Paga uma vez</li>
                  <li>Acesso na hora</li>
                  <li>Fica com você</li>
                </ul>
              </div>

              <div id="lp-hero-cta" className="lp-cta-row lp-reveal-d2">
                <LpCheckoutLink className="lp-cta lp-cta--full">
                  Quero cozinhar melhor hoje
                </LpCheckoutLink>
              </div>
              <p className="lp-microcopy">Menos que um delivery. Você libera agora nesta página.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-section lp-section--recipe" aria-label="Demonstração de receita">
        <div className="lp-recipe">
          <div className="lp-recipe__media">
            <div className="lp-recipe__frame">
              <LpAutoVideo src={RECIPE_VIDEO_SRC} className="lp-recipe__video" />
            </div>
          </div>

          <div className="lp-recipe__copy">
            <p className="lp-section-label">Olha só</p>
            <h2>Isso aqui você faz em casa. E está no guia</h2>
            <p className="lp-section__lead">
              Crocante, leve e com cara de comida de verdade. É o tipo de receita que salva a noite
              de semana: rápida, gostosa e sem bagunça. No ebook, você encontra o passo a passo
              completo para repetir.
            </p>
            <ul className="lp-recipe__points">
              <li>Dá água na boca de verdade</li>
              <li>Fácil o bastante para fazer cansada</li>
              <li>Mais 49 opções esperando por você</li>
            </ul>
            <LpCheckoutLink className="lp-cta lp-cta--full">Quero as 50 receitas</LpCheckoutLink>
          </div>
        </div>
      </section>

      <section id="o-que-recebe" className="lp-section">
        <div className="lp-wrap">
          <p className="lp-section-label">Por que vale a pena</p>
          <h2>Mais sabor na rotina, menos estresse na cozinha</h2>
          <p className="lp-section__lead">
            Feito para quem quer comer bem sem virar chef e sem perder a noite inteira no fogão.
          </p>
          <ul className="lp-benefits">
            {BENEFITS.map((item, index) => (
              <li key={item.title}>
                <span className="lp-benefits__num">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <LpTestimonials {...AIR_FRYER_REVIEWS} />

      <section id="checkout" className="lp-section lp-section--checkout">
        <div className="lp-checkout">
          <div className="lp-checkout__intro">
            <p className="lp-section-label">Garanta o seu</p>
            <h2>Leve as 50 receitas agora</h2>
            <p className="lp-checkout__promise">
              Nome, e-mail e CPF. Paga no PIX e o guia aparece aqui na hora.
            </p>
            <div className="lp-checkout__deal">
              <div>
                <span className="lp-checkout__deal-label">Investimento de hoje</span>
                <p className="lp-checkout__deal-price">{price}</p>
              </div>
              <ul className="lp-checkout__deal-list">
                <li>50 receitas</li>
                <li>Só paga uma vez</li>
                <li>Libera na hora</li>
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

      <section className="lp-section lp-section--faq">
        <div className="lp-wrap">
          <p className="lp-section-label">Ainda com dúvida?</p>
          <h2>A gente responde antes de você comprar</h2>
          <p className="lp-section__lead">
            Tudo o que costuma travar na hora de decidir, bem direto.
          </p>
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
          <div className="lp-faq__cta">
            <LpCheckoutLink className="lp-cta lp-cta--full">Quero o meu por {price}</LpCheckoutLink>
          </div>
        </div>
      </section>

      <LpStickyCta priceCents={product.priceCents} />
    </LpShell>
  );
}
