export type MemberColor =
  | "rose"
  | "amber"
  | "emerald"
  | "sky"
  | "violet"
  | "fuchsia"
  | "teal"
  | "orange";

export const MEMBER_COLORS: MemberColor[] = [
  "rose",
  "amber",
  "emerald",
  "sky",
  "violet",
  "fuchsia",
  "teal",
  "orange",
];

// Raw hex (Tailwind -500) for building CSS gradients across member colors.
export const MEMBER_COLOR_HEX: Record<MemberColor, string> = {
  rose: "#f43f5e",
  amber: "#f59e0b",
  emerald: "#10b981",
  sky: "#0ea5e9",
  violet: "#8b5cf6",
  fuchsia: "#d946ef",
  teal: "#14b8a6",
  orange: "#f97316",
};

/** A CSS `background` value for a set of member colors: a solid color for one,
 *  a diagonal gradient for several (used to color multi-participant events). */
export function memberGradient(colors: MemberColor[]): string {
  const hexes = colors.map((c) => MEMBER_COLOR_HEX[c] ?? MEMBER_COLOR_HEX.sky);
  if (hexes.length === 0) return MEMBER_COLOR_HEX.sky;
  if (hexes.length === 1) return hexes[0];
  return `linear-gradient(135deg, ${hexes.join(", ")})`;
}

// Tailwind needs these class names to appear as literals so the JIT compiler
// includes them in the build. Don't construct them with string interpolation.
export const COLOR_CLASSES: Record<
  MemberColor,
  { bg: string; bgSoft: string; text: string; textSoft: string; ring: string; border: string; dot: string }
> = {
  rose:     { bg: "bg-rose-500",     bgSoft: "bg-rose-100",     text: "text-rose-700",     textSoft: "text-rose-500",     ring: "ring-rose-300",     border: "border-rose-400",     dot: "bg-rose-500" },
  amber:    { bg: "bg-amber-500",    bgSoft: "bg-amber-100",    text: "text-amber-700",    textSoft: "text-amber-500",    ring: "ring-amber-300",    border: "border-amber-400",    dot: "bg-amber-500" },
  emerald:  { bg: "bg-emerald-500",  bgSoft: "bg-emerald-100",  text: "text-emerald-700",  textSoft: "text-emerald-500",  ring: "ring-emerald-300",  border: "border-emerald-400",  dot: "bg-emerald-500" },
  sky:      { bg: "bg-sky-500",      bgSoft: "bg-sky-100",      text: "text-sky-700",      textSoft: "text-sky-500",      ring: "ring-sky-300",      border: "border-sky-400",      dot: "bg-sky-500" },
  violet:   { bg: "bg-violet-500",   bgSoft: "bg-violet-100",   text: "text-violet-700",   textSoft: "text-violet-500",   ring: "ring-violet-300",   border: "border-violet-400",   dot: "bg-violet-500" },
  fuchsia:  { bg: "bg-fuchsia-500",  bgSoft: "bg-fuchsia-100",  text: "text-fuchsia-700",  textSoft: "text-fuchsia-500",  ring: "ring-fuchsia-300",  border: "border-fuchsia-400",  dot: "bg-fuchsia-500" },
  teal:     { bg: "bg-teal-500",     bgSoft: "bg-teal-100",     text: "text-teal-700",     textSoft: "text-teal-500",     ring: "ring-teal-300",     border: "border-teal-400",     dot: "bg-teal-500" },
  orange:   { bg: "bg-orange-500",   bgSoft: "bg-orange-100",   text: "text-orange-700",   textSoft: "text-orange-500",   ring: "ring-orange-300",   border: "border-orange-400",   dot: "bg-orange-500" },
};

export type MemberRole = "parent" | "child";

export type Member = {
  id: number;
  name: string;
  nickname: string | null;
  color: MemberColor;
  emoji: string | null;
  role: MemberRole;
  pin_hash: string | null;
  photo_updated_at: number | null;
  google_sub: string | null;
  google_calendar_id: string | null;
  sort_order: number;
  created_at: number;
};

/** Friendly label for a member: the nickname if they have one, else their name. */
export function displayName(m: { name: string; nickname?: string | null }): string {
  return m.nickname?.trim() || m.name;
}

/** The glyph to show for a member when there's no headshot photo: their chosen
 *  icon (emoji) if set, otherwise a neutral person icon — never a bare initial. */
export function memberGlyph(m: { emoji?: string | null }): string {
  return m.emoji?.trim() || "👤";
}

export type EventRow = {
  id: string;
  member_id: number | null; // primary participant (first); kept for Google sync + back-compat
  member_ids?: number[]; // all participants (populated by the events lib on read)
  calendar_id: string;
  title: string;
  start_ts: number;
  end_ts: number;
  all_day: number;
  location: string | null; // display label / place name
  address?: string | null; // resolved full address (for commute + display)
  notes: string | null;
  rrule: string | null;
  etag: string | null;
  source: string;
  commute_seconds?: number | null; // cached commute time from home to `location`
  commute_mode?: string | null; // "car" | "bus"
  updated_at: number;
};

export type Chore = {
  id: number;
  title: string;
  icon: string | null;
  points: number;
  recurrence: string; // 'daily' | 'weekdays' | 'weekends' | 'weekly:MON,WED'
  active: number;
  shared: number; // 1 = common chore, doable by anyone (no assignees)
  created_at: number;
};

export type ChoreCompletion = {
  id: number;
  chore_id: number;
  member_id: number;
  completed_for: string; // YYYY-MM-DD
  completed_at: number;
  verified_at: number | null;
  verified_by: number | null;
};

export type Reward = {
  id: number;
  title: string;
  icon: string | null;
  description: string | null;
  points_cost: number;
  active: number;
  created_at: number;
};

export type RewardRedemption = {
  id: number;
  reward_id: number;
  member_id: number;
  approved_by: number | null;
  points_spent: number;
  redeemed_at: number;
};
