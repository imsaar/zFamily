"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ─── On-screen keyboard for the wall-mounted touch kiosk ────────────
 * The kiosk has no physical keyboard. When enabled (Settings → Display),
 * focusing a text field surfaces a small ⌨️ button next to it; tapping it
 * opens a full QWERTY overlay that types into the real focused field.
 *
 * Keys use onPointerDown + preventDefault so the underlying <input> never
 * loses focus, and characters are written via the native value setter with
 * a dispatched "input" event so React's controlled onChange fires normally.
 *
 * Only mounted (by the kiosk layout) when the onscreen_keyboard setting is
 * "true"; nothing here runs on the mobile /m routes.
 */

type Editable = HTMLInputElement | HTMLTextAreaElement;

const TEXT_INPUT_TYPES = new Set(["text", "search", "email", "url", "tel", "password"]);

function isEditable(el: Element | null): el is Editable {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (el instanceof HTMLInputElement) {
    const t = (el.type || "text").toLowerCase();
    return TEXT_INPUT_TYPES.has(t) && !el.readOnly && !el.disabled;
  }
  return false;
}

const LETTERS: string[][] = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];

const SYMBOLS: string[][] = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["-", "/", ":", ";", "(", ")", "$", "&", "@", '"'],
  [".", ",", "?", "!", "'", "#", "%", "*", "+", "="],
];

export function OnScreenKeyboard() {
  const [target, setTarget] = useState<Editable | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(false);
  const [symbols, setSymbols] = useState(false);
  const targetRef = useRef<Editable | null>(null);
  targetRef.current = target;

  const updateRect = useCallback((el: Editable) => {
    setRect(el.getBoundingClientRect());
  }, []);

  // Track which text field is focused.
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as Element | null;
      if (isEditable(el)) {
        setTarget(el);
        updateRect(el);
      }
    };
    const onFocusOut = () => {
      // Defer so we can see where focus landed. Key presses preventDefault,
      // so this only fires when focus genuinely leaves the field.
      setTimeout(() => {
        const a = document.activeElement;
        if (isEditable(a)) {
          setTarget(a);
          updateRect(a);
        } else {
          setTarget(null);
          setOpen(false);
        }
      }, 0);
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, [updateRect]);

  // Keep the ⌨️ button glued to the field as sheets scroll / window resizes.
  useEffect(() => {
    if (!target) return;
    const update = () => updateRect(target);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [target, updateRect]);

  const write = useCallback((nextValue: string, caret: number) => {
    const el = targetRef.current;
    if (!el) return;
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    setter?.call(el, nextValue);
    try {
      el.setSelectionRange(caret, caret);
    } catch {
      /* some input types disallow selection ranges */
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, []);

  const insert = useCallback((ch: string) => {
    const el = targetRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + ch + el.value.slice(end);
    write(next, start + ch.length);
    setShift(false);
  }, [write]);

  const backspace = useCallback(() => {
    const el = targetRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    if (start === end) {
      if (start === 0) return;
      write(el.value.slice(0, start - 1) + el.value.slice(end), start - 1);
    } else {
      write(el.value.slice(0, start) + el.value.slice(end), start);
    }
  }, [write]);

  const openKeyboard = () => {
    setOpen(true);
    const el = targetRef.current;
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  // Prevent focus loss on any keyboard/tool interaction.
  const keepFocus = (e: React.PointerEvent) => e.preventDefault();

  if (!target) return null;

  const rows = symbols ? SYMBOLS : LETTERS;

  return (
    <>
      {/* Floating ⌨️ toggle next to the focused field (hidden while open). */}
      {!open && rect && (
        <button
          type="button"
          onPointerDown={(e) => { keepFocus(e); openKeyboard(); }}
          aria-label="Open on-screen keyboard"
          style={{
            top: Math.max(8, rect.top + rect.height / 2 - 22),
            left: Math.min(rect.right + 6, window.innerWidth - 52),
          }}
          className="fixed z-[70] w-11 h-11 rounded-full bg-zinc-900 text-white text-xl shadow-lg flex items-center justify-center active:scale-95"
        >
          ⌨️
        </button>
      )}

      {open && (
        <div
          onPointerDown={keepFocus}
          className="fixed inset-x-0 bottom-0 z-[70] bg-zinc-100 border-t border-zinc-300 shadow-[0_-8px_24px_rgba(0,0,0,0.15)] px-2 pt-2 pb-3 select-none"
        >
          <div className="max-w-4xl mx-auto space-y-1.5">
            {rows.map((row, ri) => (
              <div key={ri} className="flex justify-center gap-1.5">
                {ri === 2 && !symbols && (
                  <Key label={shift ? "⇧" : "⇧"} wide onPress={() => setShift((s) => !s)} active={shift} />
                )}
                {row.map((k) => {
                  const ch = !symbols && shift ? k.toUpperCase() : k;
                  return <Key key={k} label={ch} onPress={() => insert(ch)} />;
                })}
                {ri === 2 && (
                  <Key label="⌫" wide onPress={backspace} />
                )}
              </div>
            ))}
            <div className="flex justify-center gap-1.5">
              <Key label={symbols ? "ABC" : "123"} wide onPress={() => { setSymbols((s) => !s); setShift(false); }} />
              <Key label="space" flex onPress={() => insert(" ")} />
              {!symbols && <Key label="." onPress={() => insert(".")} />}
              <button
                type="button"
                onPointerDown={(e) => { keepFocus(e); setOpen(false); }}
                className="h-12 px-5 rounded-xl bg-zinc-900 text-white font-medium active:scale-95"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Key({
  label,
  onPress,
  wide,
  flex,
  active,
}: {
  label: string;
  onPress: () => void;
  wide?: boolean;
  flex?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onPointerDown={(e) => { e.preventDefault(); onPress(); }}
      className={`h-12 rounded-xl text-lg font-medium flex items-center justify-center active:scale-95 transition-transform ${
        flex ? "flex-1" : wide ? "px-4 min-w-14" : "w-9 sm:w-10 md:w-12"
      } ${active ? "bg-zinc-900 text-white" : "bg-white text-zinc-800 shadow-sm active:bg-zinc-200"}`}
    >
      {label}
    </button>
  );
}
