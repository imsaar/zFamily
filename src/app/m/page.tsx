import { redirect } from "next/navigation";

// The separate mobile experience has been folded into the responsive main app.
// Kept as a redirect so existing PWA installs / bookmarks pointing at /m still
// land on the unified home.
export default function MobileHomeRedirect() {
  redirect("/");
}
