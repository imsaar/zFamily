import { redirect } from "next/navigation";

export default function MobileVoteRedirect() {
  redirect("/vote");
}
