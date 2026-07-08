import { SettingsPanel } from "@/components/SettingsPanel";
import { SettingsGate } from "@/components/SettingsGate";
import { listMembers } from "@/lib/members";
import { listChores } from "@/lib/chores";
import { listRewards } from "@/lib/rewards";
import { getAllSettings } from "@/lib/settings";
import { listFeeds } from "@/lib/ical";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const members = listMembers();
  const chores = listChores();
  const rewards = listRewards(false);
  const settings = getAllSettings();
  const feeds = listFeeds();
  return (
    <SettingsGate>
      <SettingsPanel members={members} chores={chores} rewards={rewards} settings={settings} feeds={feeds} />
    </SettingsGate>
  );
}
