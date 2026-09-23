/**
 * Meta Pixel / CAPI helpers (browser snippet + event shape).
 * pixelId / capiToken vêm de WorkspaceSettings.tracking (Config).
 * Doc: https://developers.facebook.com/docs/meta-pixel
 */

export function buildMetaPixelSnippet(pixelId: string) {
  const id = pixelId.trim();
  if (!id) return null;
  return {
    pixelId: id,
    noscriptSrc: `https://www.facebook.com/tr?id=${encodeURIComponent(id)}&ev=PageView&noscript=1`,
  };
}
