import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { normalizeCommissionPercent } from "@/lib/payments/commission";
import {
  apiRequireAdmin,
  apiAuthContext,
  isFullAdminRole,
  isProfessionalRole,
} from "@/lib/rbac";

async function getOwnedPro(id: string, organizationId: string) {
  return prisma.professional.findFirst({
    where: { id, organizationId },
    include: {
      membership: { include: { user: true } },
      services: true,
      availability: true,
    },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await apiAuthContext();
  if ("error" in auth) return auth.error;
  const { id } = await params;

  if (isProfessionalRole(auth.ctx.role)) {
    if (auth.ctx.professionalId !== id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const pro = await getOwnedPro(id, auth.ctx.organizationId);
  if (!pro) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: pro.id,
    displayName: pro.displayName,
    photoUrl: pro.photoUrl,
    isActive: pro.isActive,
    sortOrder: pro.sortOrder,
    email: pro.membership.user.email,
    serviceIds: pro.services.map((s) => s.serviceId),
    commissionEnabled: pro.commissionEnabled,
    commissionPercent: pro.commissionPercent,
    availability: pro.availability.map((r) => ({
      dayOfWeek: r.dayOfWeek,
      startTime: r.startTime,
      endTime: r.endTime,
    })),
  });
}

const patchSchema = z.object({
  displayName: z.string().min(2).optional(),
  photoUrl: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  serviceIds: z.array(z.string()).optional(),
  password: z.string().min(6).optional(),
  email: z.string().email().optional(),
  commissionEnabled: z.boolean().optional(),
  commissionPercent: z.number().int().min(0).max(100).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await apiAuthContext();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const isSelf =
    isProfessionalRole(auth.ctx.role) && auth.ctx.professionalId === id;
  const isAdmin = isFullAdminRole(auth.ctx.role);

  if (!isSelf && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (isAdmin) {
    const admin = await apiRequireAdmin();
    if ("error" in admin) return admin.error;
  }

  const pro = await getOwnedPro(id, auth.ctx.organizationId);
  if (!pro) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = patchSchema.parse(await req.json());

    if (isSelf) {
      // Pro pode: nome, foto, senha ÔÇö n├úo servi├ºos/ativo/ordem
      if (body.displayName !== undefined) {
        await prisma.professional.update({
          where: { id },
          data: { displayName: body.displayName },
        });
        await prisma.user.update({
          where: { id: pro.membership.userId },
          data: { name: body.displayName },
        });
      }
      if (body.photoUrl !== undefined) {
        await prisma.professional.update({
          where: { id },
          data: { photoUrl: body.photoUrl },
        });
      }
      if (body.password) {
        await prisma.user.update({
          where: { id: pro.membership.userId },
          data: {
            passwordHash: await bcrypt.hash(body.password, 10),
            mustChangePassword: false,
          },
        });
      }
    } else {
      if (body.serviceIds) {
        const valid = await prisma.service.count({
          where: {
            id: { in: body.serviceIds },
            organizationId: auth.ctx.organizationId,
          },
        });
        if (valid !== body.serviceIds.length) {
          return NextResponse.json({ error: "Servi├ºo inv├ílido" }, { status: 400 });
        }
        await prisma.professionalService.deleteMany({
          where: { professionalId: id },
        });
        if (body.serviceIds.length) {
          await prisma.professionalService.createMany({
            data: body.serviceIds.map((serviceId) => ({
              professionalId: id,
              serviceId,
            })),
          });
        }
      }

      await prisma.professional.update({
        where: { id },
        data: {
          ...(body.displayName !== undefined
            ? { displayName: body.displayName }
            : {}),
          ...(body.photoUrl !== undefined ? { photoUrl: body.photoUrl } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
          ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
          ...(body.commissionEnabled !== undefined
            ? { commissionEnabled: body.commissionEnabled }
            : {}),
          ...(body.commissionPercent !== undefined
            ? {
                commissionPercent: normalizeCommissionPercent(
                  body.commissionPercent,
                  pro.commissionPercent,
                ),
              }
            : {}),
        },
      });

      if (body.displayName) {
        await prisma.user.update({
          where: { id: pro.membership.userId },
          data: { name: body.displayName },
        });
      }
      if (body.email) {
        const email = body.email.toLowerCase().trim();
        const clash = await prisma.user.findFirst({
          where: {
            email,
            NOT: { id: pro.membership.userId },
          },
        });
        if (clash) {
          return NextResponse.json(
            { error: "J├í existe uma conta com este e-mail." },
            { status: 409 },
          );
        }
        await prisma.user.update({
          where: { id: pro.membership.userId },
          data: { email },
        });
      }
      if (body.password) {
        await prisma.user.update({
          where: { id: pro.membership.userId },
          data: {
            passwordHash: await bcrypt.hash(body.password, 10),
            mustChangePassword: true,
          },
        });
      }
    }

    const updated = await getOwnedPro(id, auth.ctx.organizationId);
    return NextResponse.json({
      id: updated!.id,
      displayName: updated!.displayName,
      photoUrl: updated!.photoUrl,
      isActive: updated!.isActive,
      sortOrder: updated!.sortOrder,
      email: updated!.membership.user.email,
      serviceIds: updated!.services.map((s) => s.serviceId),
      commissionEnabled: updated!.commissionEnabled,
      commissionPercent: updated!.commissionPercent,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inv├ílidos" }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Erro" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await apiRequireAdmin();
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const pro = await getOwnedPro(id, auth.ctx.organizationId);
  if (!pro) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const bookings = await prisma.booking.count({
    where: { professionalId: id },
  });
  if (bookings > 0) {
    await prisma.professional.update({
      where: { id },
      data: { isActive: false },
    });
    return NextResponse.json({
      ok: true,
      deactivated: true,
      message: "Profissional desativado (h├í hist├│rico de agendamentos).",
    });
  }

  const userId = pro.membership.userId;
  await prisma.$transaction(async (tx) => {
    await tx.professional.delete({ where: { id } });
    await tx.membership.delete({ where: { id: pro.membershipId } });
    await tx.user.delete({ where: { id: userId } });
  });

  return NextResponse.json({ ok: true, deleted: true });
}