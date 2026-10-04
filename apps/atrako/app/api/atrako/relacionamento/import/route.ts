import { NextRequest, NextResponse } from "next/server";
import { bad, gate, readBody, str } from "@/lib/flows/api";
import { normalizePersonEmail, normalizePersonPhone, upsertPersonContact } from "@/lib/atrako/person";
import { upsertContactBirthday } from "@/lib/flows/important-dates";

export const maxDuration = 300;

const MAX_ROWS = 20_000;

/** CSV simples com aspas ("a, b") e separador , ou ; detectado no cabeçalho. */
function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

const COLS: Record<string, string[]> = {
  name: ["nome", "name", "nomecompleto", "cliente"],
  email: ["email", "mail"],
  phone: ["telefone", "phone", "whatsapp", "celular", "fone"],
  birthday: ["aniversario", "nascimento", "datanascimento", "datadenascimento", "birthday", "birthdate", "dob"],
  consent: ["consentimento", "consent", "optin", "aceite", "lgpd"],
};

/**
 * Importação de contatos (CSV). Consentimento: só quem marcou na coluna ou
 * quando a loja confirma que toda a lista consentiu (`consentConfirmed`).
 */
export async function POST(request: NextRequest) {
  const body = await readBody(request);
  if (!body) return bad("Invalid JSON");
  const g = await gate(request, "manage", body);
  if (!g.ok) return g.response;
  const ws = g.workspaceId;
  const csv = typeof body.csv === "string" ? body.csv : "";
  if (!csv.trim()) return bad("Arquivo vazio");
  const rows = parseCsv(csv);
  if (rows.length < 2) return bad("O CSV precisa de cabeçalho e ao menos uma linha");
  if (rows.length - 1 > MAX_ROWS) return bad(`Máximo de ${MAX_ROWS.toLocaleString("pt-BR")} linhas por importação`);
  const header = rows[0].map(norm);
  const idx: Record<string, number> = {};
  for (const [key, aliases] of Object.entries(COLS)) {
    const i = header.findIndex((h) => aliases.includes(h));
    if (i >= 0) idx[key] = i;
  }
  if (idx.email == null && idx.phone == null) return bad("Inclua uma coluna de e-mail ou telefone");
  const allConsented = body.consentConfirmed === true;
  const source = (str(body.source) || "import").slice(0, 40);
  const dryRun = body.dryRun === true;

  const stats = { total: rows.length - 1, imported: 0, invalidEmail: 0, invalidPhone: 0, skipped: 0, birthdays: 0, consented: 0 };
  const errors: string[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const get = (k: string) => (idx[k] != null ? (row[idx[k]] ?? "").trim() : "");
    const rawEmail = get("email");
    const rawPhone = get("phone");
    const email = normalizePersonEmail(rawEmail);
    const phone = normalizePersonPhone(rawPhone);
    if (rawEmail && !email) stats.invalidEmail++;
    if (rawPhone && !phone) stats.invalidPhone++;
    if (!email && !phone) {
      stats.skipped++;
      if (errors.length < 20) errors.push(`Linha ${r + 1}: sem e-mail ou telefone válido`);
      continue;
    }
    const consent = allConsented || /^(1|sim|s|yes|true|x|aceito)$/i.test(get("consent"));
    if (consent) stats.consented++;
    if (dryRun) {
      stats.imported++;
      if (get("birthday")) stats.birthdays++;
      continue;
    }
    try {
      const contact = await upsertPersonContact({
        workspaceId: ws,
        name: get("name") || null,
        email,
        phone,
        source,
        marketingConsent: consent,
        consentSource: source,
      });
      stats.imported++;
      if (get("birthday")) {
        const b = await upsertContactBirthday({ workspaceId: ws, contactId: contact.id, raw: get("birthday"), source: "import" });
        if (b) stats.birthdays++;
      }
    } catch (err) {
      stats.skipped++;
      if (errors.length < 20) errors.push(`Linha ${r + 1}: ${err instanceof Error ? err.message : "erro"}`);
    }
  }
  return NextResponse.json({ ok: true, dryRun, columns: Object.keys(idx), stats, errors });
}
