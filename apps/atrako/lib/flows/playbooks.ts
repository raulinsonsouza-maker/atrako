/**
 * Fluxos padrão (ligados assim que o Resend tem domínio verificado) + biblioteca de copy pt-BR por tom.
 * Passos WA usam template por `purpose` (só saem quando APPROVED) e têm e-mail alternativo.
 * Texto padrão só é atualizado em passos não personalizados (`customized=false`).
 */

import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma";
import { loadEmailTheme, type EmailTone } from "@/lib/flows/theme";
import type { EmailBlock, EmailContent, WhatsAppContent } from "@/lib/flows/types";
import { FRANCHISE_PLAYBOOKS } from "@/lib/flows/playbooks-franchise";

const H = 60;
const D = 24 * H;

type Tone = EmailTone;
type ByTone = { proximo: string; neutro?: string; formal?: string };
const pick = (tone: Tone, v: ByTone) => (tone === "formal" ? v.formal ?? v.neutro : tone === "neutro" ? v.neutro : undefined) ?? v.proximo;

type StepDef = {
  copyKey: string;
  delayMinutes: number;
  channel: "EMAIL" | "WHATSAPP";
  enabled?: boolean;
  conditions?: Record<string, unknown>;
  email?: (tone: Tone) => EmailContent;
  whatsapp?: (tone: Tone) => WhatsAppContent;
};

export type PlaybookDef = {
  key: string;
  name: string;
  description: string;
  trigger: string;
  priority: number;
  settings?: Record<string, unknown>;
  /** Nasce pausado mesmo quando os demais nascem ativos (texto novo para revisar). */
  defaultStatus?: "PAUSED";
  steps: StepDef[];
};

const greet = (tone: Tone) => pick(tone, { proximo: "Oi, {{primeiro_nome}}!", neutro: "Olá, {{primeiro_nome}}.", formal: "Olá, {{primeiro_nome}}." });

function email(subject: string, preheader: string, blocks: EmailBlock[]): EmailContent {
  return { subject, preheader, blocks };
}

const cartEmail1 = (tone: Tone) =>
  email(
    pick(tone, { proximo: "{{primeiro_nome}}, esqueceu algo?", neutro: "Seus itens estão esperando", formal: "Seu carrinho foi salvo" }),
    "Separamos os itens do seu carrinho",
    [
      { type: "heading", text: pick(tone, { proximo: "Esqueceu algo?", neutro: "Seu carrinho está salvo", formal: "Seu carrinho está salvo" }) },
      {
        type: "text",
        text: `${greet(tone)} ${pick(tone, {
          proximo: "Você deixou uns itens no carrinho da {{loja}}. Guardamos tudo pra você terminar quando quiser.",
          neutro: "Os itens que você escolheu na {{loja}} continuam no carrinho.",
          formal: "Os produtos selecionados na {{loja}} permanecem reservados no seu carrinho.",
        })}`,
      },
      { type: "items" },
      { type: "button", label: "Finalizar compra" },
      { type: "recommendations", title: "Você também pode gostar", limit: 3 },
      { type: "signature" },
    ],
  );

const cartEmail2 = (tone: Tone) =>
  email(
    pick(tone, { proximo: "Ficou alguma dúvida, {{primeiro_nome}}?", neutro: "Podemos ajudar com seu pedido?", formal: "Podemos auxiliar na sua compra?" }),
    "Troca fácil, entrega segura e atendimento de verdade",
    [
      { type: "heading", text: pick(tone, { proximo: "Bora terminar?", neutro: "Ainda dá tempo", formal: "Seus itens continuam disponíveis" }) },
      {
        type: "text",
        text: pick(tone, {
          proximo: "Se ficou alguma dúvida sobre tamanho, entrega ou pagamento, é só responder este e-mail. A gente responde rapidinho.",
          neutro: "Se tiver dúvidas sobre entrega, trocas ou pagamento, responda este e-mail que ajudamos.",
          formal: "Caso tenha dúvidas sobre entrega, trocas ou formas de pagamento, responda esta mensagem e nossa equipe retornará.",
        }),
      },
      { type: "items" },
      { type: "button", label: "Voltar ao carrinho" },
      { type: "signature" },
    ],
  );

const cartEmail3 = (tone: Tone) =>
  email(
    pick(tone, { proximo: "Um presente pra você terminar sua compra", neutro: "Cupom para concluir sua compra", formal: "Condição especial para concluir sua compra" }),
    "Cupom válido por pouco tempo",
    [
      { type: "heading", text: pick(tone, { proximo: "Última chamada!", neutro: "Última chance", formal: "Condição especial" }) },
      {
        type: "text",
        text: pick(tone, {
          proximo: "Pra te ajudar a decidir, liberamos um cupom. Mas corre que ele vale por pouco tempo.",
          neutro: "Liberamos um cupom para você concluir a compra. Ele vale por tempo limitado.",
          formal: "Disponibilizamos um cupom para a conclusão do seu pedido, válido por tempo limitado.",
        }),
      },
      { type: "coupon" },
      { type: "items" },
      { type: "button", label: "Usar cupom" },
      { type: "signature" },
    ],
  );

