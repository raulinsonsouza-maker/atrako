/**
 * Publish pipeline: Campaign → AdSet → Creative → Ad (sempre PAUSED).
 */

import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { resolveMetaCredentials } from "@/lib/config/resolveIntegracao";
import {
  ensureActPrefix,
  MetaGraphError,
  metaGraphPostForm,
} from "@/lib/integrations/meta/graph";
import { metaMarketingPost } from "./marketing-post";
import { getObjectiveConfig } from "./objective-config";
import { toMetaBudget } from "./budget";
import type { MetaAdDraft, MetaCampaignBuilderDraft } from "./draft-types";
import {
  buildPlacementsPayload,
  buildPromotedObject,
  buildTargetingPayload,
  validateCampaignDraft,
  withUtm,
} from "./validation";

function identitySpec(pageId: string, instagramActorId?: string) {
  return {
    page_id: pageId,
    ...(instagramActorId ? { instagram_actor_id: instagramActorId } : {}),
  };
}

/** Monta payload Graph de AdCreative conforme tipo (imagem / vídeo / carrossel / post). */
export function buildCreativePayload(input: {
  adDraft: MetaAdDraft;
  pageId: string;
  instagramActorId?: string;
  link?: string;
}): { creativeBody: Record<string, unknown>; objectStorySpec?: Record<string, unknown> } {
  const { adDraft, pageId, instagramActorId, link } = input;
  const c = adDraft.creative;
  const cta = {
    type: c.callToAction || "LEARN_MORE",
    ...(link ? { value: { link } } : {}),
  };

  if (c.type === "EXISTING_POST" && c.objectStoryId) {
    return {
      creativeBody: {
        name: adDraft.name,
        object_story_id: c.objectStoryId.trim(),
      },
    };
  }

  if (c.type === "VIDEO" && c.videoId) {
    const videoData: Record<string, unknown> = {
      video_id: c.videoId,
      message: c.primaryText,
      title: c.headline || undefined,
      call_to_action: cta,
    };
    if (c.imageHash) videoData.image_hash = c.imageHash;
    const objectStorySpec = {
      ...identitySpec(pageId, instagramActorId),
      video_data: videoData,
    };
    return {
      creativeBody: { name: adDraft.name, object_story_spec: objectStorySpec },
      objectStorySpec,
    };
  }

  if (c.type === "CAROUSEL") {
    const cards = c.carouselCards || [];
    const childAttachments = cards.map((card) => {
      const cardLink = card.link || link || "https://facebook.com";
      return {
        link: cardLink,
        name: card.headline || undefined,
        description: card.description || undefined,
        image_hash: card.imageHash,
        call_to_action: {
          type: c.callToAction || "LEARN_MORE",
          value: { link: cardLink },
        },
      };
    });
    const linkData: Record<string, unknown> = {
      message: c.primaryText,
      link: link || childAttachments[0]?.link,
      child_attachments: childAttachments,
      multi_share_optimized: true,
      call_to_action: cta,
    };
    const objectStorySpec = {
      ...identitySpec(pageId, instagramActorId),
      link_data: linkData,
    };
    return {
      creativeBody: { name: adDraft.name, object_story_spec: objectStorySpec },
      objectStorySpec,
    };
  }

  // IMAGE — 1:1 (Feed) + 9:16 (Stories/Reels) via asset_feed_spec
  const square = c.imageHashSquare || c.imageHash;
  const vertical = c.imageHashVertical;

  if (square && vertical && square !== vertical) {
    const assetFeedSpec: Record<string, unknown> = {
      images: [
        { hash: square, adlabels: [{ name: "feed_1x1" }] },
        { hash: vertical, adlabels: [{ name: "stories_9x16" }] },
      ],
      bodies: [{ text: c.primaryText || " ", adlabels: [{ name: "body" }] }],
      titles: [{ text: c.headline || " ", adlabels: [{ name: "title" }] }],
      descriptions: c.description ? [{ text: c.description }] : [],
      link_urls: link ? [{ website_url: link }] : [],
      call_to_action_types: [c.callToAction || "LEARN_MORE"],
      ad_formats: ["SINGLE_IMAGE"],
      asset_customization_rules: [
        {
          customization_spec: {
            publisher_platforms: ["facebook", "instagram"],
            facebook_positions: ["feed"],
            instagram_positions: ["stream"],
          },
          image_label: { name: "feed_1x1" },
          body_label: { name: "body" },
          title_label: { name: "title" },
        },
        {
          customization_spec: {
            publisher_platforms: ["facebook", "instagram"],
            facebook_positions: ["story", "facebook_reels"],
            instagram_positions: ["story", "reels"],
          },
          image_label: { name: "stories_9x16" },
          body_label: { name: "body" },
          title_label: { name: "title" },
        },
      ],
    };
    const objectStorySpec = {
      ...identitySpec(pageId, instagramActorId),
    };
    return {
      creativeBody: {
        name: adDraft.name,
        object_story_spec: objectStorySpec,
        asset_feed_spec: assetFeedSpec,
      },
      objectStorySpec: { ...objectStorySpec, asset_feed_spec: assetFeedSpec },
    };
  }

  // fallback: uma imagem só
  const linkData: Record<string, unknown> = {
    message: c.primaryText,
    name: c.headline || undefined,
    description: c.description || undefined,
    call_to_action: cta,
  };
  if (link) linkData.link = link;
  if (square) linkData.image_hash = square;

  const objectStorySpec = {
    ...identitySpec(pageId, instagramActorId),
    link_data: linkData,
  };
  return {
    creativeBody: { name: adDraft.name, object_story_spec: objectStorySpec },
    objectStorySpec,
  };
}

