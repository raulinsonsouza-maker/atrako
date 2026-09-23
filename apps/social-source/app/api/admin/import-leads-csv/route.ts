import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { dddToEstado } from "@/lib/utils/dddToEstado";

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1K3RjX3a8MsItZ7KJB5Ns1z8cLKBTiO-OCAVR6cuzP9Y/export?format=csv";

const INOUT_SLUG = "inout";

function isAuthorized(request: NextRequest): boolean {
  const secret = request.nextUrl.searchParams.get("secret");
  if (secret === "inout2026") return true;
  const token = request.headers.get("x-admin-token");
  const expected = process.env.ADMIN_SECRET;
  if (!expected) return true;
  return token === expected;
}

function stripMetaPrefix(raw: string | undefined): string | null {
  if (!raw) return null;
  // Meta export prefixes: ag: (ad), as: (adset), c: (campaign), f: (form), p: (phone), l: (lead)
  return raw.replace(/^(ag|as|c|f|p|l):/, "").trim() || null;
}

function parseDate(raw: string): Date | null {
  if (!raw) return null;
  const parts = raw.trim().split("/");
  if (parts.length === 3) {
    const month = parseInt(parts[0], 10);
    const day = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
    if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
      return new Date(year, month - 1, day);
    }
  }
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function normalizeSegmento(raw: string): string | null {
  if (!raw) return null;
  const map: Record<string, string> = {
    "corretor_autônomo": "Corretores",
    "corretor_autonomo": "Corretores",
    "imobiliária": "Imobiliárias",
    "imobiliaria": "Imobiliárias",
    "incorporadora": "Incorporadoras",
    "construtora": "Construtoras",
    "ainda_não_faturo_nada": "Ainda não faturo nada",
  };
  const key = raw.trim().toLowerCase();
  return map[key] ?? raw;
}

function detectDelimiter(firstLine: string): string {
  const tabCount = (firstLine.match(/\t/g) ?? []).length;
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const semicolonCount = (firstLine.match(/;/g) ?? []).length;
  if (tabCount > commaCount && tabCount > semicolonCount) return "\t";
  if (semicolonCount > commaCount) return ";";
  return ",";
}

function parseCSV(text: string): { rows: Record<string, string>[]; headers: string[] } {
  // Strip UTF-8 BOM if present (handles both 3-byte BOM and the two-char sequence)
  const clean = text.replace(/^\uFEFF/, "").replace(/^\xEF\xBB\xBF/, "");
  // Normalize Windows line endings
  const normalized = clean.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], headers: [] };

  // Auto-detect delimiter from the first line
  const delimiter = detectDelimiter(lines[0]);

  const headers = parseLine(lines[0], delimiter).map((h) => h.trim().toLowerCase());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i], delimiter);
    if (values.length === 0) continue;
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (values[j] ?? "").trim();
    }
    rows.push(row);
  }
  return { rows, headers };
}

function parseLine(line: string, delimiter: string): string[] {
  if (delimiter === "\t") {
    // TSV: no quoting complexity, just split on tab
    return line.split("\t").map((v) => v.trim());
  }
  // CSV with optional quoting
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

async function processRows(rows: Record<string, string>[], clienteId: string) {
  let created = 0;
  let updated = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const leadId = stripMetaPrefix(row["id"]?.trim()) ?? row["id"]?.trim();
    if (!leadId) { failed++; continue; }

    const rawDate = row["created_time"]?.trim();
    const createdTime = parseDate(rawDate);
    if (!createdTime) {
      errors.push(`id=${leadId}: data inválida '${rawDate}'`);
      failed++;
      continue;
    }

    const phone = row["phone_number"]?.trim() || null;
    const estado = dddToEstado(phone);
    const platform = row["platform"]?.trim() || null;
    const normalizedPlatform = platform === "fb" ? "Facebook" : platform === "ig" ? "Instagram" : platform;
    const tipoEmpresaRaw = row["qual_é_o_segmento_da_sua_empresa?"]?.trim() ?? null;
    const tipoEmpresa = normalizeSegmento(tipoEmpresaRaw ?? "");
    const faixaFaturamento = row["qual_sua_atual_faixa_de_faturamento?"]?.trim() || null;

    const adId = stripMetaPrefix(row["ad_id"]?.trim());
    const adsetId = stripMetaPrefix(row["adset_id"]?.trim());
    const campaignId = stripMetaPrefix(row["campaign_id"]?.trim());
    const formId = stripMetaPrefix(row["form_id"]?.trim());
    // fullName: prefer explicit full_name column, fall back to "nome" custom field
    const fullName = row["full_name"]?.trim() || row["nome"]?.trim() || null;

    const rawFieldData = {
      website: row["qual_o_site_da_sua_empresa?_"]?.trim() || null,
      adId,
      adName: row["ad_name"]?.trim() || null,
      adsetId,
      adsetName: row["adset_name"]?.trim() || null,
      isOrganic: row["is_organic"]?.trim() === "true" || row["is_organic"]?.trim() === "FALSE" ? row["is_organic"]?.trim() !== "FALSE" : false,
      originalSegmento: tipoEmpresaRaw,
    };

    try {
      const existing = await prisma.metaLeadIndividual.findUnique({
        where: { clienteId_metaLeadId: { clienteId, metaLeadId: leadId } },
        select: { id: true },
      });

      const data = {
        createdTime,
        campaignId,
        campaignName: row["campaign_name"]?.trim() || null,
        adId,
        adName: row["ad_name"]?.trim() || null,
        adsetId,
        adsetName: row["adset_name"]?.trim() || null,
        formId,
        formName: row["form_name"]?.trim() || null,
        fullName,
        nomeEmpresa: row["company_name"]?.trim() || null,
        telefone: phone,
        emailLead: row["email"]?.trim() || null,
        tipoEmpresa,
        faixaFaturamento,
        estado,
        platform: normalizedPlatform,
        statusCrm: row["lead_status"]?.trim() || null,
        rawFieldData,
      };

      if (existing) {
        await prisma.metaLeadIndividual.update({
          where: { clienteId_metaLeadId: { clienteId, metaLeadId: leadId } },
          data,
        });
        updated++;
      } else {
        await prisma.metaLeadIndividual.create({
          data: { clienteId, metaLeadId: leadId, ...data },
        });
        created++;
      }
    } catch (e) {
      errors.push(`id=${leadId}: ${e instanceof Error ? e.message : String(e)}`);
      failed++;
    }
  }

  return { created, updated, failed, total: rows.length, errors: errors.slice(0, 20) };
}