const unpaidEmail = (tone: Tone, final: boolean) =>
  email(
    final ? "Seu pedido será cancelado em breve" : "Seu pagamento ainda está pendente",
    "Finalize o pagamento para garantirmos seu pedido",
    [
      { type: "heading", text: final ? "Último aviso" : "Falta só o pagamento" },
      {
        type: "text",
        text: `${greet(tone)} ${
          final
            ? "O prazo de pagamento do seu pedido {{total}} está acabando. Depois disso ele é cancelado automaticamente."
            : "Recebemos seu pedido de {{total}}, mas o pagamento ainda não foi confirmado. Se você já pagou, desconsidere."
        }`,
      },
      { type: "items" },
      { type: "button", label: "Pagar agora" },
      { type: "signature" },
    ],
  );

const recEmail = (subject: string, preheader: string, heading: string, text: string, button: string, opts?: { coupon?: boolean; items?: boolean; recs?: string }) =>
  email(subject, preheader, [
    { type: "heading", text: heading },
    { type: "text", text },
    ...(opts?.items ? [{ type: "items" } as EmailBlock] : []),
    ...(opts?.coupon ? [{ type: "coupon" } as EmailBlock] : []),
    { type: "button", label: button },
    ...(opts?.recs ? [{ type: "recommendations", title: opts.recs, limit: 3 } as EmailBlock] : []),
    { type: "signature" },
  ]);

const wa = (purpose: string, fallbackEmail?: EmailContent): WhatsAppContent => ({
  purpose,
  fallbackToEmail: Boolean(fallbackEmail),
  ...(fallbackEmail ? { fallbackEmail } : {}),
});

