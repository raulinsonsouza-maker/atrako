import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { db } from "@/lib/db";

/**
 * GET /api/super-admin/view-as?tenant=ID
 * Super-admin: define cookie viewAsTenant e redireciona para /dashboard.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  const role = (session?.user as { role?: string })?.role;
  if (role !== "SUPER_ADMIN") {
    return NextResponse.redirect(new URL("/super-admin", req.url));
  }

  const tenantId = req.nextUrl.searchParams.get("tenant");
  if (!tenantId) {
    return NextResponse.redirect(new URL("/super-admin", req.url));
  }

  const tenant = await db.tenant.findFirst({
    where: { id: tenantId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!tenant) {
    return NextResponse.redirect(new URL("/super-admin/tenants", req.url));
  }

  const res = NextResponse.redirect(new URL("/dashboard", req.url));
  res.cookies.set("viewAsTenant", tenantId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60,
  });
  return res;
}
