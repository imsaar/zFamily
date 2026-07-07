"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Mounted on the always-on kiosk. Periodically pings the iCal sync endpoint,
 *  which only refetches feeds whose per-feed interval has elapsed — so this is
 *  cheap and effectively syncs each feed "every N hours" with no external cron.
 *  Refreshes the page when new events actually arrive. */
export function IcalAutoSync({ pollMinutes = 30 }: { pollMinutes?: number }) {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch("/api/ical/sync", { method: "POST" });
        const data = (await res.json().catch(() => null)) as { synced?: number } | null;
        if (!cancelled && data && (data.synced ?? 0) > 0) router.refresh();
      } catch {
        // offline / transient — try again next tick
      }
    };
    run();
    const id = setInterval(run, Math.max(1, pollMinutes) * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pollMinutes, router]);
  return null;
}
