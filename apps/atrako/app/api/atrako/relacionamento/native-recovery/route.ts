import { NextRequest, NextResponse } from "next/server";
import { gate } from "@/lib/flows/api";
import { detectNativeRecovery } from "@/lib/flows/native-recovery";

export async function GET(request: NextRequest) {
  const g = await gate(request);
  if (!g.ok) return g.response;
  const detections = await detectNativeRecovery(g.workspaceId);
  return NextResponse.json({ detections });
}