export const PLAYBOOKS: PlaybookDef[] = [
  {
    key: "cart_abandoned",
    name: "Carrinho abandonado",
    description: "1h WhatsApp · 2h e-mail · 24h e-mail · 48h e-mail + WhatsApp com cupom",
    trigger: "cart_abandoned",
    priority: 10,
    steps: [
      { copyKey: "cart.wa1", delayMinutes: 0, channel: "WHATSAPP", conditions: { requiresPhone: true }, whatsapp: () => wa("cart_1") },
      { copyKey: "cart.email1", delayMinutes: 1 * H, channel: "EMAIL", email: cartEmail1 },
      { copyKey: "cart.email2", delayMinutes: 23 * H, channel: "EMAIL", email: cartEmail2 },
      { copyKey: "cart.email3", delayMinutes: 47 * H, channel: "EMAIL", email: cartEmail3 },
      {
        copyKey: "cart.wa_coupon",
        delayMinutes: 47 * H + 2 * H,
        channel: "WHATSAPP",
        conditions: { requiresPhone: true, requiresCoupon: true },
        whatsapp: () => wa("cart_coupon"),
      },
    ],
  },
  {
    key: "cart_aging_30",
    name: "Carrinho sem compra há 30 dias",
    description: "E-mail com os itens que ficaram e produtos parecidos",
    trigger: "cart_aging_30",
    priority: 12,
    defaultStatus: "PAUSED",
    steps: [
      {
        copyKey: "aging30.email1",
        delayMinutes: 0,
        channel: "EMAIL",
        email: (t) =>
          email(
            pick(t, { proximo: "{{primeiro_nome}}, seus itens ainda estão aqui", neutro: "Seus itens ainda estão aqui", formal: "Os itens que você escolheu continuam disponíveis" }),
            "Separamos de novo o que você escolheu",
            [
              { type: "heading", text: pick(t, { proximo: "Ainda pensando?", neutro: "Seus itens ainda estão aqui", formal: "Seus itens continuam disponíveis" }) },
              {
                type: "text",
                text: `${greet(t)} ${pick(t, {
                  proximo: "Faz um mês que você deixou estes itens na {{loja}}. Ainda dá tempo de levar.",
                  neutro: "Os itens que você escolheu na {{loja}} há um mês continuam disponíveis.",
                  formal: "Os produtos que você selecionou na {{loja}} continuam disponíveis.",
                })}`,
              },
              { type: "items" },
              { type: "button", label: "Ver meus itens" },
              { type: "recommendations", title: "Parecidos com o que você escolheu", limit: 3 },
              { type: "signature" },
            ],
          ),
      },
    ],
  },
  {
    key: "cart_aging_60",
    name: "Carrinho sem compra há 60 dias",
    description: "E-mail com novidades e mais vendidos; cupom leve se houver cupom confirmado",
    trigger: "cart_aging_60",
    priority: 14,
    defaultStatus: "PAUSED",
    steps: [
      {
        copyKey: "aging60.email1",
        delayMinutes: 0,
        channel: "EMAIL",
        email: (t) =>
          email(
            pick(t, { proximo: "{{primeiro_nome}}, olha o que chegou na {{loja}}", neutro: "Novidades desde a sua última visita", formal: "Novidades da {{loja}} para você" }),
            "Novidades e os mais vendidos do mês",
            [
              { type: "heading", text: pick(t, { proximo: "Tem novidade por aqui", neutro: "Novidades para você", formal: "Novidades selecionadas" }) },
              {
                type: "text",
                text: `${greet(t)} ${pick(t, {
                  proximo: "Desde que você passou pela {{loja}}, chegou muita coisa. Separamos os mais vendidos e o que você tinha escolhido.",
                  neutro: "Separamos as novidades e os mais vendidos da {{loja}}, junto com os itens que você escolheu.",
                  formal: "Selecionamos as novidades e os produtos mais procurados da {{loja}}, além dos itens que você escolheu.",
                })}`,
              },
              { type: "items" },
              { type: "coupon" },
              { type: "button", label: "Ver novidades" },
              { type: "recommendations", title: "Mais vendidos", limit: 3 },
              { type: "signature" },
            ],
          ),
      },
    ],
  },
  {
    key: "cart_aging_90",
    name: "Carrinho sem compra há 90 dias",
    description: "Itens, cupom se houver cupom confirmado e convite para contar por que não comprou",
    trigger: "cart_aging_90",
    priority: 16,
    defaultStatus: "PAUSED",
    steps: [
      {
        copyKey: "aging90.email1",
        delayMinutes: 0,
        channel: "EMAIL",
        email: (t) =>
          email(
            pick(t, { proximo: "{{primeiro_nome}}, ainda quer esses itens?", neutro: "Seus itens continuam aqui", formal: "Seus itens na {{loja}}" }),
            "Seus itens e uma pergunta rápida",
            [
              { type: "heading", text: pick(t, { proximo: "Ainda dá tempo", neutro: "Seus itens continuam aqui", formal: "Seus itens continuam disponíveis" }) },
              {
                type: "text",
                text: `${greet(t)} ${pick(t, {
                  proximo: "O que você escolheu na {{loja}} ainda está aqui. E se algo te fez desistir, responde este e-mail contando. A gente lê tudo.",
                  neutro: "Os itens que você escolheu na {{loja}} continuam disponíveis. Se algo fez você desistir, responda este e-mail: queremos entender.",
                  formal: "Os produtos que você selecionou na {{loja}} continuam disponíveis. Caso algo tenha impedido a compra, responda esta mensagem; sua opinião é importante.",
                })}`,
              },
              { type: "coupon" },
              { type: "items" },
              { type: "button", label: "Ver meus itens" },
              { type: "signature" },
            ],
          ),
      },
    ],
  },
  {
    key: "order_unpaid",
    name: "Pedido não pago",
    description: "Pix/boleto: WhatsApp transacional · 6h e-mail · 24h último aviso",
    trigger: "order_unpaid",
    priority: 5,
    steps: [
      { copyKey: "unpaid.wa1", delayMinutes: 0, channel: "WHATSAPP", whatsapp: (t) => wa("order_unpaid", unpaidEmail(t, false)) },
      { copyKey: "unpaid.email1", delayMinutes: 5 * H, channel: "EMAIL", email: (t) => unpaidEmail(t, false) },
      { copyKey: "unpaid.email2", delayMinutes: 23 * H, channel: "EMAIL", email: (t) => unpaidEmail(t, true) },
    ],
  },
  {
    key: "order_paid",
    name: "Pós-compra",
    description: "Agradecimento (desligado) · 7 dias avaliação · 10 dias pergunta o aniversário (WhatsApp) · 15 dias cross-sell",
    trigger: "order_paid",
    priority: 20,
    steps: [
      {
        copyKey: "paid.thanks",
        delayMinutes: 30,
        channel: "EMAIL",
        enabled: false,
        email: (t) =>
          recEmail(
            "Obrigado pela compra, {{primeiro_nome}}!",
            "Seu pedido já está com a gente",
            pick(t, { proximo: "Valeu demais!", neutro: "Obrigado pela compra", formal: "Agradecemos a sua compra" }),
            "Seu pedido na {{loja}} foi confirmado. Avisaremos cada etapa até chegar em você.",
            "Ver a loja",
            { items: true },
          ),
      },
      {
        copyKey: "paid.review",
        delayMinutes: 7 * D,
        channel: "EMAIL",
        email: (t) =>
          recEmail(
            pick(t, { proximo: "E aí, curtiu, {{primeiro_nome}}?", neutro: "Como foi sua experiência?", formal: "Sua opinião é importante" }),
            "Conte pra gente o que achou",
            "O que você achou?",
            pick(t, {
              proximo: "Sua opinião ajuda muito a {{loja}} e outros clientes. Leva menos de um minuto.",
              neutro: "Sua avaliação ajuda a {{loja}} a melhorar e orienta outros clientes.",
              formal: "Sua avaliação contribui para a melhoria contínua da {{loja}}.",
            }),
            "Avaliar minha compra",
            { items: true },
          ),
      },
      {
        copyKey: "paid.birthday_ask",
        delayMinutes: 10 * D,
        channel: "WHATSAPP",
        conditions: { requiresPhone: true, skipIfHasBirthday: true },
        whatsapp: () => wa("birthday_ask"),
      },
      {
        copyKey: "paid.crosssell",
        delayMinutes: 15 * D,
        channel: "EMAIL",
        email: (t) =>
          recEmail(
            pick(t, { proximo: "Combina com o que você comprou", neutro: "Selecionamos para você", formal: "Sugestões selecionadas para você" }),
            "Produtos que combinam com sua última compra",
            "Feito pra combinar",
            "Separamos alguns produtos que combinam com a sua última compra na {{loja}}.",
            "Ver na loja",
            { recs: "Combina com você" },
          ),
      },
    ],
  },
  {
    key: "second_purchase",
    name: "Segunda compra",
    description: "Cupom de fidelidade no intervalo típico de recompra da loja",
    trigger: "second_purchase",
    priority: 25,
    settings: { delayFromStoreInterval: true },
    steps: [
      {
        copyKey: "second.email1",
        delayMinutes: 21 * D,
        channel: "EMAIL",
        email: (t) =>
          recEmail(
            pick(t, { proximo: "{{primeiro_nome}}, um mimo pra sua próxima compra", neutro: "Um cupom para sua próxima compra", formal: "Benefício exclusivo para sua próxima compra" }),
            "Cupom de fidelidade",
            pick(t, { proximo: "Bora pra segunda?", neutro: "Obrigado por escolher a {{loja}}", formal: "Obrigado pela preferência" }),
            "Como agradecimento pela sua primeira compra, liberamos um cupom para a próxima.",
            "Usar meu cupom",
            { coupon: true, recs: "Mais vendidos" },
          ),
      },
      {
        copyKey: "second.wa1",
        delayMinutes: 24 * D,
        channel: "WHATSAPP",
        conditions: { requiresPhone: true, skipIfClickedPrevious: true, requiresCoupon: true },
        whatsapp: () => wa("second_purchase"),
      },
    ],
  },
  {
    key: "repurchase_due",
    name: "Recompra",
    description: "Lembrete com o mesmo produto na data prevista",
    trigger: "repurchase_due",
    priority: 30,
    steps: [
      {
        copyKey: "repurchase.email1",
        delayMinutes: 0,
        channel: "EMAIL",
        email: (t) =>
          recEmail(
            pick(t, { proximo: "Tá na hora de repor, {{primeiro_nome}}?", neutro: "Hora de repor {{produto}}?", formal: "Lembrete de reposição" }),
            "Compre de novo em um clique",
            "Hora de repor?",
            "Pelo tempo desde a sua última compra, talvez esteja na hora de repor.",
            "Comprar de novo",
            { items: true, recs: "Aproveite também" },
          ),
      },
      {
        copyKey: "repurchase.wa1",
        delayMinutes: 3 * D,
        channel: "WHATSAPP",
        conditions: { requiresPhone: true, skipIfClickedPrevious: true },
        whatsapp: () => wa("repurchase"),
      },
    ],
  },
  {
    key: "winback",
    name: "Win-back",
    description: "Em risco/Inativo: três e-mails e um WhatsApp, cupom maior no último",
    trigger: "winback",
    priority: 40,
    settings: { dailyEnrollCap: 300 },
    steps: [
      {
        copyKey: "winback.email1",
        delayMinutes: 0,
        channel: "EMAIL",
        email: (t) =>
          recEmail(
            pick(t, { proximo: "Sentimos sua falta, {{primeiro_nome}}", neutro: "Faz tempo que você não aparece", formal: "Novidades da {{loja}} para você" }),
            "Veja o que chegou desde a sua última visita",
            pick(t, { proximo: "Que saudade!", neutro: "Temos novidades", formal: "Novidades selecionadas" }),
            "Muita coisa nova chegou na {{loja}} desde a sua última compra.",
            "Ver novidades",
            { recs: "Novidades e mais vendidos" },
          ),
      },
      {
        copyKey: "winback.email2",
        delayMinutes: 7 * D,
        channel: "EMAIL",
        email: (t) =>
          recEmail(
            "Os favoritos dos nossos clientes",
            "O que mais está saindo na loja",
            "Os mais amados",
            pick(t, { proximo: "Separamos o que a galera mais está comprando.", neutro: "Separamos os produtos mais vendidos.", formal: "Selecionamos os produtos mais procurados." }),
            "Ver mais vendidos",
            { recs: "Mais vendidos" },
          ),
      },
      {
        copyKey: "winback.wa1",
        delayMinutes: 10 * D,
        channel: "WHATSAPP",
        conditions: { requiresPhone: true, requiresCoupon: true },
        whatsapp: () => wa("winback"),
      },
      {
        copyKey: "winback.email3",
        delayMinutes: 14 * D,
        channel: "EMAIL",
        email: (t) =>
          recEmail(
            pick(t, { proximo: "{{primeiro_nome}}, esse cupom é pra você voltar", neutro: "Um cupom especial para você voltar", formal: "Condição especial de retorno" }),
            "Nosso maior desconto para você",
            "Volta pra gente?",
            "Liberamos nosso melhor cupom para você voltar a comprar na {{loja}}.",
            "Usar cupom",
            { coupon: true, recs: "Escolha o seu" },
          ),
      },
    ],
  },
  {
    key: "lead_lost",
    name: "Nutrição de Perdidos",
    description: "Quinzenal: conteúdo, prova social, cupom no 3º toque, WhatsApp uma vez",
    trigger: "lead_lost",
    priority: 50,
    settings: { dailyEnrollCap: 300 },
    steps: [
      {
        copyKey: "lost.email1",
        delayMinutes: 3 * D,
        channel: "EMAIL",
        email: () =>
          recEmail("O que está bombando na {{loja}}", "Os mais vendidos da semana", "Os mais vendidos", "Veja o que os clientes da {{loja}} mais estão levando.", "Ver produtos", { recs: "Mais vendidos" }),
      },
      {
        copyKey: "lost.email2",
        delayMinutes: 17 * D,
        channel: "EMAIL",
        email: (t) =>
          recEmail(
            "Por que nossos clientes voltam",
            "Entrega, troca fácil e atendimento",
            pick(t, { proximo: "Quem compra, volta", neutro: "Clientes satisfeitos", formal: "A confiança dos nossos clientes" }),
            "Entrega rápida, troca descomplicada e atendimento de verdade. É por isso que nossos clientes voltam.",
            "Conhecer a loja",
            { recs: "Favoritos" },
          ),
      },
      {
        copyKey: "lost.email3",
        delayMinutes: 31 * D,
        channel: "EMAIL",
        email: (t) =>
          recEmail(
            pick(t, { proximo: "{{primeiro_nome}}, um cupom pra você decidir", neutro: "Um cupom para sua primeira compra", formal: "Condição especial para você" }),
            "Cupom por tempo limitado",
            "Um empurrãozinho",
            "Para ajudar você a decidir, liberamos um cupom exclusivo.",
            "Usar cupom",
            { coupon: true, recs: "Escolha o seu" },
          ),
      },
      {
        copyKey: "lost.wa1",
        delayMinutes: 33 * D,
        channel: "WHATSAPP",
        conditions: { requiresPhone: true, skipIfClickedPrevious: true, requiresCoupon: true },
        whatsapp: () => wa("lost_nurture"),
      },
    ],
  },
  {
    key: "lead_welcome",
    name: "Boas-vindas",
    description: "Lead sem compra: cupom de primeira compra",
    trigger: "lead_welcome",
    priority: 45,
    steps: [
      {
        copyKey: "welcome.email1",
        delayMinutes: 5,
        channel: "EMAIL",
        email: (t) =>
          recEmail(
            pick(t, { proximo: "Boas-vindas à {{loja}}, {{primeiro_nome}}!", neutro: "Boas-vindas à {{loja}}", formal: "Seja bem-vindo(a) à {{loja}}" }),
            "Um presente para sua primeira compra",
            pick(t, { proximo: "Que bom ter você aqui!", neutro: "Boas-vindas", formal: "Seja bem-vindo(a)" }),
            "Para começar bem, liberamos um cupom para a sua primeira compra.",
            "Conhecer a loja",
            { coupon: true, recs: "Mais vendidos" },
          ),
      },
      {
        copyKey: "welcome.email2",
        delayMinutes: 3 * D,
        channel: "EMAIL",
        email: () =>
          recEmail("Os queridinhos da {{loja}}", "Comece pelos mais vendidos", "Comece por aqui", "Esses são os produtos que nossos clientes mais amam.", "Ver produtos", { recs: "Mais vendidos", coupon: true }),
      },
    ],
  },
  {
    key: "birthday",
    name: "Aniversário do cliente",
    description: "7 dias antes e-mail com cupom · no dia e-mail + WhatsApp · 3 dias depois lembrete",
    trigger: "date_based",
    priority: 15,
    settings: { dateKind: "BIRTHDAY", offsetDays: -7, sendHour: 9 },
    steps: [
      {
        copyKey: "birthday.before",
        delayMinutes: 0,
        channel: "EMAIL",
        email: (t) =>
          recEmail(
            pick(t, { proximo: "{{primeiro_nome}}, seu presente está chegando 🎁", neutro: "Seu presente de aniversário", formal: "Um presente pelo seu aniversário" }),
            "Cupom válido no mês do seu aniversário",
            "Seu mês chegou!",
            "Seu aniversário está chegando e a {{loja}} preparou um presente: um cupom válido no seu mês.",
            "Escolher meu presente",
            { coupon: true, recs: "Ideias de presente" },
          ),
      },
      {
        copyKey: "birthday.day",
        delayMinutes: 7 * D,
        channel: "EMAIL",
        email: (t) =>
          recEmail(
            "Feliz aniversário, {{primeiro_nome}}!",
            "Seu cupom de presente está te esperando",
            pick(t, { proximo: "Parabéns! 🎉", neutro: "Feliz aniversário", formal: "Feliz aniversário" }),
            "Hoje é seu dia! Aproveite seu cupom de presente na {{loja}}.",
            "Usar meu presente",
            { coupon: true },
          ),
      },
      {
        copyKey: "birthday.wa",
        delayMinutes: 7 * D + 3 * H,
        channel: "WHATSAPP",
        conditions: { requiresPhone: true, requiresCoupon: true },
        whatsapp: () => wa("birthday"),
      },
      {
        copyKey: "birthday.after",
        delayMinutes: 10 * D,
        channel: "EMAIL",
        conditions: { skipIfPurchased: true },
        email: () =>
          recEmail("Seu presente ainda está aqui", "O cupom de aniversário vale até o fim do mês", "Ainda dá tempo", "Seu cupom de aniversário continua valendo. Não deixa passar!", "Usar meu presente", { coupon: true }),
      },
    ],
  },
  {
    key: "first_purchase_anniversary",
    name: "Aniversário de cliente",
    description: "1 ano da primeira compra: agradecimento com mimo",
    trigger: "date_based",
    priority: 35,
    settings: { dateKind: "FIRST_ORDER", offsetDays: 0, sendHour: 10 },
    steps: [
      {
        copyKey: "anniversary.email",
        delayMinutes: 0,
        channel: "EMAIL",
        email: (t) =>
          recEmail(
            pick(t, { proximo: "Faz 1 ano que você chegou, {{primeiro_nome}}!", neutro: "1 ano com a {{loja}}", formal: "Obrigado por um ano de parceria" }),
            "Um mimo para comemorar",
            "Obrigado por esse ano!",
            "Há um ano você fez sua primeira compra na {{loja}}. Para comemorar, um mimo para você.",
            "Ver meu mimo",
            { coupon: true, recs: "Selecionados para você" },
          ),
      },
    ],
  },
];

