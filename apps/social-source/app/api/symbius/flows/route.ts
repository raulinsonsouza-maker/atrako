import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/symbius/auth";
import { canPublishFluxo } from "@/lib/symbius/tenant";
import { enrichCommentDmTriggerConfig } from "@/lib/instagram/commentDmFlow";

const createSchema = z.object({
  nome: z.string().min(1),
  triggerType: z.string().optional(),
  triggerConfig: z.record(z.unknown()).optional(),
  template: z.enum(["welcome", "comment_dm", "keyword", "blank", "story_dm", "sequence"]).optional(),
  fluxoKind: z.enum(["automation", "sequence"]).optional(),
  igAccountId: z.string().optional(),
  pastaId: z.string().nullable().optional(),
  messageText: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});

function templateNodes(template: string, messageText?: string) {
  if (template === "welcome") {
    return [
      {
        tipo: "trigger",
        config: {},
        posX: 100,
        posY: 100,
        nextIds: [] as string[],
      },
      {
        tipo: "send_message",
        config: {
          text:
            messageText ??
            "Olá! 👋 Obrigado por entrar em contato. Como posso ajudar?",
        },
        posX: 100,
        posY: 220,
        nextIds: [] as string[],
      },
    ];
  }
  if (template === "comment_dm") {
    const welcome =
      messageText ??
      "Olá! Eu estou muito feliz que você está aqui, muito obrigado pelo seu interesse 😊\n\nClique abaixo e eu vou te mandar o link em um segundo ✨";
    return [
      {
        tipo: "trigger",
        config: {},
        posX: 100,
        posY: 100,
        nextIds: [] as string[],
      },
      {
        tipo: "send_message",
        config: {
          text: welcome,
          buttons: [
            { type: "postback", title: "Me envie o link", payload: "reward" },
          ],
        },
        posX: 100,
        posY: 220,
        nextIds: [] as string[],
      },
    ];
  }
  if (template === "keyword") {
    return [
      {
        tipo: "trigger",
        config: {},
        posX: 100,
        posY: 100,
        nextIds: [] as string[],
      },
      {
        tipo: "send_message",
        config: {
          text:
            messageText ??
            "Aqui está o link que você pediu: https://exemplo.com",
        },
        posX: 100,
        posY: 220,
        nextIds: [] as string[],
      },
    ];
  }
  if (template === "story_dm") {
    return [
      {
        tipo: "trigger",
        config: {},
        posX: 100,
        posY: 100,
        nextIds: [] as string[],
      },
      {
        tipo: "send_message",
        config: {
          text:
            messageText ??
            "🔥 Quer receber mais informações? Clique no link abaixo 👇",
        },
        posX: 100,
        posY: 220,
        nextIds: [] as string[],
      },
    ];
  }
  if (template === "sequence") {
    return [
      { tipo: "trigger", config: {}, posX: 100, posY: 100, nextIds: [] as string[] },
      {
        tipo: "send_message",
        config: { text: messageText ?? "Olá! Esta é a primeira mensagem da sequência." },
        posX: 100,
        posY: 220,
        nextIds: [] as string[],
      },
      {
        tipo: "wait",
        config: { minutes: 60 },
        posX: 100,
        posY: 340,
        nextIds: [] as string[],
      },
      {
        tipo: "send_message",
        config: { text: "Seguindo up — ainda tem interesse?" },
        posX: 100,
        posY: 460,
        nextIds: [] as string[],
      },
    ];
  }
  return [
    {
      tipo: "trigger",
      config: {},
      posX: 100,
      posY: 100,
      nextIds: [] as string[],
    },
  ];
}

