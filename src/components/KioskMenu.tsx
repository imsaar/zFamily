"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "./ConfirmProvider";

/**
 * Kiosk-only: suppresses the browser's native context menu (right-click /
 * long-press) and replaces it with an app menu — refresh, connection check,
 * sync, fullscreen, settings. Mounted in the kiosk layout only, so the mobile
 * PWA keeps normal browser behavior.
 */
export function KioskMenu() {
  const router = useRouter();
  const { alert } = useConfirm();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    // Long-press on touch also fires `contextmenu` in Chromium, so this one
    // handler covers both right-click and long-touch.
    const onCtx = (e: MouseEvent) => {
      e.preventDefault();
      setMenu({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("contextmenu", onCtx);
    return () => window.removeEventListener("contextmenu", onCtx);
  }, []);

  const close = () => setMenu(null);

  const reachable = (url: string, opts: RequestInit) =>
    new Promise<boolean>((resolve) => {
      const ctrl = new AbortController();
      const t = setTimeout(() => { ctrl.abort(); resolve(false); }, 3500);
      fetch(url, { ...opts, signal: ctrl.signal })
        .then(() => { clearTimeout(t); resolve(true); })
        .catch(() => { clearTimeout(t); resolve(false); });
    });

  const checkConnection = async () => {
    close();
    const online = typeof navigator !== "undefined" ? navigator.onLine : true;
    const [server, internet] = await Promise.all([
      reachable("/api/ical/sync", { method: "HEAD", cache: "no-store" }),
      reachable("https://www.gstatic.com/generate_204", { mode: "no-cors", cache: "no-store" }),
    ]);
    await alert({
      title: "📶 Connection status",
      message:
        `Browser network:  ${online ? "🟢 online" : "🔴 offline"}\n` +
        `App server:       ${server ? "🟢 reachable" : "🔴 unreachable"}\n` +
        `Internet:         ${internet ? "🟢 reachable" : "🔴 unreachable"}`,
    });
  };

  const items: Array<{ icon: string; label: string; onClick: () => void }> = [
    { icon: "🔄", label: "Refresh screen", onClick: () => { close(); window.location.reload(); } },
    { icon: "📶", label: "Check connection", onClick: checkConnection },
    { icon: "🔃", label: "Sync calendars", onClick: () => { close(); void fetch("/api/sync", { method: "POST" }).then(() => router.refresh()).catch(() => {}); } },
    { icon: "⛶", label: "Toggle fullscreen", onClick: () => { close(); toggleFullscreen(); } },
    { icon: "⚙️", label: "Open settings", onClick: () => { close(); router.push("/settings"); } },
  ];

  if (!menu) return null;

  const vw = typeof window !== "undefined" ? window.innerWidth : 1920;
  const vh = typeof window !== "undefined" ? window.innerHeight : 1080;
  const left = Math.min(menu.x, vw - 240);
  const top = Math.min(menu.y, vh - items.length * 52 - 24);

  return (
    <div
      className="fixed inset-0 z-[75]"
      onClick={close}
      onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }); }}
    >
      <div
        className="absolute bg-white rounded-2xl shadow-2xl border border-zinc-200 py-2 w-56 fade-in"
        style={{ left, top }}
        onClick={(e) => e.stopPropagation()}
      >
        {items.map((it) => (
          <button
            key={it.label}
            onClick={it.onClick}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-base active:bg-zinc-100"
          >
            <span className="text-xl w-6 text-center">{it.icon}</span>
            <span>{it.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function toggleFullscreen() {
  try {
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void document.documentElement.requestFullscreen?.();
  } catch {
    /* fullscreen may be blocked; ignore */
  }
}
