import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/symbius/auth";

export async function POST(request: NextRequest) {
  await clearSessionCookie();
  return NextResponse.redirect(new URL("/login", request.url));
}
