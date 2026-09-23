import { NextRequest, NextResponse } from "next/server";
import { replaceIncorporadoraDemo } from "@/lib/demo/incorporadoraDemo";
import { isInternalAdminAuthorized } from "@/lib/internalAccess";

export const maxDuration = 300;

async function isAdminAuthorized(): Promise<boolean> {
  return isInternalAdminAuthorized();
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthorized())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await replaceIncorporadoraDemo();
    return NextResponse.json({
      ok: true,
      result,
      portalPath: `/portal/${result.portalToken}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}