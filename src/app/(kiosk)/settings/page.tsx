import { SettingsPanel } from "@/components/SettingsPanel";
import { listMembers } from "@/lib/members";
import { listChores } from "@/lib/chores";
import { listRewards } from "@/lib/rewards";
import { getAllSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const members = listMembers();
  const chores = listChores();
  const rewards = listRewards(false);
  const settings = getAllSettings();
  return <SettingsPanel members={members} chores={chores} rewards={rewards} settings={settings} />;
}