export function playbookByKey(key: string | null | undefined) {
  if (!key) return null;
  return (
    PLAYBOOKS.find((p) => p.key === key) ??
    INSIDE_SALES_PLAYBOOKS.find((p) => p.key === key) ??
    STAY_PLAYBOOKS.find((p) => p.key === key) ??
    FRANCHISE_PLAYBOOKS.find((p) => p.key === key) ??
    null
  );
}

function stepContent(def: StepDef, tone: Tone) {
  if (def.channel === "EMAIL" && def.email) return def.email(tone);
  if (def.whatsapp) return def.whatsapp(tone);
  return {};
}

/** Boas-vindas e perda de inside sales: contato comercial, sem cupom de loja. */
export const INSIDE_SALES_PLAYBOOKS: PlaybookDef[] = [
  {
    key: "lead_welcome",
    name: "Boas-vindas",
    description: "Lead novo: a equipe entra em contato",
    trigger: "lead_welcome",
    priority: 45,
    steps: [
      {
        copyKey: "sales.welcome.email",
        delayMinutes: 5,
        channel: "EMAIL",
        email: (t) =>
          recEmail(
            pick(t, { proximo: "Recebemos seu contato, {{primeiro_nome}}", neutro: "Recebemos seu contato", formal: "Confirmamos o recebimento do seu contato" }),
            "A equipe vai falar com você",
            pick(t, { proximo: "Que bom ter você aqui", neutro: "Boas-vindas", formal: "Seja bem-vindo(a)" }),
            "Recebemos seu interesse. Alguém da equipe entra em contato para entender o que você precisa.",
            "Falar com a equipe",
          ),
      },
      {
        copyKey: "sales.welcome.wa",
        delayMinutes: 10,
        channel: "WHATSAPP",
        conditions: { requiresPhone: true },
        whatsapp: () => wa("sales_welcome"),
      },
    ],
  },
  {
    key: "lead_lost",
    name: "Lead perdido",
    description: "Depois da perda, um contato sem oferta de loja",
    trigger: "lead_lost",
    priority: 40,
    steps: [
      {
        copyKey: "sales.lost.email",
        delayMinutes: 2 * D,
        channel: "EMAIL",
        email: (t) =>
          recEmail(
            pick(t, { proximo: "{{primeiro_nome}}, seguimos por aqui", neutro: "Seguimos à disposição", formal: "Continuamos à disposição" }),
            "Se fizer sentido retomar, é só responder",
            "A conversa fica aberta",
            "Se o momento não era agora, tudo bem. Quando quiser retomar, responda esta mensagem.",
            "Retomar conversa",
          ),
      },
      {
        copyKey: "sales.lost.wa",
        delayMinutes: 3 * D,
        channel: "WHATSAPP",
        conditions: { requiresPhone: true },
        whatsapp: () => wa("sales_followup"),
      },
    ],
  },
];

