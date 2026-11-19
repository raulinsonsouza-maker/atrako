"use client";

import { useEffect } from "react";
import {
  bindMetaCtaTracking,
  loadWorkspaceTracking,
  rememberCampaignVisit,
} from "@/lib/criar/form-tracking";

/** Pixel / GA4 / CAPI via Config → Rastreamento. */
export default function VilarisTracking() {
  useEffect(() => {
    rememberCampaignVisit();
    loadWorkspaceTracking();
    return bindMetaCtaTracking();
  }, []);
  return null;
}
