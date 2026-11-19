"use client";

import { useEffect } from "react";
import { loadWorkspaceTracking, rememberCampaignVisit } from "@/lib/criar/form-tracking";

/** Pixel / GA4 via Config → Rastreamento (`/api/geo/public-config`). */
export default function VilarisTracking() {
  useEffect(() => {
    rememberCampaignVisit();
    loadWorkspaceTracking();
  }, []);
  return null;
}
