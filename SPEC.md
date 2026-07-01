# zFamily — Family Calendar & Chore Display

A wall-mounted family hub for a 15" Innoview touch HDMI monitor running on Linux. Inspired by Skylight Calendar, Cozyla, DAKboard, and Hearth — combining the touch-first family calendar of Skylight with the customizable widgets of DAKboard, the screensaver/ambient mode of Cozyla, and the chore-chart polish of Hearth.

## 1. Goals & Non-Goals

### Goals
- **Always-on family display.** Boot into kiosk mode, never require login at the device.
- **Touch-first.** Every interactive element ≥ 48px tap target. No hover-dependent UI.
- **Shared family awareness.** Color-coded events per family member, who-is-where at a glance.
- **Chore accountability.** Visual chore board with check-off, recurring schedules, streaks.
- **Low ongoing maintenance.** Sync with Google Calendar so events created on phones flow in automatically.
- **Quiet at night.** Dim/sleep on a schedule; photo screensaver between active hours.

### Non-Goals (v1)
- Multi-tenant SaaS — this is a single-household app running on one device.
- Mobile companion app — v1 uses Google Calendar as the "mobile interface."
- Voice control, meal planning, shopping lists, news widgets — slot into v2.

## 2. Target Hardware

| Spec                 | Value                                          |
|----------------------|------------------------------------------------|
| Display              | Innoview 15.6" touch, 1920×1080, HDMI          |
| Orientation          | Landscape                                      |
| Host                 | Linux box (Raspberry Pi 4/5, NUC, or similar)  |
| Browser              | Chromium kiosk mode                            |
| Input                | Capacitive multi-touch                         |
| Network              | Wi-Fi or Ethernet                              |

Design assumes a single fixed resolution (1920×1080) — no responsive breakpoints needed for v1. Touch targets sized for finger input, not stylus.

## 3. Competitive Inspiration

| Source     | What we're taking                                              |
|------------|----------------------------------------------------------------|
| Skylight   | Color-coded family members, weekly view default, chore sidebar |
| Cozyla     | Photo screensaver mode, ambient calm aesthetic                 |
| DAKboard   | Customizable widget zones, weather + clock                     |
| Hearth     | Chore reward streaks, "today's focus" surface, polished UI     |

