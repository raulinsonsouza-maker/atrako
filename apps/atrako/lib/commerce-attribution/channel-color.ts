const CHANNEL_TOKEN: Record<string, string> = {
  meta_ads: "--channel-meta-ads",
  google_ads: "--channel-google-ads",
  instagram: "--channel-instagram",
  facebook: "--channel-facebook",
  google_organic: "--channel-google-organic",
  email: "--channel-email",
  whatsapp: "--channel-whatsapp",
  direct: "--channel-direct",
  referral: "--channel-referral",
  MERCADO_LIVRE: "--channel-mercado-livre",
  SHOPEE: "--channel-shopee",
  TIKTOK_SHOP: "--channel-tiktok",
};

/** Cor do canal (`orderOriginKey` / canal do lead) como `var(--channel-*)`; null sem cor própria. */
export function channelColor(key: string | null | undefined): string | null {
  const token = key ? CHANNEL_TOKEN[key] : undefined;
  return token ? `var(${token})` : null;
}
