import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DB_DIR = process.env.ZFAMILY_DATA_DIR || process.env.SMARTCAL_DATA_DIR || path.join(process.cwd(), ".data");
const DB_PATH = path.join(DB_DIR, "zfamily.db");

/** The resolved data directory (holds zfamily.db). */
export function dataDir(): string {
  return DB_DIR;
}
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

CREATE TABLE IF NOT EXISTS member_photos (
  member_id   INTEGER PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  mime        TEXT NOT NULL,
  data        BLOB NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ical_feeds (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT NOT NULL,
  url              TEXT NOT NULL,
  member_id        INTEGER REFERENCES members(id) ON DELETE SET NULL,
  color            TEXT,
  interval_hours   INTEGER NOT NULL DEFAULT 6,
  active           INTEGER NOT NULL DEFAULT 1,
  last_synced_at   INTEGER,
  last_status      TEXT,
  last_event_count INTEGER,
  created_at       INTEGER NOT NULL
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
  shared       INTEGER NOT NULL DEFAULT 0,  -- 1 = common chore, doable by anyone (no assignees)
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
  ingredients   TEXT NOT NULL DEFAULT '[]',  -- JSON array of {name, quantity, unit}
  is_favorite   INTEGER NOT NULL DEFAULT 0,
  slots         TEXT,                          -- CSV of eligible slots: breakfast,lunch,dinner (NULL = all)
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS meal_proposals (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  meal_id      INTEGER NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  slot_type    TEXT NOT NULL,   -- breakfast | lunch | dinner (the future idea's meal-type)
  member_id    INTEGER REFERENCES members(id) ON DELETE SET NULL,  -- proposer for a personal breakfast; NULL for shared lunch/dinner
  created_at   INTEGER NOT NULL
);

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
  ensureColumn(conn, "meals", "slots", "TEXT");
  ensureColumn(conn, "members", "role", "TEXT NOT NULL DEFAULT 'parent'");
  ensureColumn(conn, "chores", "shared", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(conn, "chore_completions", "verified_at", "INTEGER");
  ensureColumn(conn, "chore_completions", "verified_by", "INTEGER REFERENCES members(id) ON DELETE SET NULL");
  ensureColumn(conn, "members", "pin_hash", "TEXT");
  ensureColumn(conn, "members", "pin_salt", "TEXT");
  ensureColumn(conn, "members", "nickname", "TEXT");
  ensureColumn(conn, "members", "photo_updated_at", "INTEGER");
  // Index needs the columns above to exist first.
  conn.exec("CREATE INDEX IF NOT EXISTS comp_pending ON chore_completions(verified_at) WHERE verified_at IS NULL");
  migrateProposals(conn);
  // Index after the proposals table is in its final (slot_type) shape.
  conn.exec("CREATE INDEX IF NOT EXISTS meal_proposals_slot ON meal_proposals(slot_type)");
  seedStarterContent(conn);
}

// Meal proposals moved from week-bound dinner candidates to a future idea pool
// tagged by slot_type (+ proposer for personal breakfasts). Rebuild the table
// on existing installs, carrying old proposals over as shared dinner ideas.
function migrateProposals(conn: Database.Database) {
  const cols = conn.prepare("PRAGMA table_info(meal_proposals)").all() as Array<{ name: string }>;
  if (cols.length === 0) return; // table not created yet (fresh install handles via SCHEMA)
  const hasWeekStart = cols.some((c) => c.name === "week_start");
  const hasSlotType = cols.some((c) => c.name === "slot_type");
  if (!hasWeekStart || hasSlotType) return; // already migrated
  conn.pragma("foreign_keys = OFF");
  try {
    const rebuild = conn.transaction(() => {
      conn.exec(`CREATE TABLE meal_proposals_new (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        meal_id      INTEGER NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
        slot_type    TEXT NOT NULL,
        member_id    INTEGER REFERENCES members(id) ON DELETE SET NULL,
        created_at   INTEGER NOT NULL
      );`);
      conn.exec(`INSERT INTO meal_proposals_new (id, meal_id, slot_type, member_id, created_at)
                 SELECT id, meal_id, 'dinner', NULL, created_at FROM meal_proposals;`);
      conn.exec("DROP TABLE meal_proposals;");
      conn.exec("ALTER TABLE meal_proposals_new RENAME TO meal_proposals;");
    });
    rebuild();
  } finally {
    conn.pragma("foreign_keys = ON");
  }
}

// All domain tables, ordered so that a plain DELETE sweep is easy to reason
// about. Foreign keys are disabled during a factory reset so order doesn't
// actually matter, but keep children before parents for clarity.
const ALL_TABLES = [
  "chore_completions",
  "chore_assignees",
  "member_photos",
  "reward_redemptions",
  "meal_votes",
  "meal_proposals",
  "meal_plan_entries",
  "shopping_items",
  "events",
  "ical_feeds",
  "chores",
  "rewards",
  "meals",
  "members",
  "settings",
];

/** Wipe every row from every domain table and re-seed the starter meal and
 *  reward libraries. Members/chores/settings are intentionally left empty so
 *  the app drops back into the first-run family setup workflow. */
export function factoryReset() {
  const conn = db();
  conn.pragma("foreign_keys = OFF");
  try {
    const wipe = conn.transaction(() => {
      for (const t of ALL_TABLES) conn.prepare(`DELETE FROM ${t}`).run();
      // Reset AUTOINCREMENT counters so ids start from 1 again.
      try {
        conn.prepare("DELETE FROM sqlite_sequence").run();
      } catch {
        // sqlite_sequence only exists once an AUTOINCREMENT table has data.
      }
    });
    wipe();
  } finally {
    conn.pragma("foreign_keys = ON");
  }
  seedStarterContent(conn);
}

function ensureColumn(conn: Database.Database, table: string, column: string, def: string) {
  const cols = conn.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (cols.some((c) => c.name === column)) return;
  conn.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
}

// Seed the content libraries that every household starts with — the meal
// ideas and reward menu. Deliberately does NOT create any family members,
// chores, or location settings: a fresh (or factory-reset) install starts
// with no family so the first-run setup workflow can build one.
function seedStarterContent(conn: Database.Database) {
  seedMealsIfEmpty(conn);
  seedRewardsIfEmpty(conn);
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
    "INSERT INTO meals (name, icon, notes, ingredients, slots, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const seed = [
    { name: "Oatmeal + berries", icon: "🥣", slots: "breakfast", ingredients: [{ name: "Rolled oats", quantity: "1 cup" }, { name: "Milk", quantity: "2 cups" }, { name: "Berries", quantity: "1 cup" }] },
    { name: "Avocado toast", icon: "🥑", slots: "breakfast,lunch", ingredients: [{ name: "Sourdough bread", quantity: "4 slices" }, { name: "Avocado", quantity: "2" }, { name: "Lemon", quantity: "1" }] },
    { name: "Turkey sandwich", icon: "🥪", slots: "lunch", ingredients: [{ name: "Bread", quantity: "8 slices" }, { name: "Turkey", quantity: "1/2 lb" }, { name: "Lettuce", quantity: "1 head" }, { name: "Tomato", quantity: "2" }] },
    { name: "Grilled salmon", icon: "🐟", slots: "dinner", ingredients: [{ name: "Salmon fillet", quantity: "1.5 lb" }, { name: "Lemon", quantity: "1" }, { name: "Asparagus", quantity: "1 bunch" }, { name: "Olive oil", quantity: "1 tbsp" }] },
    { name: "Chicken tikka", icon: "🍛", slots: "lunch,dinner", ingredients: [{ name: "Chicken thighs", quantity: "2 lb" }, { name: "Yogurt", quantity: "1 cup" }, { name: "Tikka masala paste", quantity: "1 jar" }, { name: "Basmati rice", quantity: "2 cups" }] },
    { name: "Pasta bolognese", icon: "🍝", slots: "lunch,dinner", ingredients: [{ name: "Spaghetti", quantity: "1 lb" }, { name: "Ground beef", quantity: "1 lb" }, { name: "Tomato sauce", quantity: "1 jar" }, { name: "Onion", quantity: "1" }, { name: "Garlic", quantity: "3 cloves" }] },
    { name: "Taco night", icon: "🌮", slots: "dinner", ingredients: [{ name: "Ground turkey", quantity: "1 lb" }, { name: "Taco shells", quantity: "12" }, { name: "Cheddar", quantity: "8 oz" }, { name: "Salsa", quantity: "1 jar" }, { name: "Lime", quantity: "2" }] },
    { name: "Veggie stir-fry", icon: "🥡", slots: "lunch,dinner", ingredients: [{ name: "Broccoli", quantity: "1 head" }, { name: "Bell pepper", quantity: "2" }, { name: "Snap peas", quantity: "1 cup" }, { name: "Soy sauce", quantity: "1/4 cup" }, { name: "Jasmine rice", quantity: "2 cups" }] },
  ];
  for (const m of seed) {
    insert.run(m.name, m.icon, null, JSON.stringify(m.ingredients), m.slots, now);
  }
}
