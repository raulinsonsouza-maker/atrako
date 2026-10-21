"use client";

import { createContext, useContext } from "react";

export type CrmLinks = {
  leadsHref: string;
  leadHref: (leadId: string) => string;
  conversationHref: (phone: string) => string;
  /** Links da jornada apontam para telas do Atrako que não existem na área do cliente. */
  journeyLinks: boolean;
};

const DEFAULT_LINKS: CrmLinks = {
  leadsHref: "/crm",
  leadHref: (leadId) => `/crm?lead=${encodeURIComponent(leadId)}`,
  conversationHref: (phone) => `/whatsapp?phone=${encodeURIComponent(phone)}`,
  journeyLinks: true,
};

const CrmLinksContext = createContext<CrmLinks>(DEFAULT_LINKS);

export const CrmLinksProvider = CrmLinksContext.Provider;

export function useCrmLinks() {
  return useContext(CrmLinksContext);
}
