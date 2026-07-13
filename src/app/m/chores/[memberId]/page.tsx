import { redirect } from "next/navigation";

export default async function MobileChoresRedirect({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  redirect(`/me/${memberId}`);
}
