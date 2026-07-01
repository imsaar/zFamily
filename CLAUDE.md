# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Framework note (read first)

This repo uses **Next.js 16 with Turbopack + React 19 + Tailwind v4**. Its APIs, conventions, and file structure differ from older Next.js. When you're unsure, read the relevant guide under `node_modules/next/dist/docs/` before writing code. Heed deprecation notices. In particular: `params` and `searchParams` in App Router page components are **Promises** and must be awaited (`export default async function Page({ searchParams }: { searchParams: Promise<...> })`).

## Commands

```bash
npm run dev          # http://localhost:3000 — hot reload
npm run build        # Turbopack production build + full TS type-check
npm start            # Serve the production build (uses PORT env, default 3000)
```

There is no test runner and no linter configured. Type errors surface via `next build` (TypeScript runs as part of the build).

**Reset local data** (deletes seeded family, chores, meals, PINs, etc.):
```bash
rm -rf .data/
```

**Force a Google Calendar sync** from the CLI once the server is running:
```bash
curl -X POST http://localhost:3000/api/sync
```

**Point the app at a different data directory** (useful when iterating without touching a real family DB):
```bash
ZFAMILY_DATA_DIR=/tmp/zfamily-dev npm run dev
```

## Architecture

The app is a **single-tenant, self-contained Next.js server** designed to run on a Linux box connected to a wall-mounted 1920×1080 touch monitor, with a mobile PWA companion at `/m`. There is no separate API server, no auth server, no external DB. Everything lives in one SQLite file at `${ZFAMILY_DATA_DIR}/zfamily.db` (default `.data/zfamily.db`).

### Route groups

The App Router uses two mutually exclusive route groups so the kiosk and the phone don't share chrome:

- **`src/app/(kiosk)/`** — the wall display. Its layout renders the shared `Header` (clock, avatars, weather), `BottomNav`, `Screensaver`, and `PinSetupGate`. Fixed 1920×1080 viewport.
- **`src/app/m/`** — the mobile PWA. Its layout is a simple full-height scroll container; the PWA `manifest.webmanifest` scopes to `/m`.
- **`src/app/layout.tsx`** — root: just `<html>`/`<body>`/globals CSS. Do not put chrome here.

Adding a new kiosk route: create it under `(kiosk)/`. Adding a mobile route: put it under `m/`. Do **not** cross the boundary.

### Data layer (`src/lib/`)

`src/lib/db.ts` is the single owner of the SQLite connection:

- Lazy-opens on first `db()` call; caches the connection module-globally.
- Runs migrations automatically: applies the full `SCHEMA` string (idempotent `CREATE IF NOT EXISTS`), then `ensureColumn()` calls for later-added columns, then post-`ALTER` indexes, then `seedIfEmpty()`.
- **When adding a new column to an existing table, add an `ensureColumn()` call**. Do not rely on the `SCHEMA` string alone — existing installs already have that table.
- Legacy data migration: an older `smartcal.db` in the same dir is renamed to `zfamily.db` on boot (part of the rename from SmartCal → zFamily).

Domain modules are split by table family and are **server-only** (they import `db()`): `members.ts`, `events.ts`, `chores.ts`, `meals.ts`, `rewards.ts`, `settings.ts`, `pins.ts`. Client components must not import these directly; they interact with data through server actions in `src/app/actions.ts`.

Everything mutating flows through **`src/app/actions.ts`** (`"use server"`). At the top there's a `bust()` helper that `revalidatePath`s every page after any write. New actions should call `bust()` at the end.

### Authentication (PINs)

There is no user login. Every family member can have a 4-digit numeric PIN. Auth is action-level, not session-level.

- **Storage**: `pin_hash` + `pin_salt` on `members`. `src/lib/pins.ts` uses `crypto.scryptSync` with a per-member salt and `timingSafeEqual` for verify.
- **Server side**: `requirePin(memberId, pin?)` returns `{ok:true}` if the member has no PIN, else validates. `requireParentAuth({by, pin})` on top gates admin actions: verifies the actor is a parent AND their PIN is correct.
- **Client side**: `PinProviders` wraps both layouts, exposing:
  - `useRequestPin()` — prompts the acting member's PIN, retries on invalid, returns `boolean`. Use this for personal actions (verify/vote/redeem).
  - `useAdminAuth()` — picks a parent (auto if only one), prompts their PIN, returns `{authenticate, modal}`. Use this for admin CRUD.
- Successful PINs are cached in-memory for 60s per member (`PinAuthProvider`) so rapid follow-up actions don't re-prompt.
- **First-launch gate**: `PinSetupGate` in the kiosk layout blocks the app until every parent has a PIN.

When adding a new mutating action:
1. Decide: personal (acting member's PIN) or admin (any parent's PIN).
2. Server action: accept `pin?: string | null` for personal, `admin?: AdminAuth` for admin. Gate with `requirePin` or `requireParentAuth`. Return `{ok, reason?}`.
3. Client call site: wrap with `useRequestPin(member, purpose, executor)` or `authenticate((auth) => action(...args, auth))`.

### Calendar sync

`src/lib/google.ts` wraps `googleapis`. OAuth is initiated from Settings → Google, redirect target is `/api/auth/google/callback`, tokens store in `members`. Sync is **incremental** via Google's `syncToken`; a 410 response invalidates and triggers a full re-pull next time. There is no built-in scheduler — `POST /api/sync` is meant to be hit by cron.

`src/lib/events.ts` has `expandRecurrences()` for **local** RRULE events (weekly / monthly / quarterly). Calendar pages must fetch both events overlapping the range AND recurring templates whose start is before the range, then run them through `expandRecurrences()`.

### PIN + admin flow gotcha

When adding a new client surface that mutates data, remember that the acting user is unknown on a shared kiosk. Either:
- The UI already contains a specific member (per-column verify pill on ChoreBoard) → prompt that member's PIN with `useRequestPin`.
- The action is admin CRUD → use `useAdminAuth`, which internally handles the "which parent" question.
Never take a mutation from a shared surface without one of these gates.

### Islamic content

- `src/lib/verses.ts` — curated 50-verse library with Arabic + Saheeh International English + reference. `verseOfDay(date)` is **deterministic per date** (day-of-year modulo list length) so the whole household sees the same verse.
- `src/lib/hijri.ts` — uses `Intl.DateTimeFormat("en-u-ca-islamic-umalqura")`. The `hijri_offset` setting (±3 days) applies a moon-sighting adjustment before conversion.

### Touch UX conventions

- Minimum tap target ~44px on the kiosk display, 40px+ on mobile. Verify pills use `h-11 min-w-16`.
- No hover-only affordances. Sheet backdrops are tap-to-dismiss.
- `body` has `overflow-hidden` and `h-screen`; every top-level page should be `h-full flex flex-col` and split its own scroll regions. **Do not** let the page itself grow beyond the viewport — the bottom nav will be pushed off.
- Grid layouts that need to fill remaining flex height use `flex-1 min-h-0 grid ... overflow-hidden` with `gridAutoRows: "1fr"` for equal rows.

## Deep-dive references

- `README.md` — install (systemd + Chromium kiosk), Google OAuth setup, per-tab settings reference, backup, all routes, troubleshooting.
- `SPEC.md` — the design doc. §7 (data model) and §10 (roadmap, including v4 voice input/audio output) are the most useful ongoing references.