const stayMail = (tone: Tone, subject: ByTone, preheader: string, heading: string, text: string, button: string) =>
  email(pick(tone, subject), preheader, [
    { type: "heading", text: heading },
    { type: "text", text: `${greet(tone)} ${text}` },
    { type: "button", label: button },
    { type: "signature" },
  ]);

export const STAY_PLAYBOOKS: PlaybookDef[] = [
  {
    key: "stay_unpaid",
    name: "Reserva sem pagamento",
    description: "WhatsApp na hora e e-mail enquanto as datas ainda estão separadas",
    trigger: "stay_unpaid",
    priority: 5,
    steps: [
      {
        copyKey: "stay.unpaid.wa",
        delayMinutes: 0,
        channel: "WHATSAPP",
        whatsapp: (t) => wa("stay_unpaid", stayMail(t, { proximo: "{{primeiro_nome}}, suas datas ainda estão separadas" }, "Conclua o pagamento para manter a estadia", "Falta o pagamento da reserva", "A estadia na {{loja}} continua separada até o pagamento de {{total}}. Se o prazo acabar, as noites voltam a ficar livres.", "Pagar reserva")),
      },
      {
        copyKey: "stay.unpaid.email",
        delayMinutes: 8,
        channel: "EMAIL",
        email: (t) =>
          stayMail(
            t,
            { proximo: "{{primeiro_nome}}, suas datas ainda estão separadas", neutro: "Sua reserva aguarda o pagamento", formal: "Sua reserva aguarda o pagamento" },
            "Conclua o pagamento para manter a estadia",
            "Falta o pagamento da reserva",
            "A estadia na {{loja}} continua separada até o pagamento de {{total}}. Se o prazo acabar, as noites voltam a ficar livres.",
            "Pagar reserva",
          ),
      },
    ],
  },
  {
    key: "stay_confirmed",
    name: "Reserva confirmada",
    description: "E-mail e WhatsApp assim que o pagamento entra",
    trigger: "stay_confirmed",
    priority: 6,
    steps: [
      {
        copyKey: "stay.confirmed.wa",
        delayMinutes: 0,
        channel: "WHATSAPP",
        whatsapp: (t) => wa("stay_confirmed", stayMail(t, { proximo: "Reserva confirmada no {{loja}}" }, "Sua estadia está garantida", "Sua reserva está confirmada", "O {{loja}} está reservado. O valor pago foi {{total}}.", "Ver reserva")),
      },
      {
        copyKey: "stay.confirmed.email",
        delayMinutes: 0,
        channel: "EMAIL",
        email: (t) =>
          stayMail(
            t,
            { proximo: "Reserva confirmada no {{loja}}", neutro: "Sua reserva está confirmada", formal: "Confirmamos a sua reserva" },
            "Sua estadia está garantida",
            "Sua reserva está confirmada",
            "O {{loja}} está reservado. O valor pago foi {{total}}.",
            "Ver reserva",
          ),
      },
    ],
  },
  {
    key: "stay_checkin",
    name: "Véspera do check-in",
    description: "Aviso no dia anterior à chegada",
    trigger: "stay_checkin",
    priority: 7,
    steps: [
      {
        copyKey: "stay.checkin.wa",
        delayMinutes: 0,
        channel: "WHATSAPP",
        whatsapp: (t) => wa("stay_checkin", stayMail(t, { proximo: "Amanhã é o check-in no {{loja}}" }, "Sua chegada é amanhã", "Seu check-in é amanhã", "Amanhã você entra no {{loja}}.", "Ver detalhes")),
      },
      {
        copyKey: "stay.checkin.email",
        delayMinutes: 0,
        channel: "EMAIL",
        email: (t) =>
          stayMail(
            t,
            { proximo: "Amanhã é o check-in no {{loja}}", neutro: "Seu check-in é amanhã", formal: "Lembrete de check-in" },
            "Sua chegada é amanhã",
            "Seu check-in é amanhã",
            "Amanhã você entra no {{loja}}.",
            "Ver detalhes",
          ),
      },
    ],
  },
  {
    key: "stay_checkout",
    name: "Manhã da saída",
    description: "Aviso no dia do check-out",
    trigger: "stay_checkout",
    priority: 8,
    steps: [
      {
        copyKey: "stay.checkout.wa",
        delayMinutes: 0,
        channel: "WHATSAPP",
        whatsapp: (t) => wa("stay_checkout", stayMail(t, { proximo: "Hoje é a saída do {{loja}}" }, "O check-out é hoje", "Hoje é o dia da saída", "A saída do {{loja}} é hoje.", "Ver reserva")),
      },
      {
        copyKey: "stay.checkout.email",
        delayMinutes: 0,
        channel: "EMAIL",
        email: (t) =>
          stayMail(
            t,
            { proximo: "Hoje é a saída do {{loja}}", neutro: "O check-out é hoje", formal: "Lembrete de check-out" },
            "O check-out é hoje",
            "Hoje é o dia da saída",
            "A saída do {{loja}} é hoje.",
            "Ver reserva",
          ),
      },
    ],
  },
  {
    key: "stay_thanks",
    name: "Depois da estadia",
    description: "Um obrigado no dia seguinte à saída, sem cupom",
    trigger: "stay_thanks",
    priority: 9,
    steps: [
      {
        copyKey: "stay.thanks.email",
        delayMinutes: 0,
        channel: "EMAIL",
        email: (t) =>
          stayMail(
            t,
            { proximo: "Obrigado por ficar no {{loja}}", neutro: "Obrigado pela estadia", formal: "Agradecemos a sua estadia" },
            "Foi um prazer receber você",
            "Obrigado pela estadia",
            "Esperamos você de volta no {{loja}} quando quiser repetir esses dias.",
            "Ver a casa",
          ),
      },
      {
        copyKey: "stay.thanks.wa",
        delayMinutes: 30,
        channel: "WHATSAPP",
        conditions: { requiresPhone: true },
        whatsapp: () => wa("stay_thanks"),
      },
    ],
  },
];

