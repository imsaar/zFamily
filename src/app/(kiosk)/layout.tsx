import type { Viewport } from "next";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Screensaver } from "@/components/Screensaver";
import { PinProviders } from "@/components/PinProviders";
import { PinSetupGate } from "@/components/PinSetupGate";
import { listMembers } from "@/lib/members";
import { getWeather } from "@/lib/weather";
import { getAllSettings } from "@/lib/settings";
import { listEventsInRange } from "@/lib/events";
import { memberPinFlags } from "@/lib/pins";
import { listParents } from "@/lib/members";

export const viewport: Viewport = {
  width: 1920,
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const dynamic = "force-dynamic";

export default async function KioskLayout({ children }: { children: React.ReactNode }) {
  const members = listMembers();
  const parents = listParents();
  const weather = await getWeather();
  const settings = getAllSettings();
  const pinFlags = memberPinFlags();

  const nowSec = Math.floor(Date.now() / 1000);
  const upcomingEvents = listEventsInRange(nowSec, nowSec + 24 * 3600).slice(0, 3);

  const parentsNeedingPin = parents.filter((p) => !p.pin_hash);

  return (
    <PinProviders hasPinByMember={pinFlags} parents={parents}>
      <Header members={members} weather={weather} />
      <main className="flex-1 overflow-hidden">{children}</main>
      <BottomNav />
      {parents.length > 0 && parentsNeedingPin.length > 0 && (
        <PinSetupGate parentsNeedingPin={parentsNeedingPin} />
      )}
      <Screensaver
        weather={weather}
        upcomingEvents={upcomingEvents}
        members={members}
        quietStart={settings.quiet_start ?? "21:00"}
        quietEnd={settings.quiet_end ?? "07:00"}
        idleSeconds={Number(settings.idle_seconds ?? 300)}
        mode={settings.screensaver_mode ?? "clock"}
      />
    </PinProviders>
  );
}