function templateTrigger(template: string) {
  if (template === "welcome") {
    return { triggerType: "welcome", triggerConfig: {} };
  }
  if (template === "comment_dm") {
    return {
      triggerType: "comment_keyword",
      triggerConfig: {
        keywords: ["link", "quero", "preço"],
        mediaFilter: "any",
      },
    };
  }
  if (template === "keyword") {
    return {
      triggerType: "keyword",
      triggerConfig: { keywords: ["link", "info"] },
    };
  }
  if (template === "story_dm") {
    return {
      triggerType: "story_reply",
      triggerConfig: {
        anyKeyword: true,
        storyFilter: "any",
        welcomeEnabled: false,
      },
    };
  }
  if (template === "sequence") {
    return {
      triggerType: "tag_entry",
      triggerConfig: { entryTag: "sequencia" },
    };
  }
  return {
    triggerType: "unset",
    triggerConfig: {},
  };
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const kind = request.nextUrl.searchParams.get("kind");

  const fluxos = await prisma.igFluxo.findMany({
    where: {
      organizationId: session.organizationId,
      ...(kind === "sequence"
        ? { fluxoKind: "sequence" }
        : kind === "automation"
          ? { fluxoKind: { not: "sequence" } }
          : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      pasta: { select: { id: true, nome: true } },
      _count: { select: { nos: true, execucoes: true } },
    },
  });

  return NextResponse.json({ fluxos });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const template = parsed.data.template ?? "blank";
  const baseTrig =
    template !== "blank"
      ? templateTrigger(template)
      : {
          triggerType: parsed.data.triggerType ?? "unset",
          triggerConfig: parsed.data.triggerConfig ?? {},
        };

  const wantPublish = parsed.data.status === "PUBLISHED";

  const trig = {
    triggerType: baseTrig.triggerType,
    triggerConfig: {
      ...(baseTrig.triggerConfig as Record<string, unknown>),
      ...(parsed.data.triggerConfig ?? {}),
    },
  };

  if (wantPublish && trig.triggerType === "comment_keyword") {
    trig.triggerConfig = await enrichCommentDmTriggerConfig(
      session.organizationId,
      trig.triggerConfig,
    );
  }

  const nodes = templateNodes(template, parsed.data.messageText);
  const createdNodes: string[] = [];

  if (wantPublish && !(await canPublishFluxo(session.organizationId))) {
    return NextResponse.json(
      { error: "Limite de fluxos publicados do plano atingido" },
      { status: 403 },
    );
  }

  const fluxo = await prisma.$transaction(async (tx) => {
    const f = await tx.igFluxo.create({
      data: {
        organizationId: session.organizationId,
        igAccountId: parsed.data.igAccountId,
        pastaId: parsed.data.pastaId ?? undefined,
        nome: parsed.data.nome,
        status: wantPublish ? "PUBLISHED" : "DRAFT",
        triggerType: trig.triggerType,
        triggerConfig: trig.triggerConfig as object,
        fluxoKind:
          parsed.data.fluxoKind ??
          (template === "sequence" ? "sequence" : "automation"),
      },
    });

    for (const n of nodes) {
      let config = n.config as Record<string, unknown>;
      if (
        (template === "comment_dm" || template === "story_dm") &&
        n.tipo === "send_message"
      ) {
        const cfg = trig.triggerConfig as Record<string, unknown>;
        if (template === "comment_dm") {
          const welcomeButton = String(cfg.welcomeButton ?? "Me envie o link");
          config = {
            ...config,
            text: String(cfg.welcomeText ?? config.text) || String(config.text ?? ""),
            buttons: [
              {
                type: "postback",
                title: welcomeButton,
                payload: `symbius_reward:${f.id}`,
              },
            ],
          };
        } else {
          const rewardButton = String(cfg.rewardButton ?? "Acessar");
          const rewardUrl = String(cfg.rewardUrl ?? "").trim();
          config = {
            ...config,
            text: String(cfg.rewardText ?? config.text) || String(config.text ?? ""),
            buttons: rewardUrl
              ? [{ type: "web_url", title: rewardButton, url: rewardUrl }]
              : undefined,
          };
        }
      }
      const created = await tx.igFluxoNo.create({
        data: {
          fluxoId: f.id,
          tipo: n.tipo,
          config: config as object,
          posX: n.posX,
          posY: n.posY,
          nextIds: [],
        },
      });
      createdNodes.push(created.id);
    }

    if (createdNodes.length >= 2) {
      await tx.igFluxoNo.update({
        where: { id: createdNodes[0] },
        data: { nextIds: [createdNodes[1]] },
      });
    }

    if (template === "sequence" && createdNodes.length >= 4) {
      await tx.igFluxoNo.update({
        where: { id: createdNodes[1] },
        data: { nextIds: [createdNodes[2]] },
      });
      await tx.igFluxoNo.update({
        where: { id: createdNodes[2] },
        data: { nextIds: [createdNodes[3]] },
      });
    }

    return f;
  });

  return NextResponse.json({ fluxo });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = (await request.json()) as {
    id: string;
    status?: string;
    nome?: string;
    pastaId?: string | null;
    triggerType?: string;
    triggerConfig?: Record<string, unknown>;
    nodes?: Array<{
      id?: string;
      tipo: string;
      config: Record<string, unknown>;
      posX: number;
      posY: number;
      nextIds: string[];
    }>;
  };

  const fluxo = await prisma.igFluxo.findFirst({
    where: { id: body.id, organizationId: session.organizationId },
  });
  if (!fluxo) {
    return NextResponse.json({ error: "Fluxo não encontrado" }, { status: 404 });
  }

  if (body.status === "PUBLISHED" && !(await canPublishFluxo(session.organizationId))) {
    return NextResponse.json(
      { error: "Limite de fluxos publicados do plano atingido" },
      { status: 403 },
    );
  }

  let triggerConfig = body.triggerConfig;
  if (
    body.status === "PUBLISHED" &&
    (body.triggerType === "comment_keyword" ||
      fluxo.triggerType === "comment_keyword") &&
    triggerConfig
  ) {
    triggerConfig = await enrichCommentDmTriggerConfig(
      session.organizationId,
      triggerConfig,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.igFluxo.update({
      where: { id: body.id },
      data: {
        nome: body.nome,
        status: body.status,
        pastaId: body.pastaId === undefined ? undefined : body.pastaId,
        triggerType: body.triggerType,
        triggerConfig: (triggerConfig ?? body.triggerConfig) as object | undefined,
      },
    });

    if (body.nodes) {
      await tx.igFluxoNo.deleteMany({ where: { fluxoId: body.id } });
      const idMap = new Map<string, string>();

      for (const n of body.nodes) {
        const created = await tx.igFluxoNo.create({
          data: {
            fluxoId: body.id,
            tipo: n.tipo,
            config: n.config as object,
            posX: n.posX,
            posY: n.posY,
            nextIds: [],
          },
        });
        if (n.id) idMap.set(n.id, created.id);
        idMap.set(created.id, created.id);
      }

      const all = await tx.igFluxoNo.findMany({ where: { fluxoId: body.id } });
      for (let i = 0; i < body.nodes.length; i++) {
        const n = body.nodes[i];
        const dbId = all[i]?.id;
        if (!dbId) continue;
        const resolvedNext = n.nextIds
          .map((nid) => {
            const idx = body.nodes!.findIndex((x) => x.id === nid || all[body.nodes!.indexOf(x)]?.id === nid);
            return all[idx]?.id;
          })
          .filter(Boolean) as string[];
        await tx.igFluxoNo.update({
          where: { id: dbId },
          data: { nextIds: resolvedNext.length ? resolvedNext : n.nextIds.filter((x) => all.some((a) => a.id === x)) },
        });
      }
    }
  });

  return NextResponse.json({ ok: true });
}
