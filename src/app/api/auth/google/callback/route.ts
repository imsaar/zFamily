import { NextResponse } from "next/server";
import { handleCallback } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");
  if (err) return NextResponse.redirect(new URL("/settings?google=denied", req.url));
  if (!code || !state) return NextResponse.json({ error: "missing code/state" }, { status: 400 });
  try {
    await handleCallback(code, state);
    return NextResponse.redirect(new URL("/settings?google=ok", req.url));
  } catch (e) {
    console.error("[google/callback]", e);
    return NextResponse.redirect(new URL("/settings?google=error", req.url));
  }
}