async function logApi(input: {
  clienteId: string;
  draftId?: string;
  operation: string;
  entityType: string;
  entityId?: string;
  requestPayload?: unknown;
  responsePayload?: unknown;
  httpStatus?: number;
  error?: MetaGraphError | Error;
}) {
  const err = input.error;
  const metaErr = err instanceof MetaGraphError ? err : null;
  await prisma.metaApiLog
    .create({
      data: {
        clienteId: input.clienteId,
        draftId: input.draftId ?? null,
        operation: input.operation,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        requestPayload: input.requestPayload as object | undefined,
        responsePayload: input.responsePayload as object | undefined,
        httpStatus: input.httpStatus ?? metaErr?.status ?? null,
        metaErrorCode: metaErr?.code ?? null,
        metaErrorSubcode: metaErr?.subcode ?? null,
        metaErrorMessage: err ? err.message : null,
      },
    })
    .catch(() => null);
}

export async function saveDraft(input: {
  clienteId: string;
  draft: MetaCampaignBuilderDraft;
  creationRequestId?: string;
  draftId?: string;
  name?: string;
}) {
  const creationRequestId = input.creationRequestId || randomUUID();
  const name = input.name || input.draft.campaign.name || "Campanha Meta";
  const adAccountId = input.draft.account.adAccountId;

  if (input.draftId) {
    return prisma.metaCampaignDraft.update({
      where: { id: input.draftId },
      data: {
        name,
        adAccountId,
        payload: input.draft as object,
        status: "DRAFT",
        lastError: null,
      },
    });
  }

  const existing = await prisma.metaCampaignDraft.findUnique({
    where: { creationRequestId },
  });
  if (existing) return existing;

  return prisma.metaCampaignDraft.create({
    data: {
      clienteId: input.clienteId,
      adAccountId,
      name,
      status: "DRAFT",
      creationRequestId,
      payload: input.draft as object,
    },
  });
}

