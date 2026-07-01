import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DB_DIR = process.env.ZFAMILY_DATA_DIR || process.env.SMARTCAL_DATA_DIR || path.join(process.cwd(), ".data");
const DB_PATH = path.join(DB_DIR, "zfamily.db");
const LEGACY_DB_PATH = path.join(DB_DIR, "smartcal.db");

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(DB_DIR, { recursive: true });
  // Backward-compat: if a legacy smartcal.db exists but zfamily.db doesn't,
  // rename it so users upgrading from SmartCal keep their data.
  if (!fs.existsSync(DB_PATH) && fs.existsSync(LEGACY_DB_PATH)) {
    fs.renameSync(LEGACY_DB_PATH, DB_PATH);
    for (const ext of ["-wal", "-shm", "-journal"]) {
      const l = LEGACY_DB_PATH + ext;
      if (fs.existsSync(l)) fs.renameSync(l, DB_PATH + ext);
    }
  }
  const conn = new Database(DB_PATH);
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  migrate(conn);
  _db = conn;
  return conn;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS members (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  color        TEXT NOT NULL,
  emoji        TEXT,
  role         TEXT NOT NULL DEFAULT 'parent', -- 'parent' | 'child'
  google_sub   TEXT UNIQUE,
  google_calendar_id TEXT,
  google_access_token TEXT,
  google_refresh_token TEXT,
  google_token_expiry INTEGER,
  google_sync_token TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id             TEXT PRIMARY KEY,
  member_id      INTEGER REFERENCES members(id) ON DELETE CASCADE,
  calendar_id    TEXT NOT NULL,
  title          TEXT NOT NULL,
  start_ts       INTEGER NOT NULL,
  end_ts         INTEGER NOT NULL,
  all_day        INTEGER NOT NULL DEFAULT 0,
  location       TEXT,
  notes          TEXT,
  rrule          TEXT,
  etag           TEXT,
  source         TEXT NOT NULL DEFAULT 'local',
  updated_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS events_range ON events(start_ts, end_ts);
CREATE INDEX IF NOT EXISTS events_member ON events(member_id);

CREATE TABLE IF NOT EXISTS chores (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT NOT NULL,
  icon         TEXT,
  points       INTEGER NOT NULL DEFAULT 1,
  recurrence   TEXT NOT NULL,
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS chore_assignees (
  chore_id     INTEGER NOT NULL REFERENCES chores(id) ON DELETE CASCADE,
  member_id    INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  PRIMARY KEY (chore_id, member_id)
);

CREATE TABLE IF NOT EXISTS chore_completions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  chore_id       INTEGER NOT NULL REFERENCES chores(id) ON DELETE CASCADE,
  member_id      INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  completed_for  TEXT NOT NULL,
  completed_at   INTEGER NOT NULL,
  verified_at    INTEGER,
  verified_by    INTEGER REFERENCES members(id) ON DELETE SET NULL,
  UNIQUE(chore_id, member_id, completed_for)
);
CREATE INDEX IF NOT EXISTS comp_lookup ON chore_completions(member_id, completed_for);

CREATE TABLE IF NOT EXISTS settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meals (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  icon          TEXT,
  notes         TEXT,
  ingredients   TEXT NOT NULL DEFAULT '[]',  -- JSON array of {name, quantity}
  is_favorite   INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS meal_proposals (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  meal_id      INTEGER NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  week_start   TEXT NOT NULL,   -- YYYY-MM-DD (Sunday) of the target week
  created_at   INTEGER NOT NULL,
  UNIQUE(meal_id, week_start)
);
CREATE INDEX IF NOT EXISTS meal_proposals_week ON meal_proposals(week_start);

CREATE TABLE IF NOT EXISTS meal_votes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id  INTEGER NOT NULL REFERENCES meal_proposals(id) ON DELETE CASCADE,
  member_id    INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at   INTEGER NOT NULL,
  UNIQUE(proposal_id, member_id)
);

CREATE TABLE IF NOT EXISTS meal_plan_entries (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  meal_date     TEXT NOT NULL,   -- YYYY-MM-DD
  slot          TEXT NOT NULL,   -- 'breakfast' | 'lunch' | 'dinner'
  meal_id       INTEGER NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  UNIQUE(meal_date, slot)
);
CREATE INDEX IF NOT EXISTS meal_plan_date ON meal_plan_entries(meal_date);

CREATE TABLE IF NOT EXISTS shopping_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  quantity      TEXT,
  checked       INTEGER NOT NULL DEFAULT 0,
  from_meal_id  INTEGER REFERENCES meals(id) ON DELETE SET NULL,
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS shopping_checked ON shopping_items(checked);

CREATE TABLE IF NOT EXISTS rewards (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT NOT NULL,
  icon         TEXT,
  description  TEXT,
  points_cost  INTEGER NOT NULL,
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reward_redemptions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  reward_id    INTEGER NOT NULL REFERENCES rewards(id) ON DELETE RESTRICT,
  member_id    INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  approved_by  INTEGER REFERENCES members(id) ON DELETE SET NULL,
  points_spent INTEGER NOT NULL,
  redeemed_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS redemptions_by_member ON reward_redemptions(member_id, redeemed_at);
`;

function migrate(conn: Database.Database) {
  conn.exec(SCHEMA);
  ensureColumn(conn, "meals", "is_favorite", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(conn, "members", "role", "TEXT NOT NULL DEFAULT 'parent'");
  ensureColumn(conn, "chore_completions", "verified_at", "INTEGER");
  ensureColumn(conn, "chore_completions", "verified_by", "INTEGER REFERENCES members(id) ON DELETE SET NULL");
  ensureColumn(conn, "members", "pin_hash", "TEXT");
  ensureColumn(conn, "members", "pin_salt", "TEXT");
  // Index needs the columns above to exist first.
  conn.exec("CREATE INDEX IF NOT EXISTS comp_pending ON chore_completions(verified_at) WHERE verified_at IS NULL");
  seedIfEmpty(conn);
}

function ensureColumn(conn: Database.Database, table: string, column: string, def: string) {
  const cols = conn.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (cols.some((c) => c.name === column)) return;
  conn.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
}

function seedIfEmpty(conn: Database.Database) {
  seedMealsIfEmpty(conn);
  seedRewardsIfEmpty(conn);
  const memberCount = (conn.prepare("SELECT COUNT(*) as n FROM members").get() as { n: number }).n;
  if (memberCount > 0) return;

  const now = Math.floor(Date.now() / 1000);
  const insertMember = conn.prepare(
    "INSERT INTO members (name, color, emoji, role, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const seedMembers = [
    { name: "Mom", color: "rose", emoji: "👩", role: "parent", order: 0 },
    { name: "Dad", color: "sky", emoji: "👨", role: "parent", order: 1 },
    { name: "Aisha", color: "emerald", emoji: "👧", role: "child", order: 2 },
    { name: "Zayn", color: "amber", emoji: "👦", role: "child", order: 3 },
  ];
  const memberIds: number[] = [];
  for (const m of seedMembers) {
    const r = insertMember.run(m.name, m.color, m.emoji, m.role, m.order, now);
    memberIds.push(Number(r.lastInsertRowid));
  }

  const insertChore = conn.prepare(
    "INSERT INTO chores (title, icon, points, recurrence, active, created_at) VALUES (?, ?, ?, ?, 1, ?)"
  );
  const assign = conn.prepare(
    "INSERT INTO chore_assignees (chore_id, member_id) VALUES (?, ?)"
  );
  const seedChores: Array<{ title: string; icon: string; points: number; recurrence: string; assignees: number[] }> = [
    { title: "Make bed", icon: "🛏️", points: 1, recurrence: "daily", assignees: [memberIds[2], memberIds[3]] },
    { title: "Brush teeth (AM)", icon: "🪥", points: 1, recurrence: "daily", assignees: [memberIds[2], memberIds[3]] },
    { title: "Brush teeth (PM)", icon: "🪥", points: 1, recurrence: "daily", assignees: [memberIds[2], memberIds[3]] },
    { title: "Empty dishwasher", icon: "🍽️", points: 3, recurrence: "daily", assignees: [memberIds[0]] },
    { title: "Take out trash", icon: "🗑️", points: 3, recurrence: "weekly:MON,THU", assignees: [memberIds[1]] },
    { title: "Walk dog", icon: "🐕", points: 2, recurrence: "daily", assignees: [memberIds[1], memberIds[2]] },
    { title: "Homework", icon: "📚", points: 5, recurrence: "weekdays", assignees: [memberIds[2], memberIds[3]] },
    { title: "Tidy room", icon: "🧸", points: 2, recurrence: "weekly:SAT", assignees: [memberIds[2], memberIds[3]] },
  ];
  for (const c of seedChores) {
    const r = insertChore.run(c.title, c.icon, c.points, c.recurrence, now);
    const cid = Number(r.lastInsertRowid);
    for (const mid of c.assignees) assign.run(cid, mid);
  }

  const setting = conn.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?)"
  );
  setting.run("weather_lat", "37.7749");
  setting.run("weather_lon", "-122.4194");
  setting.run("weather_label", "San Francisco");
  setting.run("quiet_start", "21:00");
  setting.run("quiet_end", "07:00");
  setting.run("chore_reset_hour", "4");
  setting.run("idle_seconds", "300");
  setting.run("screensaver_mode", "clock");
  setting.run("personal_idle_seconds", "120");
  setting.run("hijri_offset", "0");
}

function seedRewardsIfEmpty(conn: Database.Database) {
  const n = (conn.prepare("SELECT COUNT(*) as n FROM rewards").get() as { n: number }).n;
  if (n > 0) return;
  const now = Math.floor(Date.now() / 1000);
  const insert = conn.prepare(
    "INSERT INTO rewards (title, icon, description, points_cost, active, created_at) VALUES (?, ?, ?, ?, 1, ?)"
  );
  const seed: Array<{ title: string; icon: string; description: string; cost: number }> = [
    { title: "30 min extra screen time", icon: "📱", description: "Cash in for phone or tablet time.", cost: 15 },
    { title: "Pick tonight's dessert", icon: "🍨", description: "Family dessert of your choice.", cost: 20 },
    { title: "Movie night pick", icon: "🍿", description: "Choose the family movie this weekend.", cost: 30 },
    { title: "Stay up 30 min later", icon: "🌙", description: "One-time late bedtime.", cost: 25 },
    { title: "Small toy or book", icon: "🎁", description: "Up to $10 at the next store trip.", cost: 60 },
    { title: "Friend sleepover", icon: "🏕️", description: "Invite a friend to sleep over.", cost: 100 },
    { title: "Ice cream trip", icon: "🍦", description: "Family walk for ice cream.", cost: 40 },
  ];
  for (const r of seed) insert.run(r.title, r.icon, r.description, r.cost, now);
}

function seedMealsIfEmpty(conn: Database.Database) {
  const n = (conn.prepare("SELECT COUNT(*) as n FROM meals").get() as { n: number }).n;
  if (n > 0) return;
  const now = Math.floor(Date.now() / 1000);
  const insert = conn.prepare(
    "INSERT INTO meals (name, icon, notes, ingredients, created_at) VALUES (?, ?, ?, ?, ?)"
  );
  const seed = [
    { name: "Oatmeal + berries", icon: "🥣", ingredients: [{ name: "Rolled oats", quantity: "1 cup" }, { name: "Milk", quantity: "2 cups" }, { name: "Berries", quantity: "1 cup" }] },
    { name: "Avocado toast", icon: "🥑", ingredients: [{ name: "Sourdough bread", quantity: "4 slices" }, { name: "Avocado", quantity: "2" }, { name: "Lemon", quantity: "1" }] },
    { name: "Turkey sandwich", icon: "🥪", ingredients: [{ name: "Bread", quantity: "8 slices" }, { name: "Turkey", quantity: "1/2 lb" }, { name: "Lettuce", quantity: "1 head" }, { name: "Tomato", quantity: "2" }] },
    { name: "Grilled salmon", icon: "🐟", ingredients: [{ name: "Salmon fillet", quantity: "1.5 lb" }, { name: "Lemon", quantity: "1" }, { name: "Asparagus", quantity: "1 bunch" }, { name: "Olive oil", quantity: "1 tbsp" }] },
    { name: "Chicken tikka", icon: "🍛", ingredients: [{ name: "Chicken thighs", quantity: "2 lb" }, { name: "Yogurt", quantity: "1 cup" }, { name: "Tikka masala paste", quantity: "1 jar" }, { name: "Basmati rice", quantity: "2 cups" }] },
    { name: "Pasta bolognese", icon: "🍝", ingredients: [{ name: "Spaghetti", quantity: "1 lb" }, { name: "Ground beef", quantity: "1 lb" }, { name: "Tomato sauce", quantity: "1 jar" }, { name: "Onion", quantity: "1" }, { name: "Garlic", quantity: "3 cloves" }] },
    { name: "Taco night", icon: "🌮", ingredients: [{ name: "Ground turkey", quantity: "1 lb" }, { name: "Taco shells", quantity: "12" }, { name: "Cheddar", quantity: "8 oz" }, { name: "Salsa", quantity: "1 jar" }, { name: "Lime", quantity: "2" }] },
    { name: "Veggie stir-fry", icon: "🥡", ingredients: [{ name: "Broccoli", quantity: "1 head" }, { name: "Bell pepper", quantity: "2" }, { name: "Snap peas", quantity: "1 cup" }, { name: "Soy sauce", quantity: "1/4 cup" }, { name: "Jasmine rice", quantity: "2 cups" }] },
  ];
  for (const m of seed) {
    insert.run(m.name, m.icon, null, JSON.stringify(m.ingredients), now);
  }
}
