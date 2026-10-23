/**
 * Markdown restrito do guia → HTML sanitizado.
 * Aceita: ## / ### títulos, parágrafos, listas (- e 1.), tabelas com |, **negrito**, *itálico* e [links](url).
 * O texto vem de IA/editor: tudo passa pelo sanitize-html no fim, sem exceção.
 */

import sanitizeHtml from "sanitize-html";

function escape(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function inline(text: string, linkPrefix: (href: string) => string) {
  return escape(text)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, href: string) => {
      const url = linkPrefix(href.replace(/&amp;/g, "&"));
      const external = /^https?:\/\//i.test(url);
      return `<a href="${escape(url)}"${external ? ' rel="noopener" target="_blank"' : ""}>${label}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
}

function tableHtml(rows: string[], linkPrefix: (href: string) => string) {
  const cells = (row: string) =>
    row
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((c) => c.trim());
  const [head, , ...body] = rows;
  const th = cells(head).map((c) => `<th>${inline(c, linkPrefix)}</th>`).join("");
  const tr = body
    .map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c, linkPrefix)}</td>`).join("")}</tr>`)
    .join("");
  return `<div class="geo-table"><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
}

export function renderGeoMarkdown(md: string, linkPrefix: (href: string) => string = (h) => h): string {
  const lines = md.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  let para: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;
  let table: string[] = [];

  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(" "), linkPrefix)}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.type}>${list.items.map((i) => `<li>${inline(i, linkPrefix)}</li>`).join("")}</${list.type}>`);
    list = null;
  };
  const flushTable = () => {
    if (table.length >= 3 && /^\s*\|?\s*:?-{2,}/.test(table[1])) out.push(tableHtml(table, linkPrefix));
    else if (table.length) para.push(...table);
    table = [];
  };
  const flushAll = () => {
    flushTable();
    flushPara();
    flushList();
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flushPara();
      flushList();
      table.push(line);
      continue;
    }
    flushTable();
    const h = line.match(/^(#{2,3})\s+(.+)$/);
    if (h) {
      flushAll();
      const level = h[1].length;
      out.push(`<h${level}>${inline(h[2], linkPrefix)}</h${level}>`);
      continue;
    }
    const ul = line.match(/^\s*[-*]\s+(.+)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (ul || ol) {
      flushPara();
      const type = ul ? "ul" : "ol";
      if (!list || list.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      list.items.push((ul ?? ol)![1]);
      continue;
    }
    if (!line.trim()) {
      flushAll();
      continue;
    }
    flushList();
    para.push(line.trim());
  }
  flushAll();

  return sanitizeHtml(out.join("\n"), {
    allowedTags: ["h2", "h3", "p", "ul", "ol", "li", "strong", "em", "a", "table", "thead", "tbody", "tr", "th", "td", "div"],
    allowedAttributes: { a: ["href", "rel", "target"], div: ["class"] },
    allowedClasses: { div: ["geo-table"] },
    allowedSchemes: ["https", "http", "mailto", "tel"],
    allowProtocolRelative: false,
  });
}

/** Texto puro (llms.txt, meta, validação). */
export function markdownToText(md: string): string {
  return md
    .replace(/\r/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1$2")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*\|?\s*:?-{2,}.*$/gm, "")
    .replace(/\|/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
