import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/super-admin/view-as/exit
 * Remove o cookie viewAsTenant e redireciona para /super-admin.
 */
export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/super-admin", req.url));
  res.cookies.set("viewAsTenant", "", { path: "/", maxAge: 0 });
  return res;
}
