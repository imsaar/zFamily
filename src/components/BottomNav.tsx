"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/week", label: "Week", icon: "📅" },
  { href: "/month", label: "Month", icon: "🗓️" },
  { href: "/chores", label: "Chores", icon: "✅" },
  { href: "/meals", label: "Meals", icon: "🍽️" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="h-16 lg:h-20 pb-[env(safe-area-inset-bottom)] border-t border-zinc-200 bg-white flex items-stretch justify-around shrink-0">
      {TABS.map((tab) => {
        const active = tab.href === "/"
          ? path === "/" || path.startsWith("/me")
          : path.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 lg:gap-1 text-xs lg:text-base transition-colors ${
              active ? "text-zinc-900 font-semibold" : "text-zinc-400"
            }`}
          >
            <div className="text-xl lg:text-2xl leading-none">{tab.icon}</div>
            <div>{tab.label}</div>
            {active && <div className="absolute bottom-0 h-1 w-12 bg-zinc-900 rounded-t-full" />}
          </Link>
        );
      })}
    </nav>
  );
}
