import type { Viewport } from "next";
import { PinProviders } from "@/components/PinProviders";
import { memberPinFlags } from "@/lib/pins";
import { listParents } from "@/lib/members";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#18181b",
};

export const dynamic = "force-dynamic";

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const pinFlags = memberPinFlags();
  const parents = listParents();
  return (
    <PinProviders hasPinByMember={pinFlags} parents={parents}>
      <div className="flex-1 flex flex-col overflow-y-auto bg-zinc-50">{children}</div>
    </PinProviders>
  );
}
