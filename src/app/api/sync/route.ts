import { NextResponse } from "next/server";
import { syncAllMembers } from "@/lib/google";
import { syncDueFeeds } from "@/lib/ical";
import { maybeAutoBackup } from "@/lib/backup";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    try { maybeAutoBackup(); } catch { /* never block sync */ }
    const result = await syncAllMembers();
    // Also refresh any iCal subscription feeds whose interval has elapsed.
    const ical = await syncDueFeeds();
    revalidatePath("/");
    revalidatePath("/week");
    revalidatePath("/month");
    return NextResponse.json({ ok: true, ...result, ical });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
