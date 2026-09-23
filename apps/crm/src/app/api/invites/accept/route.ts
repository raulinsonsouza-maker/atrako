import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "better-auth/crypto";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { token, name, password } = (await req.json()) as {
      token?: string;
      name?: string;
      password?: string;
    };
    if (!token || !name || !password || password.length < 8) {
      return NextResponse.json(
        { message: "Token, nome e senha (mín. 8 caracteres) são obrigatórios." },
        { status: 400 }
      );
    }

    const invite = await db.invite.findUnique({ where: { token } });
    if (!invite || invite.expiresAt < new Date()) {
      return NextResponse.json({ message: "Convite inválido ou expirado." }, { status: 400 });
    }

    const existing = await db.user.findFirst({
      where: { tenantId: invite.tenantId, email: invite.email },
    });
    if (existing) {
      return NextResponse.json({ message: "Já existe um usuário com este e-mail neste tenant." }, { status: 400 });
    }

    const hashed = await hashPassword(password);
    const user = await db.user.create({
      data: {
        tenantId: invite.tenantId,
        email: invite.email,
        name: name.trim(),
        role: invite.role,
      },
    });

    await db.account.create({
      data: {
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: hashed,
      },
    });

    await db.invite.delete({ where: { id: invite.id } });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("accept-invite", e);
    return NextResponse.json({ message: "Erro ao aceitar convite." }, { status: 500 });
  }
}
