import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  apiAuthContext,
  isAdminRole,
  isProfessionalRole,
} from "@/lib/rbac";

const exceptionItem = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isBlocked: z.boolean(),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
});

const putSchema = z
  .object({
    bookingPageId: z.string().optional(),
    professionalId: z.string().optional(),
    weekFrom: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    weekTo: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    exceptions: z.array(exceptionItem),
  })
  .refine(
    (d) =>
      Boolean(d.bookingPageId) !== Boolean(d.professionalId) ||
      (Boolean(d.bookingPageId) && !d.professionalId) ||
      (!d.bookingPageId && Boolean(d.professionalId)),
    { message: "Informe bookingPageId ou professionalId" },
  );

async function canEditProfessional(
  ctx: { role: string; professionalId: string | null; organizationId: string },
  professionalId: string,
) {
  const pro = await prisma.professional.findFirst({
    where: { id: professionalId, organizationId: ctx.organizationId },
  });
  if (!pro) return { ok: false as const, status: 404 };

  const allowed =
    isAdminRole(ctx.role) ||
    (isProfessionalRole(ctx.role) && ctx.professionalId === professionalId);
  if (!allowed) return { ok: false as const, status: 403 };
  return { ok: true as const, pro };
}

export async function GET(req: Request) {
  const auth = await apiAuthContext();
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const { searchParams } = new URL(req.url);
  const bookingPageId = searchParams.get("bookingPageId");
  const professionalId = searchParams.get("professionalId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (professionalId) {
    const access = await canEditProfessional(ctx, professionalId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.status === 403 ? "Sem permiss├úo" : "Not found" },
        { status: access.status },
      );
    }

    const exceptions = await prisma.availabilityException.findMany({
      where: {
        professionalId,
        ...(from || to
          ? {
              date: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      orderBy: { date: "asc" },
    });
    return NextResponse.json(exceptions);
  }

  if (!bookingPageId) {
    return NextResponse.json(
      { error: "bookingPageId ou professionalId obrigat├│rio" },
      { status: 400 },
    );
  }

  if (!isAdminRole(ctx.role)) {
    return NextResponse.json({ error: "Sem permiss├úo" }, { status: 403 });
  }

  const page = await prisma.bookingPage.findFirst({
    where: { id: bookingPageId, organizationId: ctx.organizationId },
  });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const exceptions = await prisma.availabilityException.findMany({
    where: {
      bookingPageId,
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    },
    orderBy: { date: "asc" },
  });
  return NextResponse.json(exceptions);
}

export async function PUT(req: Request) {
  const auth = await apiAuthContext();
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  try {
    const body = putSchema.parse(await req.json());

    if (body.professionalId) {
      const access = await canEditProfessional(ctx, body.professionalId);
      if (!access.ok) {
        return NextResponse.json(
          { error: access.status === 403 ? "Sem permiss├úo" : "Not found" },
          { status: access.status },
        );
      }

      const deleteWhere =
        body.weekFrom && body.weekTo
          ? {
              professionalId: body.professionalId,
              date: { gte: body.weekFrom, lte: body.weekTo },
            }
          : {
              professionalId: body.professionalId,
              date: { in: [...new Set(body.exceptions.map((e) => e.date))] },
            };

      await prisma.$transaction([
        prisma.availabilityException.deleteMany({ where: deleteWhere }),
        ...(body.exceptions.length
          ? [
              prisma.availabilityException.createMany({
                data: body.exceptions.map((e) => ({
                  professionalId: body.professionalId!,
                  date: e.date,
                  isBlocked: e.isBlocked,
                  startTime: e.startTime ?? null,
                  endTime: e.endTime ?? null,
                })),
              }),
            ]
          : []),
      ]);

      const exceptions = await prisma.availabilityException.findMany({
        where: { professionalId: body.professionalId },
        orderBy: { date: "asc" },
      });
      return NextResponse.json(exceptions);
    }

    if (!isAdminRole(ctx.role)) {
      return NextResponse.json({ error: "Sem permiss├úo" }, { status: 403 });
    }

    const page = await prisma.bookingPage.findFirst({
      where: {
        id: body.bookingPageId!,
        organizationId: ctx.organizationId,
      },
    });
    if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.$transaction([
      prisma.availabilityException.deleteMany({
        where: { bookingPageId: body.bookingPageId! },
      }),
      prisma.availabilityException.createMany({
        data: body.exceptions.map((e) => ({
          bookingPageId: body.bookingPageId!,
          date: e.date,
          isBlocked: e.isBlocked,
          startTime: e.startTime ?? null,
          endTime: e.endTime ?? null,
        })),
      }),
    ]);

    const exceptions = await prisma.availabilityException.findMany({
      where: { bookingPageId: body.bookingPageId! },
      orderBy: { date: "asc" },
    });
    return NextResponse.json(exceptions);
  } catch {
    return NextResponse.json({ error: "Dados inv├ílidos" }, { status: 400 });
  }
}