export async function publishDraft(input: {
  clienteId: string;
  draftId: string;
}): Promise<{
  ok: boolean;
  status: string;
  campaignId?: string;
  metaCampaignId?: string;
  error?: string;
  issues?: ReturnType<typeof validateCampaignDraft>;
}> {
  const row = await prisma.metaCampaignDraft.findFirst({
    where: { id: input.draftId, clienteId: input.clienteId },
  });
  if (!row) return { ok: false, status: "FAILED", error: "Draft não encontrado" };

  if (row.status === "PUBLISHING") {
    return { ok: false, status: "PUBLISHING", error: "Já existe uma operação em andamento." };
  }
  if (row.status === "PUBLISHED" && row.publishedCampaignId) {
    return {
      ok: true,
      status: "PUBLISHED",
      campaignId: row.publishedCampaignId,
    };
  }

  const draft = row.payload as unknown as MetaCampaignBuilderDraft;
  const issues = validateCampaignDraft(draft);
  if (issues.length) {
    return { ok: false, status: "FAILED", error: "Validação falhou", issues };
  }

  const creds = await resolveMetaCredentials(input.clienteId);
  if (!creds?.token) {
    return { ok: false, status: "FAILED", error: "Meta não conectada" };
  }
  const token = creds.token;
  const act = ensureActPrefix(draft.account.adAccountId);
  const objCfg = getObjectiveConfig(draft.campaign.objective);

  await prisma.metaCampaignDraft.update({
    where: { id: row.id },
    data: { status: "PUBLISHING", lastError: null },
  });

  let metaCampaignId: string | null = null;
  let localCampaignId: string | null = row.publishedCampaignId;

  try {
    // Reuse campaign if partial
    if (localCampaignId) {
      const existing = await prisma.metaCampaignBuilder.findUnique({
        where: { id: localCampaignId },
      });
      metaCampaignId = existing?.metaCampaignId ?? null;
    }

    if (!metaCampaignId) {
      const categories = (draft.campaign.specialAdCategories || []).filter(Boolean);
      const campBody = {
        name: draft.campaign.name,
        objective: objCfg.metaObjective,
        status: "PAUSED",
        special_ad_categories: categories,
        buying_type: "AUCTION",
      };
      try {
        const created = await metaMarketingPost(`/${act}/campaigns`, token, campBody);
        metaCampaignId = String(created.id);
        await logApi({
          clienteId: input.clienteId,
          draftId: row.id,
          operation: "create_campaign",
          entityType: "campaign",
          entityId: metaCampaignId,
          requestPayload: campBody,
          responsePayload: created,
        });
      } catch (e) {
        await logApi({
          clienteId: input.clienteId,
          draftId: row.id,
          operation: "create_campaign",
          entityType: "campaign",
          requestPayload: campBody,
          error: e as Error,
        });
        throw e;
      }

      const camp = await prisma.metaCampaignBuilder.create({
        data: {
          clienteId: input.clienteId,
          adAccountId: draft.account.adAccountId,
          metaCampaignId,
          name: draft.campaign.name,
          objective: objCfg.metaObjective,
          specialAdCategories: categories,
          buyingType: "AUCTION",
          configuredStatus: "PAUSED",
        },
      });
      localCampaignId = camp.id;
      await prisma.metaCampaignDraft.update({
        where: { id: row.id },
        data: { publishedCampaignId: camp.id },
      });
    }

    const existingAdSets = await prisma.metaBuilderAdSet.findMany({
      where: { campaignId: localCampaignId! },
      include: { creatives: true, ads: true },
    });

    for (const adSetDraft of draft.adSets) {
      let adSetRow = existingAdSets.find((a) => a.name === adSetDraft.name && a.metaAdsetId);

      if (!adSetRow) {
        const targeting = {
          ...buildTargetingPayload(adSetDraft.targeting, adSetDraft.advantageAudience),
          ...buildPlacementsPayload(adSetDraft.placements),
        };
        const promoted = buildPromotedObject(adSetDraft, draft.identity.pageId);
        const adsetBody: Record<string, unknown> = {
          name: adSetDraft.name,
          campaign_id: metaCampaignId,
          status: "PAUSED",
          billing_event: adSetDraft.billingEvent || objCfg.billingEvent,
          optimization_goal: adSetDraft.optimizationGoal,
          bid_strategy: adSetDraft.bidStrategy || "LOWEST_COST_WITHOUT_CAP",
          targeting,
        };
        if (adSetDraft.budget.type === "DAILY") {
          adsetBody.daily_budget = toMetaBudget(adSetDraft.budget.amount);
        } else {
          adsetBody.lifetime_budget = toMetaBudget(adSetDraft.budget.amount);
        }
        if (adSetDraft.schedule?.startTime) adsetBody.start_time = adSetDraft.schedule.startTime;
        if (adSetDraft.schedule?.endTime) adsetBody.end_time = adSetDraft.schedule.endTime;
        if (
          adSetDraft.bidAmount != null &&
          (adSetDraft.bidStrategy === "COST_CAP" ||
            adSetDraft.bidStrategy === "LOWEST_COST_WITH_BID_CAP")
        ) {
          adsetBody.bid_amount = toMetaBudget(adSetDraft.bidAmount);
        }
        if (promoted) adsetBody.promoted_object = promoted;

        let metaAdsetId: string;
        try {
          const created = await metaMarketingPost(`/${act}/adsets`, token, adsetBody);
          metaAdsetId = String(created.id);
          await logApi({
            clienteId: input.clienteId,
            draftId: row.id,
            operation: "create_adset",
            entityType: "adset",
            entityId: metaAdsetId,
            requestPayload: adsetBody,
            responsePayload: created,
          });
        } catch (e) {
          await logApi({
            clienteId: input.clienteId,
            draftId: row.id,
            operation: "create_adset",
            entityType: "adset",
            requestPayload: adsetBody,
            error: e as Error,
          });
          throw e;
        }

        adSetRow = await prisma.metaBuilderAdSet.create({
          data: {
            campaignId: localCampaignId!,
            metaAdsetId,
            name: adSetDraft.name,
            dailyBudget:
              adSetDraft.budget.type === "DAILY" ? toMetaBudget(adSetDraft.budget.amount) : null,
            lifetimeBudget:
              adSetDraft.budget.type === "LIFETIME"
                ? toMetaBudget(adSetDraft.budget.amount)
                : null,
            optimizationGoal: adSetDraft.optimizationGoal,
            billingEvent: (adSetDraft.billingEvent || objCfg.billingEvent) as string,
            bidStrategy: adSetDraft.bidStrategy,
            targetingJson: targeting,
            promotedObjectJson: promoted ?? undefined,
            startTime: adSetDraft.schedule?.startTime
              ? new Date(adSetDraft.schedule.startTime)
              : null,
            endTime: adSetDraft.schedule?.endTime ? new Date(adSetDraft.schedule.endTime) : null,
            configuredStatus: "PAUSED",
          },
          include: { creatives: true, ads: true },
        });
      }

      for (const adDraft of adSetDraft.ads) {
        const already = adSetRow.ads.find((a) => a.localKey === adDraft.localKey && a.metaAdId);
        if (already) continue;

        let creativeRow = adSetRow.creatives.find((c) => c.localKey === adDraft.localKey);
        if (!creativeRow?.metaCreativeId) {
          const link =
            adDraft.creative.destinationUrl ||
            (adSetDraft.destination.url
              ? withUtm(adSetDraft.destination.url, adSetDraft.destination)
              : undefined);

          const { creativeBody, objectStorySpec } = buildCreativePayload({
            adDraft,
            pageId: draft.identity.pageId,
            instagramActorId: draft.identity.instagramActorId,
            link,
          });

          let metaCreativeId: string;
          try {
            const created = await metaMarketingPost(`/${act}/adcreatives`, token, creativeBody);
            metaCreativeId = String(created.id);
            await logApi({
              clienteId: input.clienteId,
              draftId: row.id,
              operation: "create_creative",
              entityType: "creative",
              entityId: metaCreativeId,
              requestPayload: creativeBody,
              responsePayload: created,
            });
          } catch (e) {
            await logApi({
              clienteId: input.clienteId,
              draftId: row.id,
              operation: "create_creative",
              entityType: "creative",
              requestPayload: creativeBody,
              error: e as Error,
            });
            throw e;
          }

          if (creativeRow) {
            creativeRow = await prisma.metaBuilderCreative.update({
              where: { id: creativeRow.id },
              data: {
                metaCreativeId,
                type: adDraft.creative.type,
                imageHash: adDraft.creative.imageHashSquare || adDraft.creative.imageHash,
                videoId: adDraft.creative.videoId,
                primaryText: adDraft.creative.primaryText,
                headline: adDraft.creative.headline,
                description: adDraft.creative.description,
                cta: adDraft.creative.callToAction,
                destinationUrl: link,
                objectStorySpec: objectStorySpec ?? {
                  object_story_id: adDraft.creative.objectStoryId,
                },
              },
            });
          } else {
            creativeRow = await prisma.metaBuilderCreative.create({
              data: {
                adsetId: adSetRow.id,
                metaCreativeId,
                localKey: adDraft.localKey,
                name: adDraft.name,
                type: adDraft.creative.type,
                imageHash: adDraft.creative.imageHashSquare || adDraft.creative.imageHash,
                videoId: adDraft.creative.videoId,
                primaryText: adDraft.creative.primaryText,
                headline: adDraft.creative.headline,
                description: adDraft.creative.description,
                cta: adDraft.creative.callToAction,
                destinationUrl: link,
                objectStorySpec: objectStorySpec ?? {
                  object_story_id: adDraft.creative.objectStoryId,
                },
              },
            });
          }
        }

        const adBody = {
          name: adDraft.name,
          adset_id: adSetRow.metaAdsetId,
          creative: { creative_id: creativeRow.metaCreativeId },
          status: "PAUSED",
        };
        try {
          const created = await metaMarketingPost(`/${act}/ads`, token, adBody);
          const metaAdId = String(created.id);
          await logApi({
            clienteId: input.clienteId,
            draftId: row.id,
            operation: "create_ad",
            entityType: "ad",
            entityId: metaAdId,
            requestPayload: adBody,
            responsePayload: created,
          });
          await prisma.metaBuilderAd.create({
            data: {
              adsetId: adSetRow.id,
              creativeId: creativeRow.id,
              metaAdId,
              localKey: adDraft.localKey,
              name: adDraft.name,
              configuredStatus: "PAUSED",
            },
          });
        } catch (e) {
          await logApi({
            clienteId: input.clienteId,
            draftId: row.id,
            operation: "create_ad",
            entityType: "ad",
            requestPayload: adBody,
            error: e as Error,
          });
          throw e;
        }
      }
    }

    await prisma.metaCampaignDraft.update({
      where: { id: row.id },
      data: { status: "PUBLISHED", lastError: null },
    });

    return {
      ok: true,
      status: "PUBLISHED",
      campaignId: localCampaignId!,
      metaCampaignId: metaCampaignId!,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.metaCampaignDraft.update({
      where: { id: row.id },
      data: {
        status: localCampaignId ? "PARTIAL" : "FAILED",
        lastError: message,
      },
    });
    return {
      ok: false,
      status: localCampaignId ? "PARTIAL" : "FAILED",
      campaignId: localCampaignId ?? undefined,
      metaCampaignId: metaCampaignId ?? undefined,
      error: message,
    };
  }
}

export async function uploadAdImage(input: {
  clienteId: string;
  adAccountId: string;
  filename: string;
  base64: string;
}): Promise<{ imageHash: string }> {
  const creds = await resolveMetaCredentials(input.clienteId);
  if (!creds?.token) throw new Error("Meta não conectada");
  const act = ensureActPrefix(input.adAccountId);
  // Meta expects bytes as raw file; using URL bytes param with data URI often works via form
  const result = await metaGraphPostForm(`/${act}/adimages`, creds.token, {
    bytes: input.base64,
    name: input.filename,
  });
  const images = result.images as Record<string, { hash?: string }> | undefined;
  const first = images ? Object.values(images)[0] : null;
  const hash = first?.hash || (typeof result.hash === "string" ? result.hash : null);
  if (!hash) throw new Error("Meta não retornou image_hash");
  return { imageHash: hash };
}

export async function setCampaignStatus(input: {
  clienteId: string;
  campaignId: string;
  status: "ACTIVE" | "PAUSED";
}) {
  const camp = await prisma.metaCampaignBuilder.findFirst({
    where: { id: input.campaignId, clienteId: input.clienteId },
  });
  if (!camp) throw new Error("Campanha não encontrada");
  const creds = await resolveMetaCredentials(input.clienteId);
  if (!creds?.token) throw new Error("Meta não conectada");
  await metaMarketingPost(`/${camp.metaCampaignId}`, creds.token, { status: input.status });
  await prisma.metaCampaignBuilder.update({
    where: { id: camp.id },
    data: { configuredStatus: input.status },
  });
  return { ok: true, status: input.status };
}

export async function searchTargeting(input: {
  clienteId: string;
  q: string;
  type?: string;
}) {
  const creds = await resolveMetaCredentials(input.clienteId);
  if (!creds?.token) throw new Error("Meta não conectada");
  const { metaGraphGet } = await import("@/lib/integrations/meta/graph");
  const res = await metaGraphGet("/search", creds.token, {
    type: input.type || "adinterest",
    q: input.q,
    limit: "25",
  });
  const data = Array.isArray(res.data) ? res.data : [];
  return data.map((row) => {
    const r = row as { id?: string; name?: string };
    return { id: String(r.id), name: r.name || String(r.id) };
  });
}
