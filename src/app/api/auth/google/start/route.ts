import { NextResponse } from "next/server";
import { makeAuthUrl } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const memberId = Number(url.searchParams.get("memberId"));
  if (!memberId) return NextResponse.json({ error: "memberId required" }, { status: 400 });
  try {
    const authUrl = makeAuthUrl(memberId);
    return NextResponse.redirect(authUrl);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
