import { getObjectiveConfig, type UiObjective } from "./objective-config";
import { buildAtrakoPlacementsPayload, type AtrakoPlacementSelection } from "./placements-config";
import type { MetaCampaignBuilderDraft, ValidationIssue } from "./draft-types";

export function validateCampaignDraft(draft: MetaCampaignBuilderDraft): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!draft.account?.adAccountId) {
    issues.push({ code: "NO_AD_ACCOUNT", message: "Selecione uma conta de anúncio.", path: "account.adAccountId" });
  }
  if (!draft.campaign?.name?.trim()) {
    issues.push({ code: "NO_NAME", message: "Informe o nome da campanha.", path: "campaign.name" });
  }
  if (!draft.campaign?.objective) {
    issues.push({ code: "NO_OBJECTIVE", message: "Selecione o objetivo.", path: "campaign.objective" });
  }
  if (!draft.identity?.pageId) {
    issues.push({ code: "NO_PAGE", message: "Selecione a Página do Facebook.", path: "identity.pageId" });
  }
  if (!draft.adSets?.length) {
    issues.push({ code: "NO_ADSET", message: "Adicione pelo menos um conjunto de anúncios.", path: "adSets" });
  }

  const cfg = draft.campaign?.objective
    ? getObjectiveConfig(draft.campaign.objective as UiObjective)
    : null;

  for (let i = 0; i < (draft.adSets?.length ?? 0); i++) {
    const set = draft.adSets[i];
    const base = `adSets[${i}]`;
    if (!set.name?.trim()) {
      issues.push({ code: "ADSET_NAME", message: `Conjunto ${i + 1}: informe o nome.`, path: `${base}.name` });
    }
    if (!set.budget?.amount || set.budget.amount < 1) {
      issues.push({
        code: "BUDGET",
        message: `Conjunto ${i + 1}: orçamento mínimo de R$ 1,00.`,
        path: `${base}.budget.amount`,
      });
    }
    if (!set.optimizationGoal) {
      issues.push({
        code: "OPT_GOAL",
        message: `Conjunto ${i + 1}: selecione a otimização.`,
        path: `${base}.optimizationGoal`,
      });
    }
    if (cfg?.needsPixel && !set.promotedObject?.pixelId) {
      issues.push({
        code: "PIXEL",
        message: `Conjunto ${i + 1}: selecione o Pixel para este objetivo.`,
        path: `${base}.promotedObject.pixelId`,
      });
    }
    if (set.destination?.type === "WEBSITE") {
      const url = set.destination.url?.trim() || "";
      if (!url || !/^https:\/\//i.test(url)) {
        issues.push({
          code: "URL",
          message: `Conjunto ${i + 1}: URL de destino deve ser HTTPS.`,
          path: `${base}.destination.url`,
        });
      }
    }
    const sel = set.placements?.selection;
    if (sel && !Object.values(sel).some(Boolean)) {
      issues.push({
        code: "PLACEMENTS",
        message: `Conjunto ${i + 1}: selecione ao menos um posicionamento (Feed / Stories / Reels).`,
        path: `${base}.placements`,
      });
    }
    if (!set.ads?.length) {
      issues.push({
        code: "NO_ADS",
        message: `Conjunto ${i + 1}: adicione pelo menos um anúncio.`,
        path: `${base}.ads`,
      });
    }
    for (let j = 0; j < (set.ads?.length ?? 0); j++) {
      const ad = set.ads[j];
      const ap = `${base}.ads[${j}]`;
      const ctype = ad.creative?.type || "IMAGE";

      if (ctype === "EXISTING_POST") {
        if (!ad.creative?.objectStoryId?.trim()) {
          issues.push({
            code: "EXISTING_POST",
            message: `Anúncio ${j + 1}: informe o object_story_id (página_post).`,
            path: `${ap}.creative.objectStoryId`,
          });
        }
        continue;
      }

      if (!ad.creative?.primaryText?.trim()) {
        issues.push({ code: "COPY", message: `Anúncio ${j + 1}: texto principal obrigatório.`, path: `${ap}.creative.primaryText` });
      }
      if (!ad.creative?.callToAction) {
        issues.push({ code: "CTA", message: `Anúncio ${j + 1}: selecione o CTA.`, path: `${ap}.creative.callToAction` });
      }
      if (ctype === "IMAGE") {
        const square = ad.creative.imageHashSquare || ad.creative.imageHash;
        const vertical = ad.creative.imageHashVertical;
        if (!square) {
          issues.push({
            code: "IMAGE_1x1",
            message: `Anúncio ${j + 1}: envie a imagem 1:1 (Feed).`,
            path: `${ap}.creative.imageHashSquare`,
          });
        }
        if (!vertical) {
          issues.push({
            code: "IMAGE_9x16",
            message: `Anúncio ${j + 1}: envie a imagem 9:16 (Stories/Reels).`,
            path: `${ap}.creative.imageHashVertical`,
          });
        }
      }
      if (ctype === "VIDEO" && !ad.creative.videoId) {
        issues.push({ code: "VIDEO", message: `Anúncio ${j + 1}: informe a URL do vídeo ou video_id.`, path: `${ap}.creative.videoId` });
      }
      if (ctype === "CAROUSEL") {
        const cards = ad.creative.carouselCards || [];
        if (cards.length < 2) {
          issues.push({
            code: "CAROUSEL",
            message: `Anúncio ${j + 1}: carrossel precisa de pelo menos 2 cards com imagem.`,
            path: `${ap}.creative.carouselCards`,
          });
        }
        for (let c = 0; c < cards.length; c++) {
          if (!cards[c]?.imageHash) {
            issues.push({
              code: "CAROUSEL_CARD",
              message: `Anúncio ${j + 1}, card ${c + 1}: faça upload da imagem.`,
              path: `${ap}.creative.carouselCards[${c}]`,
            });
          }
        }
      }
    }
  }

  return issues;
}

