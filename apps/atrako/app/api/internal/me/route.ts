import { NextResponse } from "next/server";
import { getInternalUser } from "@/lib/internalUsers";

export async function GET() {
  try {
    const user = await getInternalUser();
    if (!user || !user.active) return NextResponse.json({ role: null });
    return NextResponse.json({
      role: user.role,
      username: user.username ?? null,
      openAccess: user.id === "atrako-open-access",
      mustChangePassword: user.mustChangePassword,
    });
  } catch {
    return NextResponse.json({ role: null });
  }
}