## 4. Information Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│ HEADER: Day/Date · Clock · Weather · Family avatars (active) │
├──────────────────────┬───────────────────────────────────────────┤
│                      │                                           │
│   CALENDAR           │   TODAY SIDEBAR                           │
│   (week view)        │   • Today's events                        │
│                      │   • Today's chores per member             │
│   Mon Tue Wed Thu... │   • Streaks / kudos                       │
│                      │                                           │
│                      │                                           │
├──────────────────────┴───────────────────────────────────────────┤
│ BOTTOM TABS: Week · Month · Chores · Settings                    │
└──────────────────────────────────────────────────────────────────┘
```

### Views

1. **Week (default).** 7 columns, all-day strip + hourly grid. Events colored by member. Tap event → detail sheet. Tap empty slot → quick-add.
2. **Month.** Full month grid, dots/bars per event. Tap day → day detail.
3. **Chores.** Per-member columns, today's chores with big check-off circles, streak indicator, weekly chart.
4. **Settings.** Family members, Google account linking, screensaver schedule, weather location, theme.
5. **Screensaver.** Activates on schedule (e.g. 9pm–7am) or after N minutes idle. Shows time, weather, next event, optional photo slideshow. Tap anywhere → wake.

## 5. Core Features (v1 — MVP)

### 5.1 Calendar
- **Sources:** Google Calendar via OAuth. One calendar per family member (or a shared calendar with attendee = member). Two-way sync.
- **Local cache:** All events cached in SQLite for instant render and offline display.
- **Sync cadence:** Push on user action; pull via Google Calendar push notifications (webhook) with a 15-min fallback poll.
- **Quick-add:** Tap empty slot → 3-field sheet: title, member(s), time. Defaults to 1 hour.
- **Event detail:** Title, time, member chips, location, notes. Edit and delete supported.
- **Recurring events:** Read-only in v1 — display Google's RRULE, but edits affect single instance only.

### 5.2 Chores
- **Model:** A chore has a title, assigned member(s), recurrence (daily/specific weekdays/weekly), reward points, optional icon.
- **Today view:** Per-member column shows today's chores. Tap circle → checked, animates with a satisfying tick. Long-press → undo.
- **Streaks:** Consecutive days a member completes all assigned chores. Displayed as a flame icon with day count.
- **Weekly chart:** Bar per member showing % completion this week.
- **Reset:** Daily chores reset at 4am local time (configurable). Weekly at Monday 4am.

### 5.3 Family Members
- Name, color (from a curated 8-color palette), avatar emoji or initial, optional Google account.
- 1–6 members supported. UI density adapts.

### 5.4 Weather
- Single configurable location (zip / lat-lon).
- Current temp + condition icon in header.
- Today's high/low and a 5-day forecast in a header expansion or sidebar widget.
- Provider: Open-Meteo (no API key required) for v1.

### 5.5 Screensaver / Quiet Mode
- Schedule: start/end time (default 21:00–07:00).
- Idle timeout: configurable (default 5 min).
- Modes: clock-only, clock + next event, photo slideshow (folder on local disk).
- Tap anywhere to wake.

### 5.6 Settings
- Web-based settings page accessible from the bottom tab. All config stored in SQLite.
- Initial onboarding wizard: add members → link Google → set weather location → set quiet hours.

## 6. Tech Stack

| Layer            | Choice                                       | Why                                    |
|------------------|----------------------------------------------|----------------------------------------|
| Framework        | Next.js 14 (App Router) + TypeScript         | Single deploy, server actions, RSC      |
| Styling          | Tailwind CSS                                 | Fast iteration, easy touch sizing       |
| Database         | SQLite via `better-sqlite3`                  | Zero-config, lives on device            |
| Auth             | NextAuth (Google provider)                   | For OAuth into Google Calendar          |
| Calendar API     | `googleapis` (Node SDK)                      | Official, covers push notifications     |
| Date math        | `date-fns` + `date-fns-tz`                   | Tree-shakable, timezone-aware           |
| Weather          | Open-Meteo HTTP                              | Free, no key, accurate                  |
| Process manager  | systemd unit (kiosk Chromium + node server)  | Standard on Linux                       |
| Display          | Chromium `--kiosk --app=http://localhost:3000` | Fullscreen, no chrome                  |

### Why Next.js + SQLite
- Single `pnpm start` boots the whole app — no separate API process.
- Server actions let touch interactions update SQLite directly without bespoke endpoints.
- SQLite means the device is self-contained; no DB server to babysit. Backup = copy one file.

## 7. Data Model (SQLite)

