/**
 * Instagram OAuth / long-lived token — conectado em /config/conexoes.
 * Rotas HTTP: /api/atrako/oauth/instagram/*
 * Doc: https://developers.facebook.com/docs/instagram-basic-display-api/guides/getting-access-tokens-and-permissions
 */
export const IG_OAUTH_SCOPES = [
  "instagram_basic",
  "instagram_manage_messages",
  "pages_show_list",
  "pages_read_engagement",
].join(",");
