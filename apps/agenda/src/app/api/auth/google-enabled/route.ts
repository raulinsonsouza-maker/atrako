import { NextResponse } from "next/server";
import { googleLoginEnabled } from "@/lib/auth";

export async function GET() {
  return NextResponse.json({ enabled: googleLoginEnabled() });
}
