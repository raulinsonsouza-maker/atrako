/** Catálogo canônico de apps da plataforma (sem server-only — seguro em testes). */

export const PLATFORM_APP_PROVIDERS = [
  "META",
  "GOOGLE",
  "GOOGLE_ADS",
  "GOOGLE_CALENDAR",
  "GOOGLE_ANALYTICS",
  "MERCADO_PAGO",
  "MERCADO_LIVRE",
  "LINKEDIN",
  "TIKTOK",
  "WOOCOMMERCE",
  "SHOPIFY",
  "SHOPEE",
  "TIKTOK_SHOP",
  "TRAY",
  "NUVEMSHOP",
  "RESEND",
  "AI_OPENROUTER",
  "AI_NVIDIA",
  "AI_KILO",
  "AI_OLLAMA",
  "AI_GROQ",
  "AI_COHERE",
] as const;

export type PlatformAppProvider = (typeof PLATFORM_APP_PROVIDERS)[number];

export function isPlatformAppProvider(value: string): value is PlatformAppProvider {
  return (PLATFORM_APP_PROVIDERS as readonly string[]).includes(value);
}
