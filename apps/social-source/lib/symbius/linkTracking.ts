import crypto from "crypto";
import { prisma } from "@/lib/db";
import { getSymbiusAppUrl } from "@/lib/instagram/metaOAuth";

type LinkTokenPayload = {
  c: string;
  f: string;
  e: string;
  u: string;
  exp: number;
};

function trackingSecret(): string {
  return (
    process.env.SYMBIUS_LINK_TRACKING_SECRET ??
    process.env.ADMIN_SECRET ??
    process.env.CRON_SECRET ??
    "symbius-link-dev"
  );
}

export function buildLinkTrackingUrl(params: {
  contatoId: string;
  fluxoId: string;
  reminderExecId: string;
  destination: string;
}): string {
  const data: LinkTokenPayload = {
    c: params.contatoId,
    f: params.fluxoId,
    e: params.reminderExecId,
    u: params.destination,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
  };
  const body = Buffer.from(JSON.stringify(data)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", trackingSecret())
    .update(body)
    .digest("base64url");
  return `${getSymbiusAppUrl()}/api/symbius/go/${body}.${sig}`;
}

export function parseLinkTrackingToken(token: string): LinkTokenPayload | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto
    .createHmac("sha256", trackingSecret())
    .update(body)
    .digest("base64url");
  try {
    if (
      !crypto.timingSafeEqual(
        Buffer.from(sig, "utf8"),
        Buffer.from(expected, "utf8"),
      )
    ) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const data = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as LinkTokenPayload;
    if (!data.u || !data.c || !data.f || !data.e) return null;
    if (data.exp < Date.now()) return null;
    if (!/^https?:\/\//i.test(data.u)) return null;
    return data;
  } catch {
    return null;
  }
}

export async function markRewardLinkClicked(params: {
  reminderExecId: string;
  contatoId: string;
  fluxoId: string;
}): Promise<void> {
  const exec = await prisma.igFluxoExecucao.findUnique({
    where: { id: params.reminderExecId },
  });
  if (exec) {
    const ctx = (exec.context ?? {}) as Record<string, unknown>;
    await prisma.igFluxoExecucao.update({
      where: { id: exec.id },
      data: {
        status: "COMPLETED",
        context: {
          ...ctx,
          step: "reminder",
          linkClicked: true,
          clickedAt: new Date().toISOString(),
        } as object,
      },
    });
  }

  const contato = await prisma.igContato.findUnique({
    where: { id: params.contatoId },
  });
  if (!contato) return;

  const tag = `link_clicked:${params.fluxoId}`;
  if (contato.tags.includes(tag)) return;

  await prisma.igContato.update({
    where: { id: params.contatoId },
    data: {
      tags: [
        ...contato.tags.filter((t) => !t.startsWith("link_clicked:")),
        tag,
      ],
    },
  });

  const { recordConversion } = await import("@/lib/symbius/conversions");
  await recordConversion({
    organizationId: contato.organizationId,
    tipo: "link_clicked",
    contatoId: params.contatoId,
    fluxoId: params.fluxoId,
  });
}

export function contactClickedRewardLink(
  tags: string[],
  fluxoId: string,
): boolean {
  return tags.includes(`link_clicked:${fluxoId}`);
}