export function playbooksForEdition(edition: string | null | undefined): PlaybookDef[] {
  if (edition === "stay") return STAY_PLAYBOOKS;
  if (edition === "inside_sales") return INSIDE_SALES_PLAYBOOKS;
  if (edition === "food" || edition === "ecommerce") return PLAYBOOKS;
  return [...PLAYBOOKS, ...INSIDE_SALES_PLAYBOOKS, ...STAY_PLAYBOOKS];
}

export function flowKeysForPack(pack: string | null | undefined): string[] | null {
  if (pack === "stay") return STAY_PLAYBOOKS.map((p) => p.key);
  if (pack === "inside_sales") return [...INSIDE_SALES_PLAYBOOKS, ...FRANCHISE_PLAYBOOKS].map((p) => p.key);
  if (pack === "food" || pack === "ecommerce") return PLAYBOOKS.map((p) => p.key);
  return null;
}

/** Cria os fluxos padrão que faltam (idempotente). */
export async function ensureDefaultFlows(
  workspaceId: string,
  opts?: { status?: "ACTIVE" | "PAUSED"; playbooks?: PlaybookDef[] },
) {
  const list = opts?.playbooks ?? PLAYBOOKS;
  const { theme } = await loadEmailTheme(workspaceId);
  const tone = theme.tone;
  const existing = await prisma.messageFlow.findMany({
    where: { clienteId: workspaceId, key: { in: list.map((p) => p.key) } },
    select: { key: true },
  });
  const have = new Set(existing.map((f) => f.key));
  let created = 0;
  for (const p of list) {
    if (have.has(p.key)) continue;
    if (await createPlaybookFlow(workspaceId, p, tone, p.defaultStatus ?? opts?.status ?? "ACTIVE")) created++;
  }
  for (const p of list) {
    if (!p.key.startsWith("stay_")) continue;
    await prisma.messageFlow.updateMany({
      where: { clienteId: workspaceId, key: p.key, NOT: { trigger: p.trigger } },
      data: { trigger: p.trigger },
    });
  }
  await prisma.messageFlowStep.updateMany({
    where: {
      copyKey: "stay.unpaid.email",
      delayMinutes: 5 * 60,
      customized: false,
      flow: { clienteId: workspaceId, key: "stay_unpaid" },
    },
    data: { delayMinutes: 8 },
  });
  return { created };
}

