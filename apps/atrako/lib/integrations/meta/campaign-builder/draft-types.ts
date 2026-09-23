import type { UiObjective } from "./objective-config";

export type BudgetType = "DAILY" | "LIFETIME";

export type MetaCampaignBuilderDraft = {
  account: {
    businessId?: string;
    adAccountId: string;
  };
  campaign: {
    name: string;
    objective: UiObjective;
    specialAdCategories: string[];
    buyingType: "AUCTION";
  };
  adSets: MetaAdSetDraft[];
  identity: {
    pageId: string;
    instagramActorId?: string;
  };
  status: "PAUSED";
};

export type MetaAdSetDraft = {
  localKey: string;
  name: string;
  budget: {
    type: BudgetType;
    amount: number; // reais
  };
  schedule?: {
    startTime?: string;
    endTime?: string;
  };
  bidStrategy: string;
  bidAmount?: number; // reais, quando COST_CAP / BID_CAP
  optimizationGoal: string;
  billingEvent?: string;
  targeting: MetaTargetingDraft;
  promotedObject?: {
    pixelId?: string;
    customEventType?: string;
    pageId?: string;
  };
  placements: {
    /** Sempre MANUAL — só FB/IG Feeds + Stories + Reels */
    mode: "MANUAL";
    publisherPlatforms: string[];
    facebookPositions: string[];
    instagramPositions: string[];
    /** Toggle UI canônico Atrako */
    selection: {
      fb_feed: boolean;
      ig_feed: boolean;
      ig_stories: boolean;
      fb_stories: boolean;
      ig_reels: boolean;
      fb_reels: boolean;
    };
  };
  advantageAudience?: boolean;
  destination: {
    type: string;
    url?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
  };
  ads: MetaAdDraft[];
};

export type MetaTargetingDraft = {
  countries?: string[];
  regions?: Array<{ key: string; name?: string }>;
  cities?: Array<{ key: string; name?: string; radius?: number }>;
  ageMin: number;
  ageMax: number;
  genders?: number[]; // 1 male, 2 female; empty = all
  interests?: Array<{ id: string; name: string }>;
  customAudiences?: Array<{ id: string; name?: string }>;
  excludedCustomAudiences?: Array<{ id: string; name?: string }>;
};

export type MetaCarouselCard = {
  imageHash: string;
  headline?: string;
  description?: string;
  link?: string;
};

export type MetaAdDraft = {
  localKey: string;
  name: string;
  creative: {
    type: "IMAGE" | "VIDEO" | "CAROUSEL" | "EXISTING_POST";
    /** @deprecated use imageHashSquare — mantido p/ compat */
    imageHash?: string;
    /** Estático 1:1 (Feeds) */
    imageHashSquare?: string;
    /** Estático 9:16 (Stories / Reels) */
    imageHashVertical?: string;
    videoId?: string;
    /** pageId_postId — promove publicação existente */
    objectStoryId?: string;
    /** Cards do carrossel (mín. 2) */
    carouselCards?: MetaCarouselCard[];
    primaryText: string;
    headline?: string;
    description?: string;
    callToAction: string;
    destinationUrl?: string;
  };
};

export type ValidationIssue = {
  code: string;
  message: string;
  path?: string;
};
