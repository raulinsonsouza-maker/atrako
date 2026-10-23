import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadGeoContext } from "@/lib/geo-hub/request";
import { siteOrigin } from "@/lib/geo-hub/site";

type Props = { params: Promise<{ host: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const ctx = await loadGeoContext((await params).host);
  if (!ctx) return {};
  const url = `${siteOrigin(ctx.site)}/privacidade`;
  return {
    title: `Privacidade e cookies | ${ctx.facts.brand}`,
    description: `Como a ${ctx.facts.brand} trata os dados enviados nos formulários e os cookies usados neste site.`,
    alternates: { canonical: url },
    robots: ctx.linker.preview ? { index: false, follow: false } : { index: true, follow: true },
  };
}

/** Política de privacidade (LGPD) e de cookies do domínio do cliente. */
export default async function GeoPrivacyPage({ params }: Props) {
  const ctx = await loadGeoContext((await params).host);
  if (!ctx) notFound();
  const { facts, tracking } = ctx;
  const brand = facts.brand;
  const email = facts.contact.email;
  const controller = [facts.legalName || brand, facts.cnpj ? `CNPJ ${facts.cnpj}` : null].filter(Boolean).join(", ");

  return (
    <article className="geo-wrap geo-article">
      <header className="geo-hero">
        <h1 className="type-display-lg">Privacidade e cookies</h1>
        <p className="type-lead-airy text-[var(--ink-muted-80)]">
          Como a {brand} usa os dados que você envia neste site e quais cookies ele utiliza.
        </p>
      </header>
      <div className="geo-prose type-body">
        <h2>Quem é o responsável</h2>
        <p>
          O controlador dos dados é {controller}.{email ? <> Para qualquer pedido sobre seus dados, escreva para <a href={`mailto:${email}`}>{email}</a>.</> : null}
        </p>

        <h2>Quais dados coletamos</h2>
        <p>
          Quando você preenche o formulário, recebemos nome, WhatsApp, e-mail, cidade, estado e as respostas que você escolher
          informar (como faixa de investimento e como conheceu a {brand}). Também registramos a página por onde você chegou e a
          origem da visita (por exemplo, um buscador ou um assistente de IA).
        </p>

        <h2>Para que usamos</h2>
        <ul>
          <li>Entrar em contato pelo WhatsApp e e-mail informados para apresentar a franquia e as condições.</li>
          <li>Enviar materiais sobre a oportunidade, que você pode deixar de receber a qualquer momento.</li>
          <li>Entender quais conteúdos e canais trazem interessados, para melhorar o site.</li>
        </ul>
        <p>
          A base legal é o seu pedido de contato (procedimentos preliminares a um contrato) e o legítimo interesse em medir a
          origem das visitas. Os cookies de medição de terceiros dependem do seu consentimento.
        </p>

        <h2>Cookies</h2>
        <ul>
          <li>
            <strong>atk_ft</strong> (essencial, 90 dias): guarda a primeira origem da sua visita para que o contato chegue à
            equipe com o contexto certo. Não é compartilhado com terceiros.
          </li>
          <li>
            <strong>atk_consent</strong> (essencial): guarda sua escolha sobre cookies.
          </li>
          {tracking?.pixelId ? (
            <li>
              <strong>Pixel da Meta</strong> (medição, só com consentimento): mede os resultados dos anúncios. Quando você envia o
              formulário, nome, e-mail, telefone, cidade e estado são enviados à Meta de forma criptografada (hash) pela API de
              Conversões.
            </li>
          ) : null}
          {tracking?.ga4MeasurementId ? (
            <li>
              <strong>Google Analytics</strong> (medição, só com consentimento): estatísticas de acesso às páginas.
            </li>
          ) : null}
        </ul>

        <h2>Seus direitos</h2>
        <p>
          Você pode pedir acesso, correção ou exclusão dos seus dados e a interrupção dos contatos a qualquer momento
          {email ? <>, pelo e-mail <a href={`mailto:${email}`}>{email}</a></> : null}. Os dados ficam armazenados com segurança e
          só a equipe da {brand} e os fornecedores necessários à operação (como o serviço de WhatsApp) têm acesso.
        </p>
      </div>
    </article>
  );
}
