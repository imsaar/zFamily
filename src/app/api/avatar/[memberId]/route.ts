import { getMemberPhoto } from "@/lib/members";

export const dynamic = "force-dynamic";

// Serves a member's headshot photo from SQLite. Cache-busting is handled by
// the `?v=<photo_updated_at>` query param on the <img> src, so responses can
// be cached aggressively.
export async function GET(_req: Request, ctx: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await ctx.params;
  const id = Number(memberId);
  if (!Number.isFinite(id)) return new Response("Not found", { status: 404 });

  const photo = getMemberPhoto(id);
  if (!photo) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