```sql
-- Family members
CREATE TABLE members (
  id           INTEGER PRIMARY KEY,
  name         TEXT NOT NULL,
  color        TEXT NOT NULL,         -- hex, from curated palette
  emoji        TEXT,                  -- avatar (single emoji) or NULL → initial
  google_sub   TEXT UNIQUE,           -- Google account subject claim, NULL if not linked
  google_calendar_id TEXT,            -- which calendar to sync
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL
);

-- Cached events (mirror of Google Calendar)
CREATE TABLE events (
  id             TEXT PRIMARY KEY,    -- Google event id
  member_id      INTEGER REFERENCES members(id) ON DELETE CASCADE,
  calendar_id    TEXT NOT NULL,
  title          TEXT NOT NULL,
  start_ts       INTEGER NOT NULL,    -- unix seconds, UTC
  end_ts         INTEGER NOT NULL,
  all_day        INTEGER NOT NULL DEFAULT 0,
  location       TEXT,
  notes          TEXT,
  rrule          TEXT,                -- raw RRULE for recurring
  etag           TEXT,                -- for incremental sync
  updated_at     INTEGER NOT NULL
);
CREATE INDEX events_range ON events(start_ts, end_ts);
CREATE INDEX events_member ON events(member_id);

-- Chores definitions
CREATE TABLE chores (
  id           INTEGER PRIMARY KEY,
  title        TEXT NOT NULL,
  icon         TEXT,                  -- emoji
  points       INTEGER NOT NULL DEFAULT 1,
  recurrence   TEXT NOT NULL,         -- 'daily' | 'weekdays' | 'weekends' | 'weekly:MON,WED'
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   INTEGER NOT NULL
);

-- Many-to-many: which members are assigned to a chore
CREATE TABLE chore_assignees (
  chore_id     INTEGER NOT NULL REFERENCES chores(id) ON DELETE CASCADE,
  member_id    INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  PRIMARY KEY (chore_id, member_id)
);

-- Completion log
CREATE TABLE chore_completions (
  id             INTEGER PRIMARY KEY,
  chore_id       INTEGER NOT NULL REFERENCES chores(id) ON DELETE CASCADE,
  member_id      INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  completed_for  TEXT NOT NULL,       -- YYYY-MM-DD (the "chore day" it satisfies)
  completed_at   INTEGER NOT NULL,    -- actual timestamp of tap
  UNIQUE(chore_id, member_id, completed_for)
);
CREATE INDEX comp_lookup ON chore_completions(member_id, completed_for);

-- Key/value settings
CREATE TABLE settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
-- Settings keys: weather_lat, weather_lon, weather_label,
--   quiet_start ('21:00'), quiet_end ('07:00'),
--   chore_reset_hour ('4'),
--   screensaver_mode ('clock' | 'photos'), photos_path
```

## 8. Sync Architecture

```
┌──────────────────────┐
│  Google Calendar     │
└──────────┬───────────┘
           │ push notification (webhook) every change
           ▼
┌──────────────────────┐    incremental sync (syncToken)
│  Next.js /api/sync   │ ─────────────────────────────────┐
└──────────┬───────────┘                                  │
           │ writes                                        │
           ▼                                               │
┌──────────────────────┐    server actions read           │
│  SQLite (events)     │ ◄────────────────────────────────┘
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  React UI            │ ── revalidatePath('/') on sync
└──────────────────────┘
```

- On startup: full sync per member, store `syncToken`.
- Subscribe to push notifications per calendar (Google Calendar `watch` API).
- Webhook hits `/api/calendar/webhook` → incremental sync using stored `syncToken`.
- Local edits → write to Google first, then update SQLite on success.
- Fallback polling every 15 min in case webhook is missed.

## 9. Visual Design

- **Theme:** Light by default, dark variant for quiet hours. Auto-switch with quiet schedule.
- **Typography:** Inter, large weights. Min body 18px, headers 24–48px.
- **Palette (member colors):** rose / amber / emerald / sky / violet / fuchsia / teal / orange. Sized for accessibility on white & dark backgrounds.
- **Density:** Generous — display is meant to be read across a room.
- **Motion:** Subtle. Chore tick-off has a 200ms scale+check animation; otherwise minimal.

## 10. Roadmap

### v1 (shipped)
- [x] Calendar week view with Google sync
- [x] Chore board with check-off + streaks
- [x] Family members & color coding
- [x] Weather header widget
- [x] Settings page

### v2 (shipped in this branch)
- [x] **Meal planner** — weekly grid (breakfast/lunch/dinner), meal library with ingredients, one-tap add-to-shopping. New tables: `meals`, `meal_plan_entries`.
- [x] **Shopping list** — shared with mobile PWA, auto-populated from planned meals. New table: `shopping_items`.
- [x] **Screensaver + quiet hours** — client-side idle detector, quiet-hour window (default 21:00–07:00), two modes (clock only / clock + next event + weather). Tap-to-wake.
- [x] **Mobile companion PWA** at `/m` — chore progress dashboard, per-member chore check-off, quick-add event, shopping list. Installable via `manifest.webmanifest`. Route group split (`(kiosk)` + `m/`) so mobile doesn't inherit kiosk chrome.

