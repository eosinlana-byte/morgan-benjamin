const path = require("path");
const fs = require("fs");

const DATABASE_URL = process.env.DATABASE_URL || "";
const usePg = /^postgres(ql)?:\/\//i.test(DATABASE_URL);

let pgPool = null;
let sqlite = null;

function pgString() {
  let s = DATABASE_URL;
  try {
    const u = new URL(s);
    u.searchParams.delete("channel_binding");
    s = u.toString();
  } catch (_) {}
  return s;
}

async function query(text, params = []) {
  if (usePg) {
    const res = await pgPool.query(text, params);
    return res.rows;
  }
  const returning = /RETURNING/i.test(text);
  const sql = text.replace(/RETURNING \w+/i, "").replace(/\$(\d+)/g, "?");
  const stmt = sqlite.prepare(sql);
  const trimmed = sql.trim().toUpperCase();
  if (trimmed.startsWith("SELECT") || trimmed.startsWith("PRAGMA")) return stmt.all(...params);
  const info = stmt.run(...params);
  if (returning) return [{ id: Number(info.lastInsertRowid) }];
  return [];
}

async function init() {
  if (usePg) {
    const { Pool } = require("pg");
    const connectionString = pgString();
    const needsSsl = connectionString.includes("neon.tech") || connectionString.includes("sslmode=require");
    pgPool = new Pool({
      connectionString,
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
      max: 5,
    });
  } else {
    const Database = require("better-sqlite3");
    const dir = path.join(__dirname, "data");
    fs.mkdirSync(dir, { recursive: true });
    sqlite = new Database(path.join(dir, "morgan.sqlite"));
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
  }

  const serial = usePg ? "SERIAL PRIMARY KEY" : "INTEGER PRIMARY KEY AUTOINCREMENT";
  const blob = usePg ? "BYTEA" : "BLOB";
  const now = usePg ? "NOW()" : "CURRENT_TIMESTAMP";

  await query(`
    CREATE TABLE IF NOT EXISTS tracks (
      id ${serial},
      title TEXT NOT NULL,
      genre TEXT DEFAULT '',
      role TEXT DEFAULT '',
      description TEXT DEFAULT '',
      cover TEXT DEFAULT '',
      audio TEXT DEFAULT '',
      links TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT ${now}
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS works (
      id ${serial},
      title TEXT NOT NULL,
      category TEXT DEFAULT 'vocals',
      description TEXT DEFAULT '',
      image TEXT DEFAULT '',
      audio TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT ${now}
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS testimonials (
      id ${serial},
      quote TEXT NOT NULL DEFAULT '',
      name TEXT DEFAULT '',
      role TEXT DEFAULT '',
      image TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT ${now}
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS media_files (
      id ${serial},
      mime_type TEXT NOT NULL,
      original_name TEXT DEFAULT '',
      data ${blob} NOT NULL,
      created_at TIMESTAMP DEFAULT ${now}
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS enquiries (
      id ${serial},
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT DEFAULT '',
      service TEXT DEFAULT '',
      subject TEXT DEFAULT '',
      message TEXT NOT NULL,
      status TEXT DEFAULT 'new',
      created_at TIMESTAMP DEFAULT ${now}
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT DEFAULT ''
    )
  `);

  try {
    await query("ALTER TABLE enquiries ADD COLUMN subject TEXT DEFAULT ''");
  } catch (_) {}

  const seeded = (await query("SELECT value FROM settings WHERE key='seeded'"))[0];
  if (!seeded) {
    const about = JSON.stringify({
      photo: "/assets/studio.png",
      line: "Singer, writer, producer.",
      text: "Morgan Benjamin sings, writes, and builds records. Pop, rock, rap, indie, EDM.",
    });
    const social = JSON.stringify({
      instagram: "",
      spotify: "",
      youtube: "",
      apple: "",
    });
    await query("INSERT INTO settings (key, value) VALUES ('about', $1)", [about]);
    await query("INSERT INTO settings (key, value) VALUES ('social', $1)", [social]);
    await query("INSERT INTO settings (key, value) VALUES ('seeded', '1')");
  }
}

async function getSettings() {
  const rows = await query("SELECT key, value FROM settings");
  const out = {};
  for (const row of rows) {
    try {
      out[row.key] = JSON.parse(row.value);
    } catch {
      out[row.key] = row.value;
    }
  }
  return out;
}

module.exports = { query, init, getSettings, usePg };
