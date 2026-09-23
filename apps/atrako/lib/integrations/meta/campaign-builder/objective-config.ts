/**
 * UI objectives → Meta Marketing API OUTCOME_* + goals/CTAs compatíveis.
 */

export type UiObjective =
  | "TRAFFIC"
  | "LEADS"
  | "SALES"
  | "AWARENESS"
  | "ENGAGEMENT"
  | "APP";

export type ObjectiveConfig = {
  ui: UiObjective;
  label: string;
  metaObjective: string;
  optimizationGoals: Array<{ value: string; label: string }>;
  billingEvent: string;
  destinations: Array<{ value: string; label: string }>;
  ctas: Array<{ value: string; label: string }>;
  needsPixel: boolean;
};

export const OBJECTIVE_CONFIG: Record<UiObjective, ObjectiveConfig> = {
  TRAFFIC: {
    ui: "TRAFFIC",
    label: "Tráfego",
    metaObjective: "OUTCOME_TRAFFIC",
    optimizationGoals: [
      { value: "LANDING_PAGE_VIEWS", label: "Visualizações da página de destino" },
      { value: "LINK_CLICKS", label: "Cliques no link" },
      { value: "IMPRESSIONS", label: "Impressões" },
    ],
    billingEvent: "IMPRESSIONS",
    destinations: [
      { value: "WEBSITE", label: "Site" },
      { value: "WHATSAPP", label: "WhatsApp" },
    ],
    ctas: [
      { value: "LEARN_MORE", label: "Saiba mais" },
      { value: "SHOP_NOW", label: "Comprar agora" },
      { value: "SIGN_UP", label: "Cadastre-se" },
      { value: "CONTACT_US", label: "Fale conosco" },
      { value: "WHATSAPP_MESSAGE", label: "Enviar mensagem WhatsApp" },
    ],
    needsPixel: false,
  },
  LEADS: {
    ui: "LEADS",
    label: "Leads",
    metaObjective: "OUTCOME_LEADS",
    optimizationGoals: [
      { value: "LEAD_GENERATION", label: "Leads (formulário)" },
      { value: "OFFSITE_CONVERSIONS", label: "Conversões no site" },
      { value: "QUALITY_LEAD", label: "Leads de qualidade" },
    ],
    billingEvent: "IMPRESSIONS",
    destinations: [
      { value: "WEBSITE", label: "Site" },
      { value: "ON_AD", label: "Formulário no anúncio" },
    ],
    ctas: [
      { value: "SIGN_UP", label: "Cadastre-se" },
      { value: "LEARN_MORE", label: "Saiba mais" },
      { value: "APPLY_NOW", label: "Candidate-se" },
      { value: "GET_QUOTE", label: "Pedir orçamento" },
    ],
    needsPixel: true,
  },
  SALES: {
    ui: "SALES",
    label: "Vendas",
    metaObjective: "OUTCOME_SALES",
    optimizationGoals: [
      { value: "OFFSITE_CONVERSIONS", label: "Conversões" },
      { value: "VALUE", label: "Valor da conversão" },
      { value: "LINK_CLICKS", label: "Cliques no link" },
    ],
    billingEvent: "IMPRESSIONS",
    destinations: [{ value: "WEBSITE", label: "Site" }],
    ctas: [
      { value: "SHOP_NOW", label: "Comprar agora" },
      { value: "LEARN_MORE", label: "Saiba mais" },
      { value: "ORDER_NOW", label: "Peça agora" },
    ],
    needsPixel: true,
  },
  AWARENESS: {
    ui: "AWARENESS",
    label: "Reconhecimento",
    metaObjective: "OUTCOME_AWARENESS",
    optimizationGoals: [
      { value: "REACH", label: "Alcance" },
      { value: "IMPRESSIONS", label: "Impressões" },
      { value: "AD_RECALL_LIFT", label: "Recall da marca" },
    ],
    billingEvent: "IMPRESSIONS",
    destinations: [{ value: "WEBSITE", label: "Site" }],
    ctas: [{ value: "LEARN_MORE", label: "Saiba mais" }],
    needsPixel: false,
  },
  ENGAGEMENT: {
    ui: "ENGAGEMENT",
    label: "Engajamento",
    metaObjective: "OUTCOME_ENGAGEMENT",
    optimizationGoals: [
      { value: "POST_ENGAGEMENT", label: "Engajamento com a publicação" },
      { value: "PAGE_LIKES", label: "Curtidas na Página" },
      { value: "THRUPLAY", label: "ThruPlay (vídeo)" },
    ],
    billingEvent: "IMPRESSIONS",
    destinations: [{ value: "ON_AD", label: "No anúncio" }],
    ctas: [
      { value: "LIKE_PAGE", label: "Curtir Página" },
      { value: "LEARN_MORE", label: "Saiba mais" },
      { value: "WATCH_MORE", label: "Assistir mais" },
    ],
    needsPixel: false,
  },
  APP: {
    ui: "APP",
    label: "Promoção de aplicativo",
    metaObjective: "OUTCOME_APP_PROMOTION",
    optimizationGoals: [
      { value: "APP_INSTALLS", label: "Instalações" },
      { value: "LINK_CLICKS", label: "Cliques no link" },
    ],
    billingEvent: "IMPRESSIONS",
    destinations: [{ value: "APP", label: "App" }],
    ctas: [
      { value: "INSTALL_APP", label: "Instalar app" },
      { value: "DOWNLOAD", label: "Baixar" },
      { value: "USE_APP", label: "Usar app" },
    ],
    needsPixel: false,
  },
};

export const SPECIAL_AD_CATEGORIES = [
  { value: "", label: "Não se aplica" },
  { value: "CREDIT", label: "Crédito" },
  { value: "EMPLOYMENT", label: "Emprego" },
  { value: "HOUSING", label: "Habitação" },
  { value: "ISSUES_ELECTIONS_POLITICS", label: "Questões sociais, eleições ou política" },
] as const;

export const BID_STRATEGIES = [
  { value: "LOWEST_COST_WITHOUT_CAP", label: "Menor custo" },
  { value: "COST_CAP", label: "Limite de custo" },
  { value: "LOWEST_COST_WITH_BID_CAP", label: "Limite de lance" },
] as const;

export function getObjectiveConfig(ui: UiObjective): ObjectiveConfig {
  return OBJECTIVE_CONFIG[ui];
}

export function getAvailableOptimizationGoals(ui: UiObjective) {
  return OBJECTIVE_CONFIG[ui].optimizationGoals;
}

export function getAvailableCtas(ui: UiObjective) {
  return OBJECTIVE_CONFIG[ui].ctas;
}

export function listUiObjectives() {
  return (Object.keys(OBJECTIVE_CONFIG) as UiObjective[]).map((ui) => ({
    value: ui,
    label: OBJECTIVE_CONFIG[ui].label,
  }));
}
