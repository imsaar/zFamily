import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { syncDueFeeds } from "@/lib/ical";
import { maybeAutoBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";

// Refresh iCal subscription feeds. Without `?force=1` only feeds whose
// per-feed interval has elapsed are refetched, so this is cheap to poll.
export async function POST(req: Request) {
  const force = new URL(req.url).searchParams.get("force") === "1";
  try {
    // The always-on kiosk polls this regularly — a good heartbeat for the
    // periodic auto-backup (only writes when actually due).
    try { maybeAutoBackup(); } catch { /* never block sync */ }
    const result = await syncDueFeeds({ force });
    if (result.synced > 0) {
      revalidatePath("/", "layout");
      revalidatePath("/week");
      revalidatePath("/month");
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}
