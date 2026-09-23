import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "./db";

// Better-Auth espera modelos em minúsculo (user, session, account). Alias para o Prisma.
const d = db as unknown as { User: unknown; Session: unknown; Account: unknown };
const dbForAuth = Object.assign(db, { user: d.User, session: d.Session, account: d.Account });

export const auth = betterAuth({
  database: prismaAdapter(dbForAuth, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET || "dev-secret-change-in-production",
  basePath: "/api/auth",
  trustedOrigins: [
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
  ].filter(Boolean),
  user: {
    additionalFields: {
      tenantId: { type: "string", required: false },
      role: { type: "string", required: false, defaultValue: "TENANT_USER" },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 dias
    updateAge: 60 * 60 * 24, // 1 dia
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ url, user }) => {
      // Em produção: enviar e-mail (Resend, Nodemailer, etc.)
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.log("[dev] Reset password link:", url, "for", user.email);
      }
    },
  },
  signUp: { enabled: false },
});

export type Session = Awaited<ReturnType<typeof auth.api.getSession>> extends Promise<infer S> ? S : never;
