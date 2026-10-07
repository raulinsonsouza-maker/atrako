import { Fragment, type ReactNode } from "react";
import Link from "next/link";

/**
 * Markdown mínimo das respostas do Atrako (negrito, itálico, código, links,
 * listas, títulos e tabelas). Só gera elementos React — nunca HTML cru.
 */

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;

function safeHref(href: string): string | null {
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  try {
    const url = new URL(href);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function inline(text: string, keyBase: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    const key = `${keyBase}-${i}`;
    if (!part) return null;
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={key} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={key} className="assistant-md-code">
          {part.slice(1, -1)}
        </code>
      );
    }
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      const href = safeHref(link[2]);
      if (!href) return <Fragment key={key}>{link[1]}</Fragment>;
      return href.startsWith("/") ? (
        <Link key={key} href={href} className="text-[var(--primary)]">
          {link[1]}
        </Link>
      ) : (
        <a key={key} href={href} target="_blank" rel="noreferrer noopener" className="text-[var(--primary)]">
          {link[1]}
        </a>
      );
    }
    if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

const isTableRow = (line: string) => /^\s*\|.*\|\s*$/.test(line);
const isTableDivider = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);
const cells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());

/** Versão em texto corrido — para o anúncio do leitor de tela (aria-live). */
export function markdownToPlainText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => !isTableDivider(line))
    .map((line) =>
      (isTableRow(line) ? cells(line).join(", ") : line)
        .replace(/^\s*#{1,4}\s+/, "")
        .replace(/^\s*([-*•]|\d+[.)])\s+/, "")
        .replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1")
        .replace(/\*\*([^*]+)\*\*|`([^`]+)`/g, (_, a, b) => a ?? b),
    )
    .filter((line) => line.trim())
    .join(". ")
    .replace(/([.!?:])\. /g, "$1 ");
}

export function AssistantMarkdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }

    if (isTableRow(line) && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      const head = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) rows.push(cells(lines[i++]));
      const k = key++;
      blocks.push(
        <div key={k} className="assistant-md-table-wrap">
          <table className="assistant-md-table">
            <thead>
              <tr>
                {head.map((h, j) => (
                  <th key={j}>{inline(h, `t${k}h${j}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci}>{inline(c, `t${k}r${ri}c${ci}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const k = key++;
      blocks.push(
        <p key={k} className="assistant-md-heading type-body-strong">
          {inline(heading[2], `h${k}`)}
        </p>,
      );
      i++;
      continue;
    }

    if (/^\s*([-*•])\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && (ordered ? /^\s*\d+[.)]\s+/.test(lines[i]) : /^\s*([-*•])\s+/.test(lines[i]))) {
        items.push(lines[i].replace(ordered ? /^\s*\d+[.)]\s+/ : /^\s*([-*•])\s+/, ""));
        i++;
      }
      const k = key++;
      const ListTag = ordered ? "ol" : "ul";
      blocks.push(
        <ListTag key={k} className={ordered ? "assistant-md-ol" : "assistant-md-ul"}>
          {items.map((it, j) => (
            <li key={j}>{inline(it, `l${k}i${j}`)}</li>
          ))}
        </ListTag>,
      );
      continue;
    }

    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,4})\s+/.test(lines[i]) &&
      !/^\s*([-*•])\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i]) &&
      !(isTableRow(lines[i]) && i + 1 < lines.length && isTableDivider(lines[i + 1]))
    ) {
      para.push(lines[i++]);
    }
    const k = key++;
    blocks.push(
      <p key={k} className="assistant-md-p">
        {para.map((p, j) => (
          <Fragment key={j}>
            {j > 0 ? <br /> : null}
            {inline(p, `p${k}l${j}`)}
          </Fragment>
        ))}
      </p>,
    );
  }

  return <div className="assistant-md">{blocks}</div>;
}
