/**
 * Posicionamentos canônicos Atrako: só Facebook + Instagram,
 * Feeds + Stories + Reels. Nada de Audience Network, Messenger, etc.
 */

export const ATRAKO_PUBLISHER_PLATFORMS = ["facebook", "instagram"] as const;

export type AtrakoPlacementKey =
  | "fb_feed"
  | "ig_feed"
  | "ig_stories"
  | "fb_stories"
  | "ig_reels"
  | "fb_reels";

export type AtrakoPlacementSelection = Record<AtrakoPlacementKey, boolean>;

export const ATRAKO_PLACEMENT_GROUPS: Array<{
  title: string;
  items: Array<{ key: AtrakoPlacementKey; label: string }>;
}> = [
  {
    title: "Feeds",
    items: [
      { key: "fb_feed", label: "Feed do Facebook" },
      { key: "ig_feed", label: "Feed do Instagram" },
    ],
  },
  {
    title: "Stories e Reels",
    items: [
      { key: "ig_stories", label: "Instagram Stories" },
      { key: "fb_stories", label: "Facebook Stories" },
      { key: "ig_reels", label: "Instagram Reels" },
      { key: "fb_reels", label: "Facebook Reels" },
    ],
  },
];

/** Default: todos os posicionamentos Atrako ligados. */
export function defaultPlacementSelection(): AtrakoPlacementSelection {
  return {
    fb_feed: true,
    ig_feed: true,
    ig_stories: true,
    fb_stories: true,
    ig_reels: true,
    fb_reels: true,
  };
}

export function selectionToMetaPositions(sel: AtrakoPlacementSelection): {
  publisherPlatforms: string[];
  facebookPositions: string[];
  instagramPositions: string[];
} {
  const facebookPositions: string[] = [];
  const instagramPositions: string[] = [];
  if (sel.fb_feed) facebookPositions.push("feed");
  if (sel.fb_stories) facebookPositions.push("story");
  if (sel.fb_reels) facebookPositions.push("facebook_reels");
  if (sel.ig_feed) instagramPositions.push("stream");
  if (sel.ig_stories) instagramPositions.push("story");
  if (sel.ig_reels) instagramPositions.push("reels");

  const publisherPlatforms: string[] = [];
  if (facebookPositions.length) publisherPlatforms.push("facebook");
  if (instagramPositions.length) publisherPlatforms.push("instagram");

  return { publisherPlatforms, facebookPositions, instagramPositions };
}

export function metaPositionsToSelection(input: {
  facebookPositions?: string[];
  instagramPositions?: string[];
}): AtrakoPlacementSelection {
  const fb = new Set(input.facebookPositions || []);
  const ig = new Set(input.instagramPositions || []);
  return {
    fb_feed: fb.has("feed"),
    ig_feed: ig.has("stream"),
    ig_stories: ig.has("story"),
    fb_stories: fb.has("story"),
    ig_reels: ig.has("reels"),
    fb_reels: fb.has("facebook_reels"),
  };
}

/** Payload Graph: sempre só FB/IG nos posicionamentos Atrako (nunca Advantage+ aberto). */
export function buildAtrakoPlacementsPayload(sel?: AtrakoPlacementSelection): Record<string, unknown> {
  const hasAny = sel && Object.values(sel).some(Boolean);
  const resolved = selectionToMetaPositions(hasAny ? sel! : defaultPlacementSelection());
  return {
    publisher_platforms: resolved.publisherPlatforms,
    facebook_positions: resolved.facebookPositions,
    instagram_positions: resolved.instagramPositions,
  };
}
