"use client";

import { useCallback, useEffect, useState, useRef, createContext, useContext } from "react";
import type { Member, MemberColor } from "@/lib/types";
import { COLOR_CLASSES, displayName, memberGlyph } from "@/lib/types";

const KEYS: Array<string> = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

export function PinPadModal({
  member,
  purpose,
  onSubmit,
  onCancel,
  error,
}: {
  member: Member;
  purpose: string;
  onSubmit: (pin: string) => void;
  onCancel: () => void;
  error?: string | null;
}) {
  const [pin, setPin] = useState("");
  const color = COLOR_CLASSES[member.color as MemberColor] ?? COLOR_CLASSES.sky;
  const submittedRef = useRef(false);

  const handleKey = useCallback((k: string) => {
    if (k === "⌫") {
      setPin((p) => p.slice(0, -1));
      submittedRef.current = false;
      return;
    }
    if (!/^\d$/.test(k)) return;
    setPin((p) => (p.length >= 4 ? p : p + k));
  }, []);

  useEffect(() => {
    if (pin.length === 4 && !submittedRef.current) {
      submittedRef.current = true;
      onSubmit(pin);
    }
  }, [pin, onSubmit]);

  useEffect(() => {
    if (error) {
      submittedRef.current = false;
      setPin("");
    }
  }, [error]);

  // Support physical keyboard for accessibility.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onCancel();
      if (e.key === "Backspace") return handleKey("⌫");
      if (/^\d$/.test(e.key)) return handleKey(e.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleKey, onCancel]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 fade-in" onClick={onCancel} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-6 overflow-hidden fade-in">
        <div className={`${color.bg} text-white px-6 py-5 flex items-center gap-4`}>
          {member.photo_updated_at ? (
            <img
              src={`/api/avatar/${member.id}?v=${member.photo_updated_at}`}
              alt={member.name}
              className="w-14 h-14 rounded-full object-cover bg-white/20 shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-2xl shrink-0">
              {memberGlyph(member)}
            </div>
          )}
          <div className="flex-1">
            <div className="text-xl font-semibold">{displayName(member)}&apos;s PIN</div>
            <div className="text-sm opacity-90">{purpose}</div>
          </div>
          <button
            onClick={onCancel}
            aria-label="Cancel"
            className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-center gap-4 mb-2">
            {[0, 1, 2, 3].map((i) => {
              const filled = pin.length > i;
              return (
                <div
                  key={i}
                  className={`w-5 h-5 rounded-full transition-all ${
                    filled
                      ? error
                        ? "bg-red-500 scale-110"
                        : `${color.bg} scale-110`
                      : "bg-zinc-200"
                  }`}
                />
              );
            })}
          </div>
          <div className="h-6 text-center text-sm text-red-500">
            {error === "pin_invalid" ? "Incorrect PIN. Try again." : error ? "Something went wrong." : " "}
          </div>

          <div className="grid grid-cols-3 gap-3 mt-2">
            {KEYS.map((k, i) => {
              if (k === "") return <div key={i} />;
              return (
                <button
                  key={i}
                  onClick={() => handleKey(k)}
                  className={`h-16 rounded-2xl text-2xl font-semibold tabular-nums active:scale-95 transition-transform ${
                    k === "⌫"
                      ? "bg-zinc-100 text-zinc-600 active:bg-zinc-200"
                      : "bg-zinc-900 text-white active:bg-zinc-800"
                  }`}
                >
                  {k}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Client-side auth cache ─────────────────────────────────────────
 * When a member successfully enters their PIN, cache the PIN in memory
 * for a short window so rapid follow-up actions don't re-prompt.
 */

const AUTH_TTL_MS = 60 * 1000; // 60 seconds

type CacheEntry = { pin: string; expiresAt: number };

const AuthContext = createContext<{
  getPin: (memberId: number) => string | null;
  savePin: (memberId: number, pin: string) => void;
  clear: (memberId: number) => void;
} | null>(null);

export function PinAuthProvider({ children }: { children: React.ReactNode }) {
  const cacheRef = useRef<Map<number, CacheEntry>>(new Map());

  const getPin = useCallback((memberId: number): string | null => {
    const e = cacheRef.current.get(memberId);
    if (!e) return null;
    if (Date.now() > e.expiresAt) {
      cacheRef.current.delete(memberId);
      return null;
    }
    return e.pin;
  }, []);

  const savePin = useCallback((memberId: number, pin: string) => {
    cacheRef.current.set(memberId, { pin, expiresAt: Date.now() + AUTH_TTL_MS });
  }, []);

  const clear = useCallback((memberId: number) => {
    cacheRef.current.delete(memberId);
  }, []);

  return (
    <AuthContext.Provider value={{ getPin, savePin, clear }}>{children}</AuthContext.Provider>
  );
}

export function usePinAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("usePinAuth must be used within PinAuthProvider");
  return ctx;
}

/** High-level hook: request PIN for a member, cached, with prompt fallback.
 *  Usage:
 *    const requestPin = useRequestPin();
 *    const pin = await requestPin(member, "Verify chore");
 *    if (!pin) return;
 *    await actionWithPin(...args, pin);
 */

type PinRequest = {
  member: Member;
  purpose: string;
  resolve: (pin: string | null) => void;
};

const PinPromptContext = createContext<{
  request: (member: Member, purpose: string) => Promise<string | null>;
  setError: (err: string | null) => void;
} | null>(null);

export function PinPromptProvider({ children, hasPinByMember }: {
  children: React.ReactNode;
  hasPinByMember: Record<number, boolean>;
}) {
  const [active, setActive] = useState<PinRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { getPin, savePin } = usePinAuth();

  const request = useCallback(
    (member: Member, purpose: string): Promise<string | null> => {
      if (!hasPinByMember[member.id]) return Promise.resolve("");
      const cached = getPin(member.id);
      if (cached) return Promise.resolve(cached);
      return new Promise((resolve) => {
        setError(null);
        setActive({ member, purpose, resolve });
      });
    },
    [getPin, hasPinByMember]
  );

  const onSubmit = (pin: string) => {
    if (!active) return;
    savePin(active.member.id, pin);
    const resolver = active.resolve;
    setActive(null);
    resolver(pin);
  };

  const onCancel = () => {
    if (!active) return;
    const resolver = active.resolve;
    setActive(null);
    setError(null);
    resolver(null);
  };

  return (
    <PinPromptContext.Provider value={{ request, setError }}>
      {children}
      {active && (
        <PinPadModal
          member={active.member}
          purpose={active.purpose}
          onSubmit={onSubmit}
          onCancel={onCancel}
          error={error}
        />
      )}
    </PinPromptContext.Provider>
  );
}

export function usePinPrompt() {
  const ctx = useContext(PinPromptContext);
  if (!ctx) throw new Error("usePinPrompt must be used within PinPromptProvider");
  return ctx;
}

/** Composite hook: verify a member's PIN, prompt if needed, retry on failure.
 *  Returns null if the user cancelled. */
export function useRequestPin() {
  const { request, setError } = usePinPrompt();
  const { clear } = usePinAuth();
  return useCallback(
    async (member: Member, purpose: string, executor: (pin: string) => Promise<{ ok: boolean; reason?: string }>): Promise<boolean> => {
      // Loop until success or cancel.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const pin = await request(member, purpose);
        if (pin === null) return false; // cancelled
        const result = await executor(pin);
        if (result.ok) {
          setError(null);
          return true;
        }
        // Invalid PIN — clear cache and re-prompt.
        clear(member.id);
        setError(result.reason ?? "pin_invalid");
      }
    },
    [request, clear, setError]
  );
}
