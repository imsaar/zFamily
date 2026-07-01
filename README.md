# zFamily

A wall-mounted family hub — calendar, chores, meals, shopping — designed to run on a 15.6" touch HDMI display attached to a Linux box, plus a mobile companion PWA that lives on family members' phones.

Inspired by Skylight Calendar, Cozyla, DAKboard, and Hearth.

![Week view](.preview-week.png)

## Table of contents

- [What's in the box](#whats-in-the-box)
- [Screens](#screens)
- [Requirements](#requirements)
- [Quick start (dev)](#quick-start-dev)
- [Production install (Linux kiosk)](#production-install-linux-kiosk)
- [Google Calendar setup](#google-calendar-setup)
- [Configuration reference](#configuration-reference)
- [Data & backup](#data--backup)
- [Mobile companion (PWA)](#mobile-companion-pwa)
- [Screensaver & quiet hours](#screensaver--quiet-hours)
- [Routes](#routes)
- [Project layout](#project-layout)
- [Development tips](#development-tips)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)

## What's in the box

- **Family home dashboard** with Quranic verse of the day (Arabic + English translation, deterministic per date), Hijri (Umm al-Qura) date with moon-sighting correction, weekly overview, and quick tiles.
- **Weekly + monthly calendar** with per-member color coding, all-day strip, hourly grid, red "now" line.
- **Recurring events** — locally-created events support weekly, monthly, or quarterly recurrence (client-expanded from RRULE).
- **Chore board** with pending → verified two-step (parents verify children; parents peer-verify each other), big touch check-off circles, daily/weekly/weekend recurrence, points, streaks (🔥), weekly progress bars.
- **Gamification** — every verified chore earns points; parent-approved rewards shelf lets kids spend points on real rewards.
- **Meal planner + family voting** — weekly breakfast/lunch/dinner grid, meal library with ingredients, favorites (❤️), weekly vote (medals for winners) with one-tap "apply top winners to next week's dinners".
- **Shopping list** — auto-populated from planned meals, shared with the mobile companion.
- **PIN authentication** — 4-digit PIN per member with on-screen numeric keypad. Required for personal actions (verify/vote/redeem) and admin actions (settings/rewards/chores/family). First-launch gate forces parents to set a PIN.
- **Personal views** at `/me/[memberId]` — each member has their own screen with their chores, schedule, meal vote panel, and rewards. Reverts to family home after configurable idle (default 2 min).
- **Weather** via Open-Meteo (no API key), header widget + screensaver display.
- **Google Calendar sync** per family member with incremental sync tokens.
- **Screensaver** with quiet-hour schedule, clock + next event + weather, tap-to-wake.
- **Mobile companion PWA** at `/m` — quick chore check-off, event add, meal voting, and shopping list from any phone.

## Screens

| Route | Description |
|-------|-------------|
| `/` | Family dashboard: verse of the day, Hijri date, week overview, member tiles (default) |
| `/week` | Full week view + today sidebar (calendar + chores) |
| `/month` | Full month grid |
| `/chores` | Per-member chore board with pending verifications and rewards shelf |
| `/meals` | Weekly meal plan + shopping list panel + meal library + vote-for-next-week |
| `/settings` | Family (roles + PINs), chores, rewards, weather, display (quiet hours, Hijri offset, idle), Google |
| `/me/[memberId]` | Personal view — that member's chores, schedule, meal votes, rewards |
| `/m` | Mobile home (chore progress + today's events + shopping + vote tile) |
| `/m/chores/[memberId]` | Per-member mobile chore check-off (with verify pills) |
| `/m/event` | Mobile quick-add event (with recurrence) |
| `/m/shopping` | Mobile shopping list |
| `/m/vote` | Mobile meal voting |

## Requirements

**Display device**
- Any Linux distribution with X11 or Wayland and Chromium/Chrome
- Recommended: Raspberry Pi 4/5, Intel NUC, or any small-form-factor PC
- 15.6" 1920×1080 touch monitor (built for Innoview; any HDMI touch panel works)

**Software**
- Node.js 20+ (18 works, 25 tested)
- npm (or pnpm/yarn — package.json is npm-lockfile)

**Optional**
- Google Cloud project with OAuth 2.0 Client ID for Calendar sync

## Quick start (dev)

```bash
git clone <your fork url> zfamily
cd zfamily
npm install
npm run dev
# → http://localhost:3000
```

On first boot the app seeds a demo family (Mom/Dad/Aisha/Zayn) and 8 sample chores + 8 meals. Change everything in Settings.

## Production install (Linux kiosk)

### 1. Get the code onto the device

```bash
sudo mkdir -p /opt/zfamily
sudo chown $USER /opt/zfamily
cd /opt/zfamily
git clone <your fork url> .
npm install
npm run build
```

### 2. Create the runtime user + data dir

```bash
sudo useradd -r -s /bin/false zfamily
sudo mkdir -p /var/lib/zfamily
sudo chown zfamily:zfamily /var/lib/zfamily
```

### 3. systemd unit for the server

`/etc/systemd/system/zfamily.service`:

```ini
[Unit]
Description=zFamily family hub
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=zfamily
WorkingDirectory=/opt/zfamily
Environment=NODE_ENV=production
Environment=ZFAMILY_DATA_DIR=/var/lib/zfamily
Environment=ZFAMILY_BASE_URL=http://localhost:3000
# Optional — only needed for Google Calendar sync:
# Environment=GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
# Environment=GOOGLE_CLIENT_SECRET=your-secret
EnvironmentFile=-/etc/zfamily.env
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

Optionally put secrets in `/etc/zfamily.env` (0600 root:zfamily) instead of inline.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now zfamily
sudo systemctl status zfamily
```

### 4. Auto-launch Chromium in kiosk mode

`~/.config/autostart/zfamily-kiosk.desktop`:

```ini
[Desktop Entry]
Type=Application
Name=zFamily Kiosk
Exec=/usr/bin/chromium-browser --kiosk --noerrdialogs --disable-translate --no-first-run --disable-features=TranslateUI --check-for-update-interval=31536000 --disable-pinch --overscroll-history-navigation=0 --app=http://localhost:3000
X-GNOME-Autostart-enabled=true
```

Notes:
- `--app=` opens without any browser chrome.
- `--disable-pinch` prevents accidental zoom on touch.
- `--overscroll-history-navigation=0` disables swipe-to-go-back.

### 5. Disable screen blanking

```bash
xset s off
xset -dpms
xset s noblank
```

For Raspberry Pi OS also add `consoleblank=0` to `/boot/cmdline.txt`.

### 6. Periodic Google Calendar sync

Add a systemd timer or cron entry:

```cron
*/15 * * * * curl -s -X POST http://localhost:3000/api/sync >/dev/null
```

## Google Calendar setup

1. Google Cloud Console → **APIs & Services** → **Credentials**.
2. Create OAuth 2.0 Client ID, type **Web application**.
3. Authorized redirect URI: `http://<your-device-host>:3000/api/auth/google/callback`
   - For local dev: `http://localhost:3000/api/auth/google/callback`
4. Enable the **Google Calendar API** for the project.
5. Set env vars:

   ```bash
   export GOOGLE_CLIENT_ID=...
   export GOOGLE_CLIENT_SECRET=...
   export ZFAMILY_BASE_URL=http://localhost:3000
   ```

6. In **Settings → Google**, tap "Link Google" next to each family member.
7. Each person authorizes their own Google account; their primary calendar starts syncing to zFamily.

Sync is incremental — after the first pull, only changed events transfer.

### App verification note

Personal-scope OAuth apps in Google Cloud stay in "testing" mode indefinitely unless you go through the verification flow. In testing mode the OAuth screen shows an "unverified app" warning; you can still proceed. Only the test users you add can log in until you verify.

## Configuration reference

### Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `ZFAMILY_DATA_DIR` | `<repo>/.data` | Where `zfamily.db` lives |
| `ZFAMILY_BASE_URL` | `http://localhost:3000` | Public base URL — used to build the OAuth redirect |
| `GOOGLE_CLIENT_ID` | — | Google OAuth client ID (required for Calendar sync) |
| `GOOGLE_CLIENT_SECRET` | — | Google OAuth client secret |
| `PORT` | `3000` | Port for `next start` |

### In-app settings (Settings tab)

| Setting | Where | Default | Notes |
|---------|-------|---------|-------|
| Weather location | Weather | San Francisco | Label + lat/lon (Open-Meteo, no key) |
| Quiet hours | Display | 21:00 – 07:00 | Auto-activates screensaver during window |
| Idle timeout | Display | 5 min | Screensaver kicks in after this long idle |
| Screensaver mode | Display | Clock + next | Clock only, or clock + next event + weather |
| Personal-view auto-revert | Display | 2 min | Personal `/me/[id]` view reverts to family home after this idle |
| Chore reset hour | Display | 4 (04:00) | Daily chores reset at this hour local |
| Hijri offset (moon-sighting) | Display | 0 | Shift Islamic (Umm al-Qura) date by ±3 days |
| Member PIN | Family | not set | 4-digit numeric — required for personal + admin actions |
| Member role | Family | parent | Parent or child; determines verify rules and access to admin |

## Authentication (PINs)

Every family member can have a 4-digit numeric PIN. Actions are gated by PIN using an on-screen keypad; a successful PIN is cached in-memory for 60 seconds so rapid actions don't re-prompt.

**Personal actions** — need the acting member's PIN:
- Verifying a chore completion (verifier PIN)
- Casting/withdrawing a meal vote (voter PIN)
- Redeeming a reward (approving parent PIN)

**Admin actions** — need any parent's PIN:
- Adding/editing/deleting family members, chores, meals, rewards
- Changing weather, display, quiet hours, Hijri offset, or any other setting

**First-launch gate**: if any parent doesn't have a PIN, a full-screen setup blocker requires each parent to set one before the app can be used. This makes admin protection work-out-of-the-box.

PINs are stored as scrypt hashes with per-member salts. Timing-safe compare on verify. PINs are never sent to disk in plaintext.

## Data & backup

Everything lives in **one SQLite file**: `${ZFAMILY_DATA_DIR}/zfamily.db`.

Tables:

- `members` — family members + role + PIN hash/salt + Google credentials
- `events` — cached calendar events (Google or local, with optional RRULE)
- `chores`, `chore_assignees` — chore definitions
- `chore_completions` — daily check-off log with verified_at/verified_by
- `meals` — meal library with JSON ingredients + is_favorite flag
- `meal_plan_entries` — which meal is planned for a date+slot
- `meal_proposals`, `meal_votes` — weekly meal voting
- `shopping_items` — shopping list
- `rewards`, `reward_redemptions` — gamification (points shelf + audit log)
- `settings` — key/value config

### Backing up

```bash
sudo systemctl stop zfamily
sudo cp /var/lib/zfamily/zfamily.db /var/lib/zfamily/zfamily.db.bak-$(date +%F)
sudo systemctl start zfamily
```

Or online (WAL mode is on, so this is safe):

```bash
sqlite3 /var/lib/zfamily/zfamily.db ".backup '/var/lib/zfamily/zfamily.db.bak'"
```

### Restore

```bash
sudo systemctl stop zfamily
sudo cp your-backup.db /var/lib/zfamily/zfamily.db
sudo systemctl start zfamily
```

### Migrations

The schema is applied via `CREATE TABLE IF NOT EXISTS` on every boot in `src/lib/db.ts`. New columns require additive ALTER statements (add them to the migration function). There is no down-migration path.

## Mobile companion (PWA)

Family members can install zFamily on their phone home screen. The PWA scope is `/m`, so installing from `http://<your-host>:3000/m` gets a phone-optimized shell.

Features:
- Chore progress dashboard per member
- One-tap check-off (long-press to undo)
- Quick-add event that pushes to the shared calendar
- Shared shopping list

**Install on iOS**: Safari → open `/m` → Share → Add to Home Screen.
**Install on Android**: Chrome → open `/m` → menu → Install app.

For remote access, put the device behind Tailscale or expose it via a reverse proxy (`caddy`, `nginx`) with HTTPS.

## Screensaver & quiet hours

The screensaver activates in two situations:

1. **Idle**: no touch/mouse/keyboard for the configured idle timeout.
2. **Quiet hours**: current time is within the configured quiet window (default 21:00–07:00).

Modes:
- **Clock only** — huge clock, date, and a "tap to wake" hint.
- **Clock + next** — adds the next upcoming event and the current weather.

Tap anywhere to dismiss. During quiet hours the display is fully black to reduce room-light pollution.

## Routes

| Method | Path | What |
|--------|------|------|
| GET | `/` | Kiosk week view |
| GET | `/month` | Kiosk month view |
| GET | `/chores` | Kiosk chore board |
| GET | `/meals` | Kiosk meal plan + shopping |
| GET | `/settings` | Kiosk settings |
| GET | `/m` | Mobile PWA home |
| GET | `/m/chores/[memberId]` | Mobile chores per member |
| GET | `/m/event` | Mobile quick-add event |
| GET | `/m/shopping` | Mobile shopping list |
| GET | `/api/auth/google/start?memberId=X` | Begin Google OAuth for member X |
| GET | `/api/auth/google/callback` | OAuth redirect target |
| POST | `/api/sync` | Pull all linked Google calendars now |

## Project layout

```
zfamily/
├── SPEC.md                  # Full design doc
├── README.md                # ← you are here
├── next.config.ts
├── package.json
├── public/
│   ├── manifest.webmanifest # PWA manifest
│   └── icon-*.png           # PWA icons (add your own)
└── src/
    ├── app/
    │   ├── layout.tsx       # Root layout (html/body only)
    │   ├── globals.css
    │   ├── actions.ts       # Server actions (all mutations)
    │   ├── (kiosk)/         # Route group: display UI
    │   │   ├── layout.tsx   # Header + BottomNav + Screensaver
    │   │   ├── page.tsx     # Week view
    │   │   ├── month/page.tsx
    │   │   ├── chores/page.tsx
    │   │   ├── meals/page.tsx
    │   │   └── settings/page.tsx
    │   ├── m/               # Route group: mobile PWA
    │   │   ├── layout.tsx
    │   │   ├── page.tsx
    │   │   ├── chores/[memberId]/page.tsx
    │   │   ├── event/page.tsx
    │   │   └── shopping/page.tsx
    │   └── api/
    │       ├── sync/route.ts
    │       └── auth/google/…
    ├── components/          # React components (client + server)
    └── lib/                 # DB + domain logic (server-only)
        ├── db.ts            # SQLite bootstrap + schema
        ├── types.ts         # Shared types + color palette
        ├── dates.ts
        ├── members.ts
        ├── events.ts
        ├── chores.ts
        ├── meals.ts
        ├── settings.ts
        ├── weather.ts
        └── google.ts        # Calendar OAuth + incremental sync
```

## Development tips

**Reset the local database:**
```bash
rm -rf .data/
npm run dev
# will reseed with the demo family
```

**Point the app at a different data dir:**
```bash
ZFAMILY_DATA_DIR=/tmp/zfamily-dev npm run dev
```

**Force a Google sync from the CLI:**
```bash
curl -X POST http://localhost:3000/api/sync
```

**Screenshot the running UI (headless Chrome, macOS):**
```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --hide-scrollbars --window-size=1920,1080 \
  --screenshot=preview.png http://localhost:3000/
```

## Troubleshooting

**Screen doesn't wake on tap.**
Check that the touch device is mapped to the correct output:
```bash
xinput list
xinput map-to-output "ILITEK Multi-Touch" HDMI-1
```

**Touch is offset / axes swapped.**
```bash
xinput --list-props "ILITEK Multi-Touch"
# then set Coordinate Transformation Matrix via xinput set-prop
```

**Chromium keeps prompting "restore session".**
Kiosk flags already suppress most; if it persists, delete `~/.config/chromium/Default/Preferences` between runs, or set `--incognito` (but you lose the PWA install).

**Google sync returns 401.**
Refresh token likely expired. Re-link the member in Settings → Google.

**Google sync returns 410 GONE.**
Sync token expired (Google invalidates after ~1 week of no use). zFamily handles this automatically — next sync falls back to a full re-pull.

**`better-sqlite3` fails on install.**
It compiles native code — needs `python3` and a C++ toolchain. On Debian/Ubuntu:
```bash
sudo apt install -y build-essential python3
```

**Meal library edits don't persist.**
Server actions call `revalidatePath` on `/meals` — if you added new routes, add them to `bust()` in `src/app/actions.ts`.

**Blank white screen after boot.**
Node server probably isn't up yet. Chromium autostart races the systemd service; either add `sleep 5` before `chromium` in the .desktop file, or point Chromium at a small "loading" HTML that redirects to `/` after a moment.

## Roadmap

**v1 (shipped):** calendar (week/month), chores + streaks, Google sync, weather, settings, seed data.

**v2 (shipped):**
- ✅ Meal planner + shopping list
- ✅ Screensaver + quiet hours (clock and clock+next modes)
- ✅ Mobile companion PWA at `/m`

**v3 (shipped):**
- ✅ Verification workflow — pending state, parent verifies children, peer verification for parents
- ✅ Gamification — verified-chore points, rewards shelf, parent-approved redemptions with audit log
- ✅ Meal favorites (❤️) and weekly family voting with medal-ranked winners and one-tap plan-fill
- ✅ Family home dashboard with **Quranic verse of the day** (deterministic per date, Arabic + English)
- ✅ **Hijri (Umm al-Qura) date** with configurable moon-sighting offset (±3 days)
- ✅ **Personal member views** (`/me/[id]`) with auto-revert to family home after configurable idle
- ✅ **4-digit PIN authentication** with on-screen keypad — scrypt-hashed, cached in memory for 60s
- ✅ **Admin gate** — settings/rewards/chores/family CRUD require an authenticated parent
- ✅ **First-launch PIN setup** — enforced before any use
- ✅ **Local recurring events** — weekly / monthly / quarterly, client-expanded

**v4 (future):**
- 🎤 **Voice input** — Whisper-based local ASR for quick-add (events, chores, shopping items) and PIN-less shortcuts
- 🔊 **Audio output** — spoken verse of the day, adhan for prayer times, quiet-hour bell, chore reminders
- Photo slideshow screensaver (Cozyla-style) with local folder watcher
- Google push notifications for near-instant sync
- Two-way sync of local recurring events back to Google Calendar
- Prayer times (with weather-aware suggestions)
- Islamic events overlay on the month view (Eid, Ramadan, etc.)
- Multi-device kiosk fanout via Tailscale
- Birthday/anniversary smart suggestions
- Customizable widget grid (DAKboard-style)

## License

MIT. See LICENSE.