### v3 (shipped)
- [x] **Chore verification workflow** — completions enter a `pending` state; parents verify children's chores; parents peer-verify each other's chores. Only verified completions count toward streaks and points. New columns `verified_at`, `verified_by` on `chore_completions`; `role` column on `members`.
- [x] **Gamification & rewards** — every verified chore contributes `chore.points` to the doer's lifetime balance. Parent-approved rewards shelf with redemption audit log. New tables `rewards`, `reward_redemptions`.
- [x] **Meal favorites and family voting** — `is_favorite` on meals; new tables `meal_proposals`, `meal_votes`. Weekly candidate list with per-member vote pills, medal ranking, and one-tap "apply top winners to next week's dinner slots" (tie-broken by earliest proposal time).
- [x] **Family home dashboard at `/`** — Quranic verse of the day (curated 50-verse library, deterministic pick by day-of-year, Arabic + Saheeh International English + reference), Hijri (Umm al-Qura) date with moon-sighting offset, weekly overview strip with member-colored event dots, per-member chore progress tiles, quick tiles for pending verifications and meal state.
- [x] **Hijri date** via Intl `en-u-ca-islamic-umalqura`; configurable `hijri_offset` setting (–3 … +3 days) for local moon-sighting authority.
- [x] **Personal member views at `/me/[memberId]`** — that member's chores (with verify pills), 7-day schedule, meal vote panel, and (for children) rewards progress. Configurable `personal_idle_seconds` (default 120) auto-navigates back to family home.
- [x] **PIN authentication** — 4-digit numeric PIN per member; on-screen 3×4 numeric pad (buttons ≥ 64px). PINs stored as scrypt hashes with per-member salts; timing-safe verify. In-memory 60s cache to avoid repeated prompts. New columns `pin_hash`, `pin_salt` on `members`.
- [x] **Personal-action gate** — verify/vote/redeem require the acting member's PIN (if set).
- [x] **Admin-action gate** — settings/rewards/chores/family/meal-library CRUD require an authenticated parent (parent picker if 2+ parents, PIN prompt with retry on invalid).
- [x] **First-launch enforcement** — full-screen `PinSetupGate` blocks the app until every parent has a PIN.
- [x] **Local recurring events** — QuickAdd (kiosk) and MobileEventForm (mobile) offer none / weekly / monthly / quarterly; stored as RRULE (`FREQ=WEEKLY`, `FREQ=MONTHLY`, `FREQ=MONTHLY;INTERVAL=3`) and expanded client-side across week + month views.

### v4 (future)
- 🎤 **Voice input** — local Whisper for quick-add (events, chores, shopping items) and hands-free vote/verify shortcuts. PIN-less voice flows require an alternate biometric or a strict-mode toggle.
- 🔊 **Audio output** — spoken verse of the day, adhan alerts for prayer times, gentle chore reminders, quiet-hour bell.
- **Prayer times** with local calculation method + weather-aware reminders (e.g. "sunset in 15 min → maghrib prep").
- **Islamic events overlay** on the month view (Ramadan, Eid, first of the month, ashura).
- **Two-way sync of local recurring events** back to Google Calendar (currently local-only).
- **Photo slideshow screensaver** (Cozyla-style) with local folder watcher.
- **Google push notifications** for near-instant Calendar sync.
- **Multi-device kiosk fanout** via Tailscale — a bedroom display that mirrors the main hub.
- **Birthday / anniversary smart suggestions** from Google Contacts.
- **Customizable widget grid** (DAKboard-style).

## 11. Open Questions

- **Single user model for v1:** the device shows everyone's data; the "user" linking Google is whoever ran the onboarding. For multi-Google-account households, each member can link their own account during settings — same OAuth flow, different `google_sub`.
- **Privacy:** events fetched read-write — do we want a per-member "private" toggle that hides event title on the shared display? Defer.
- **Offline edits:** if a chore is checked off while internet is down, the tick is local-only (chore completions don't sync to Google). Calendar edits while offline queue and retry — flag for future.
- **PIN reset:** if a parent forgets their PIN, currently the only recovery is direct SQLite access (or another parent removes the PIN via the admin gate). Consider a printable "recovery code" for v4.