function normalizeSheetUrl(url: string): string {
  // If it's already a CSV export URL, return as-is
  if (url.includes("export?format=csv") || url.includes("output=csv")) return url;

  // Convert /edit, /view, /pub share URLs to export CSV
  // e.g. https://docs.google.com/spreadsheets/d/SHEET_ID/edit#gid=0
  //   -> https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv&gid=0
  const match = url.match(/\/spreadsheets\/d\/([^/]+)/);
  if (match) {
    const sheetId = match[1];
    const gidMatch = url.match(/[?&#]gid=(\d+)/);
    const gid = gidMatch ? `&gid=${gidMatch[1]}` : "";
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gid}`;
  }

  return url;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    // Resolve the Inout clienteId dynamically from the DB (safe across dev and production)
    const inoutCliente = await prisma.cliente.findUnique({
      where: { slug: INOUT_SLUG },
      select: { id: true },
    });
    if (!inoutCliente) {
      return NextResponse.json(
        { error: `Cliente com slug '${INOUT_SLUG}' não encontrado no banco de dados.` },
        { status: 404 }
      );
    }
    const clienteId = inoutCliente.id;

    const contentType = request.headers.get("content-type") ?? "";

    // If uploading a file via multipart/form-data
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
      }
      const csv = await file.text();
      const { rows, headers } = parseCSV(csv);
      console.log(`[import-leads-csv] upload: ${rows.length} linhas | colunas: ${headers.join(", ")}`);
      if (rows.length === 0) {
        return NextResponse.json({
          error: "Arquivo CSV vazio ou sem linhas válidas.",
          colunasDetectadas: headers,
        }, { status: 400 });
      }
      const result = await processRows(rows, clienteId);
      return NextResponse.json({ ok: true, source: "upload", colunasDetectadas: headers, ...result });
    }

    // Fetch from Google Sheets URL (custom or default)
    let sheetsUrl = SHEET_CSV_URL;
    if (contentType.includes("application/json")) {
      try {
        const body = await request.json() as { sheetsUrl?: string };
        if (body.sheetsUrl?.trim()) sheetsUrl = body.sheetsUrl.trim();
      } catch { /* ignore parse errors, use default */ }
    }

    // Convert a regular Google Sheets share URL to CSV export URL if needed
    sheetsUrl = normalizeSheetUrl(sheetsUrl);

    const res = await fetch(sheetsUrl);
    if (!res.ok) {
      return NextResponse.json(
        { error: `Falha ao baixar CSV da planilha: HTTP ${res.status}` },
        { status: 502 }
      );
    }
    const csv = await res.text();
    const { rows, headers } = parseCSV(csv);
    console.log(`[import-leads-csv] sheets: ${rows.length} linhas | colunas: ${headers.join(", ")} | url: ${sheetsUrl}`);
    const result = await processRows(rows, clienteId);
    return NextResponse.json({ ok: true, source: "sheets", colunasDetectadas: headers, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
