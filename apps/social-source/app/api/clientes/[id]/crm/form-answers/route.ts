import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma";

export const dynamic = "force-dynamic";

const CONTACT_FIELDS = new Set([
  "full_name", "nome_completo", "nome", "name",
  "email",
  "phone_number", "telefone", "whatsapp", "celular",
  "company_name", "nome_da_empresa", "empresa",
  "website", "site", "qual_o_site_da_sua_empresa?_",
]);

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

function formatFieldName(raw: string): string {
  return raw
    .replace(/_/g, " ")
    .replace(/[^\w\sÀ-ÿ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

function formatFieldValue(raw: string): string {
  return raw
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const phone = request.nextUrl.searchParams.get("phone");

  if (!phone) {
    return NextResponse.json({ answers: [] });
  }

  const phoneDigits = digitsOnly(phone);
  if (phoneDigits.length < 8) {
    return NextResponse.json({ answers: [] });
  }

  const candidates = await prisma.metaLeadIndividual.findMany({
    where: {
      clienteId: id,
      telefone: { not: null },
      rawFieldData: { not: Prisma.DbNull },
    },
    select: {
      metaLeadId: true,
      telefone: true,
      formName: true,
      rawFieldData: true,
    },
    take: 3000,
  });

  const match = candidates.find((c) => digitsOnly(c.telefone ?? "") === phoneDigits);

  if (!match || !match.rawFieldData) {
    return NextResponse.json({ answers: [] });
  }

  let rawFields: Array<{ name: string; values: string[] }> = [];
  try {
    rawFields = JSON.parse(JSON.stringify(match.rawFieldData)) as typeof rawFields;
  } catch {
    return NextResponse.json({ answers: [] });
  }

  const answers = rawFields
    .filter((f) => !CONTACT_FIELDS.has(f.name.toLowerCase().trim()))
    .map((f) => ({
      label: formatFieldName(f.name),
      value: formatFieldValue(f.values?.[0] ?? ""),
    }))
    .filter((f) => f.label && f.value);

  return NextResponse.json({
    answers,
    formName: match.formName ?? null,
  });
}
