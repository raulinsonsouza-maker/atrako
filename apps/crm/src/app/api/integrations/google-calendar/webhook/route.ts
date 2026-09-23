import { NextRequest, NextResponse } from "next/server";
import { syncCalendarChangesByChannel } from "@/server/actions/calendar";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const channelId = req.headers.get("x-goog-channel-id");
  const resourceId = req.headers.get("x-goog-resource-id");
  const token = req.headers.get("x-goog-channel-token");

  if (process.env.GOOGLE_WEBHOOK_SECRET && token !== process.env.GOOGLE_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (channelId && resourceId) {
    await syncCalendarChangesByChannel(channelId, resourceId);
  }
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