async function createPlaybookFlow(workspaceId: string, p: PlaybookDef, tone: Tone, status: string) {
  try {
    await prisma.messageFlow.create({
      data: {
        clienteId: workspaceId,
        key: p.key,
        name: p.name,
        trigger: p.trigger,
        status,
        priority: p.priority,
        settings: (p.settings ?? {}) as Prisma.InputJsonValue,
        steps: {
          create: p.steps.map((s, i) => ({
            position: i,
            delayMinutes: s.delayMinutes,
            channel: s.channel,
            enabled: s.enabled ?? true,
            content: stepContent(s, tone) as Prisma.InputJsonValue,
            conditions: (s.conditions ?? {}) as Prisma.InputJsonValue,
            copyKey: s.copyKey,
            publishedAt: new Date(),
          })),
        },
      },
    });
    return true;
  } catch (err) {
    if ((err as { code?: string }).code !== "P2002") throw err;
    return false;
  }
}

/**
 * Janelas de carrinho passaram de +7/+30/+60 para +30/+60/+90: remove o fluxo de 7 dias (ou pausa, se
 * já matriculou alguém), reescreve o texto não personalizado de 30/60 e cria o de 90 pausado.
 */
export async function migrateAgingFlows(workspaceId: string) {
  const flows = await prisma.messageFlow.findMany({
    where: { clienteId: workspaceId, key: { in: ["cart_aging_7", "cart_aging_30", "cart_aging_60", "cart_aging_90"] } },
    select: { id: true, key: true, _count: { select: { enrollments: true } } },
  });
  if (!flows.length) return { removed: 0, paused: 0, rewritten: 0, created: 0 };
  const { theme } = await loadEmailTheme(workspaceId);
  let removed = 0;
  let paused = 0;
  let rewritten = 0;
  for (const f of flows) {
    if (f.key === "cart_aging_7") {
      if (f._count.enrollments) {
        await prisma.messageFlow.update({ where: { id: f.id }, data: { status: "PAUSED" } });
        paused++;
      } else {
        await prisma.messageFlow.delete({ where: { id: f.id } });
        removed++;
      }
      continue;
    }
    const def = playbookByKey(f.key!);
    if (!def) continue;
    const steps = await prisma.messageFlowStep.findMany({
      where: { flowId: f.id, customized: false },
      select: { id: true, copyKey: true },
    });
    for (const s of steps) {
      const stepDef = def.steps.find((d) => d.copyKey === s.copyKey) ?? (steps.length === 1 ? def.steps[0] : null);
      if (!stepDef) continue;
      await prisma.messageFlowStep.update({
        where: { id: s.id },
        data: { content: stepContent(stepDef, theme.tone) as Prisma.InputJsonValue, copyKey: stepDef.copyKey },
      });
      rewritten++;
    }
  }
  const have = new Set(flows.map((f) => f.key));
  let created = 0;
  for (const key of ["cart_aging_30", "cart_aging_60", "cart_aging_90"]) {
    const p = playbookByKey(key);
    if (p && !have.has(key) && (await createPlaybookFlow(workspaceId, p, theme.tone, "PAUSED"))) created++;
  }
  return { removed, paused, rewritten, created };
}