export function buildPromotedObject(adSet: MetaCampaignBuilderDraft["adSets"][0], pageId: string) {
  if (adSet.promotedObject?.pixelId) {
    return {
      pixel_id: adSet.promotedObject.pixelId,
      custom_event_type: adSet.promotedObject.customEventType || "PURCHASE",
    };
  }
  if (adSet.optimizationGoal === "LEAD_GENERATION" || adSet.optimizationGoal === "QUALITY_LEAD") {
    return { page_id: pageId };
  }
  return undefined;
}

export function buildTargetingPayload(t: MetaCampaignBuilderDraft["adSets"][0]["targeting"], advantageAudience?: boolean) {
  const targeting: Record<string, unknown> = {
    age_min: t.ageMin || 18,
    age_max: t.ageMax >= 65 ? 65 : t.ageMax || 65,
  };
  if (t.genders?.length) targeting.genders = t.genders;
  const geo: Record<string, unknown> = {};
  if (t.countries?.length) geo.countries = t.countries;
  if (t.regions?.length) geo.regions = t.regions.map((r) => ({ key: r.key }));
  if (t.cities?.length) {
    geo.cities = t.cities.map((c) => ({
      key: c.key,
      ...(c.radius != null ? { radius: c.radius, distance_unit: "kilometer" } : {}),
    }));
  }
  if (!Object.keys(geo).length) geo.countries = ["BR"];
  targeting.geo_locations = geo;
  if (t.interests?.length) {
    targeting.flexible_spec = [{ interests: t.interests.map((i) => ({ id: i.id, name: i.name })) }];
  }
  if (t.customAudiences?.length) {
    targeting.custom_audiences = t.customAudiences.map((a) => ({ id: a.id }));
  }
  if (t.excludedCustomAudiences?.length) {
    targeting.excluded_custom_audiences = t.excludedCustomAudiences.map((a) => ({ id: a.id }));
  }
  if (advantageAudience) {
    targeting.targeting_automation = { advantage_audience: 1 };
  }
  return targeting;
}

export function buildPlacementsPayload(
  placements: MetaCampaignBuilderDraft["adSets"][0]["placements"],
): Record<string, unknown> {
  return buildAtrakoPlacementsPayload(placements?.selection as AtrakoPlacementSelection | undefined);
}

export function withUtm(url: string, utm: {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
}): string {
  try {
    const u = new URL(url);
    if (utm.utmSource) u.searchParams.set("utm_source", utm.utmSource);
    if (utm.utmMedium) u.searchParams.set("utm_medium", utm.utmMedium);
    if (utm.utmCampaign) u.searchParams.set("utm_campaign", utm.utmCampaign);
    if (utm.utmContent) u.searchParams.set("utm_content", utm.utmContent);
    return u.toString();
  } catch {
    return url;
  }
}
