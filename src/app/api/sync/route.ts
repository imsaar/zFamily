import { NextResponse } from "next/server";
import { syncAllMembers } from "@/lib/google";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await syncAllMembers();
    revalidatePath("/");
    revalidatePath("/month");
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
