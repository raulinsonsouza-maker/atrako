import sanitizeHtml from "sanitize-html";

export type ProductBadges = {
  featured: boolean;
  launch: boolean;
  extra: string | null;
};

export function asProductBadges(raw: unknown): ProductBadges {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const extra = typeof o.extra === "string" ? o.extra.trim().slice(0, 40) : "";
  return {
    featured: o.featured === true,
    launch: o.launch === true,
    extra: extra || null,
  };
}

export function sanitizeProductHtml(raw: string) {
  return sanitizeHtml(raw, {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "h2", "h3", "a", "span"],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      span: ["style"],
    },
    allowedStyles: {
      span: {
        "font-size": [/^\d{1,2}px$/],
      },
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
    },
  }).trim();
}
