import type { Member, MemberColor } from "@/lib/types";
import { COLOR_CLASSES } from "@/lib/types";

type AvatarMember = Pick<Member, "id" | "name" | "emoji" | "color" | "photo_updated_at">;

/** Round member avatar: shows the uploaded headshot if there is one, otherwise
 *  the member's emoji, otherwise the first letter of their name.
 *
 *  `className` controls size + shape (e.g. "w-14 h-14 rounded-full") and is
 *  applied to both the <img> and the emoji fallback. `textClass` sizes the
 *  emoji/initial (e.g. "text-2xl"). */
export function MemberAvatar({
  member,
  className = "",
  textClass = "",
}: {
  member: AvatarMember;
  className?: string;
  textClass?: string;
}) {
  const color = COLOR_CLASSES[member.color as MemberColor] ?? COLOR_CLASSES.sky;

  if (member.photo_updated_at) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/avatar/${member.id}?v=${member.photo_updated_at}`}
        alt={member.name}
        className={`object-cover bg-zinc-100 ${className}`}
      />
    );
  }

  return (
    <div className={`${color.bg} flex items-center justify-center text-white ${textClass} ${className}`}>
      {member.emoji ?? (member.name[0] ?? "?")}
    </div>
  );
}
