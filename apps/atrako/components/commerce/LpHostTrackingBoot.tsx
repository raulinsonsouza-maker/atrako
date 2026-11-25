"use client";

import { useEffect } from "react";
import { loadWorkspaceTracking, rememberCampaignVisit } from "@/lib/criar/form-tracking";

/** No domínio LP: first-touch + Pixel/GA4 de Config → Rastreamento (após public-config). */
export function LpHostTrackingBoot() {
  useEffect(() => {
    rememberCampaignVisit();
    loadWorkspaceTracking();
  }, []);
  return null;
}