/** Tom de voz mudou: reescreve passos padrão não personalizados. */
export async function refreshDefaultCopy(workspaceId: string, tone?: Tone) {
  const t = tone ?? (await loadEmailTheme(workspaceId)).theme.tone;
  const steps = await prisma.messageFlowStep.findMany({
    where: { flow: { clienteId: workspaceId, key: { not: null } }, customized: false, copyKey: { not: null } },
    select: { id: true, copyKey: true, flow: { select: { key: true } } },
  });
  let updated = 0;
  for (const s of steps) {
    const def = playbookByKey(s.flow.key)?.steps.find((d) => d.copyKey === s.copyKey);
    if (!def) continue;
    await prisma.messageFlowStep.update({
      where: { id: s.id },
      data: { content: stepContent(def, t) as Prisma.InputJsonValue },
    });
    updated++;
  }
  return { updated };
}

/** Restaura um passo ao texto padrão. */
export async function resetStepCopy(workspaceId: string, stepId: string) {
  const s = await prisma.messageFlowStep.findFirst({
    where: { id: stepId, flow: { clienteId: workspaceId } },
    select: { id: true, copyKey: true, flow: { select: { key: true } } },
  });
  const def = s ? playbookByKey(s.flow.key)?.steps.find((d) => d.copyKey === s.copyKey) : null;
  if (!s || !def) return null;
  const { theme } = await loadEmailTheme(workspaceId);
  return prisma.messageFlowStep.update({
    where: { id: s.id },
    data: {
      content: stepContent(def, theme.tone) as Prisma.InputJsonValue,
      draftContent: Prisma.DbNull,
      customized: false,
      publishedAt: new Date(),
    },
  });
}
