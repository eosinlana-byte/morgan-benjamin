try { require("dotenv").config(); } catch (_) {}
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const multer = require("multer");
const nodemailer = require("nodemailer");
const { query, init, getSettings, usePg } = require("./db");

const app = express();
const PORT = process.env.PORT || 8090;
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "MorganArts";
const SECRET = process.env.SECRET || crypto.randomBytes(32).toString("hex");
const TOKEN_TTL = 7 * 24 * 3600 * 1000;

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: false, limit: "20mb" }));
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 80 * 1024 * 1024 },
});

const sign = (v) => crypto.createHmac("sha256", SECRET).update(v).digest("hex");
function makeToken() {
  const payload = Buffer.from(JSON.stringify({ u: ADMIN_USER, exp: Date.now() + TOKEN_TTL })).toString("base64");
  return payload + "." + sign(payload);
}
function verifyToken(token) {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || sign(payload) !== sig) return false;
  try {
    const d = JSON.parse(Buffer.from(payload, "base64").toString());
    return d.u === ADMIN_USER && d.exp > Date.now();
  } catch {
    return false;
  }
}
function getCookie(req, name) {
  const c = req.headers.cookie || "";
  const m = c.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[1]) : null;
}
function requireAdmin(req, res, next) {
  if (verifyToken(getCookie(req, "mb_admin"))) return next();
  res.status(401).json({ success: false, error: "Not authenticated" });
}
function checkPassword(pw) {
  const a = Buffer.from(String(pw));
  const b = Buffer.from(ADMIN_PASSWORD);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

const hits = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 15 * 60 * 1000);
  if (list.length >= 6) {
    hits.set(ip, list);
    return true;
  }
  list.push(now);
  hits.set(ip, list);
  return false;
}

function getTransporter() {
  if (process.env.RESEND_API_KEY) {
    return nodemailer.createTransport({
      host: "smtp.resend.com",
      port: 465,
      secure: true,
      auth: { user: "resend", pass: process.env.RESEND_API_KEY },
    });
  }
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 465),
    secure: true,
    auth: { user, pass },
  });
}

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const SERVICES = new Set(["Singing", "Songwriting", "Music Production", "Lyric Video", "Collaboration", "Other"]);

function asBuffer(data) {
  if (!data) return Buffer.alloc(0);
  if (Buffer.isBuffer(data)) return data;
  return Buffer.from(data);
}

function guessAudioMime(mime, name) {
  if (mime && /^audio\//i.test(mime)) return mime;
  const n = String(name || "").toLowerCase();
  if (n.endsWith(".mp3")) return "audio/mpeg";
  if (n.endsWith(".wav")) return "audio/wav";
  if (n.endsWith(".ogg")) return "audio/ogg";
  if (n.endsWith(".m4a") || n.endsWith(".mp4")) return "audio/mp4";
  return mime || "application/octet-stream";
}

app.get("/media/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const sizeSql = usePg
      ? "SELECT mime_type, original_name, octet_length(data) AS size FROM media_files WHERE id = $1"
      : "SELECT mime_type, original_name, length(data) AS size FROM media_files WHERE id = $1";
    const meta = await query(sizeSql, [id]);
    if (!meta[0]) return res.status(404).end();
    const total = Number(meta[0].size) || 0;
    if (!total) return res.status(404).end();
    const mime = guessAudioMime(meta[0].mime_type, meta[0].original_name);
    const isAudio = /^audio\//i.test(mime);
    const MAX = 256 * 1024;

    let start = 0;
    let end = total - 1;
    const range = req.headers.range;
    if (range) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!m) return res.status(416).end();
      start = m[1] ? Number(m[1]) : 0;
      end = m[2] ? Math.min(Number(m[2]), total - 1) : total - 1;
    } else if (isAudio && total > MAX) {
      end = MAX - 1;
    }
    if (isAudio && end - start + 1 > MAX) end = start + MAX - 1;
    if (start < 0 || start >= total) {
      res.setHeader("Content-Range", `bytes */${total}`);
      return res.status(416).end();
    }
    end = Math.min(end, total - 1);
    const length = end - start + 1;
    const sliceSql = usePg
      ? "SELECT substring(data from $2 for $3) AS chunk FROM media_files WHERE id = $1"
      : "SELECT substr(data, $2, $3) AS chunk FROM media_files WHERE id = $1";
    const rows = await query(sliceSql, [id, start + 1, length]);
    const buf = asBuffer(rows[0] && rows[0].chunk);

    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (start > 0 || end < total - 1) {
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${total}`);
    }
    res.setHeader("Content-Length", buf.length);
    res.end(buf);
  } catch (err) {
    console.error("[media]", err.message);
    res.status(500).end();
  }
});

app.get("/api/content", async (_req, res) => {
  try {
    const [tracks, works, testimonials, settings] = await Promise.all([
      query("SELECT * FROM tracks ORDER BY id DESC"),
      query("SELECT * FROM works ORDER BY id DESC"),
      query("SELECT * FROM testimonials ORDER BY id DESC"),
      getSettings(),
    ]);
    res.json({ tracks, works, testimonials, settings });
  } catch (err) {
    console.error("[content]", err.message);
    res.status(500).json({ success: false, error: "Could not load content." });
  }
});

function unpackPayload(p) {
  try {
    let s = String(p || "").replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    return JSON.parse(Buffer.from(s, "base64").toString("utf8"));
  } catch {
    return {};
  }
}

async function handleContact(req, res) {
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").toString().split(",")[0].trim();
  if (isRateLimited(ip)) return res.status(429).json({ success: false, error: "Too many messages. Try later." });
  const packed = unpackPayload((req.query && req.query.p) || (req.body && req.body.p));
  const src = Object.assign({}, packed, req.query || {}, req.body || {});
  delete src.p;

  const name = String(src.name || "").trim();
  const email = String(src.email || "").trim();
  const trap = String(src.hp_trap || src.website || "").trim();
  if (trap && trap !== email && !isValidEmail(trap)) {
    const acceptEarly = String(req.headers.accept || "");
    if (acceptEarly.includes("text/html")) return res.redirect("/?sent=1#contact");
    return res.json({ success: true });
  }
  const dial = String(src.dial || "").trim();
  let phone = String(src.phone || "").trim().slice(0, 60);
  if (phone && dial && !phone.startsWith("+")) phone = (dial + " " + phone).slice(0, 60);
  const service = String(src.service || "").trim();
  const subject = String(src.subject || "").trim().slice(0, 200);
  const message = String(src.message || "").trim();
  if (name.length < 2) return res.status(400).json({ success: false, error: "Enter your name." });
  if (!isValidEmail(email)) return res.status(400).json({ success: false, error: "Enter a valid email." });
  if (!SERVICES.has(service)) return res.status(400).json({ success: false, error: "Pick a service." });
  if (subject.length < 2) return res.status(400).json({ success: false, error: "Enter a subject." });
  if (message.length < 4) return res.status(400).json({ success: false, error: "Write a short message." });

  try {
    await query(
      "INSERT INTO enquiries (name, email, phone, service, subject, message) VALUES ($1,$2,$3,$4,$5,$6)",
      [name, email, phone, service, subject, message]
    );
  } catch (err) {
    console.error("[contact] save", err.message);
    return res.status(500).json({ success: false, error: "Could not save. Try again." });
  }

  const transporter = getTransporter();
  const toAddress = process.env.MAIL_TO || process.env.SMTP_USER;
  if (transporter && toAddress) {
    transporter
      .sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
        to: toAddress,
        replyTo: email,
        subject: "Morgan Benjamin: " + subject,
        text: `${name} <${email}>\n${phone}\n${service}\n${subject}\n\n${message}`,
        html: `<p><b>${esc(name)}</b> &lt;${esc(email)}&gt;</p><p>${esc(phone)}</p><p>${esc(service)}</p><p>${esc(subject)}</p><p>${esc(message)}</p>`,
      })
      .catch((err) => console.error("[contact] mail", err.message));
  }
  const accept = String(req.headers.accept || "");
  if (accept.includes("text/html")) {
    return res.redirect("/?sent=1#contact");
  }
  res.json({ success: true });
}
app.post("/api/contact", handleContact);
app.get("/api/contact", handleContact);

app.post("/api/admin/login", (req, res) => {
  const { user, password } = req.body || {};
  if (user === ADMIN_USER && checkPassword(password)) {
    res.setHeader(
      "Set-Cookie",
      `mb_admin=${encodeURIComponent(makeToken())}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${TOKEN_TTL / 1000}`
    );
    return res.json({ success: true });
  }
  res.status(401).json({ success: false, error: "Wrong login." });
});
app.post("/api/admin/logout", (_req, res) => {
  res.setHeader("Set-Cookie", "mb_admin=; HttpOnly; Path=/; Max-Age=0");
  res.json({ success: true });
});
app.get("/api/admin/check", (req, res) => {
  res.json({ authenticated: verifyToken(getCookie(req, "mb_admin")) });
});

app.post("/api/admin/upload", requireAdmin, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: "No file." });
  const mime = req.file.mimetype || "application/octet-stream";
  const name = req.file.originalname || "file";
  const rows = await query(
    "INSERT INTO media_files (mime_type, original_name, data) VALUES ($1,$2,$3) RETURNING id",
    [mime, name, req.file.buffer]
  );
  const id = rows[0] && rows[0].id;
  res.json({ success: true, id, url: "/media/" + id });
});

app.get("/api/admin/enquiries", requireAdmin, async (_req, res) => {
  res.json(await query("SELECT * FROM enquiries ORDER BY id DESC"));
});
app.patch("/api/admin/enquiries/:id", requireAdmin, async (req, res) => {
  const status = req.body.status;
  if (!["new", "read"].includes(status)) return res.status(400).json({ success: false });
  await query("UPDATE enquiries SET status = $1 WHERE id = $2", [status, req.params.id]);
  res.json({ success: true });
});
app.delete("/api/admin/enquiries/:id", requireAdmin, async (req, res) => {
  await query("DELETE FROM enquiries WHERE id = $1", [req.params.id]);
  res.json({ success: true });
});

function crud(base, table, fields, required = "title") {
  app.get(`/api/admin/${base}`, requireAdmin, async (_req, res) => {
    res.json(await query(`SELECT * FROM ${table} ORDER BY id DESC`));
  });
  app.delete(`/api/admin/${base}/:id`, requireAdmin, async (req, res) => {
    await query(`DELETE FROM ${table} WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  });
  app.post(`/api/admin/${base}`, requireAdmin, async (req, res) => {
    const r = req.body || {};
    if (!String(r[required] || "").trim()) return res.status(400).json({ success: false, error: "Fill the required field." });
    const vals = fields.map((f) => (r[f] == null ? "" : r[f]));
    const ph = fields.map((_, i) => `$${i + 1}`).join(",");
    const rows = await query(
      `INSERT INTO ${table} (${fields.join(",")}) VALUES (${ph}) RETURNING id`,
      vals
    );
    res.json({ success: true, id: rows[0] && rows[0].id });
  });
  app.patch(`/api/admin/${base}/:id`, requireAdmin, async (req, res) => {
    const r = req.body || {};
    const set = fields.map((f, i) => `${f}=$${i + 1}`).join(",");
    await query(`UPDATE ${table} SET ${set} WHERE id=$${fields.length + 1}`, [
      ...fields.map((f) => (r[f] == null ? "" : r[f])),
      req.params.id,
    ]);
    res.json({ success: true });
  });
}

crud("tracks", "tracks", [
  "title",
  "genre",
  "role",
  "description",
  "cover",
  "audio",
  "links",
  "artist",
  "release_date",
  "youtube_id",
  "spotify",
  "apple",
  "youtube",
  "audiomack",
]);
crud("works", "works", ["title", "category", "description", "image", "audio"]);
crud("testimonials", "testimonials", ["quote", "name", "role", "image"], "quote");

app.get("/api/admin/settings", requireAdmin, async (_req, res) => {
  res.json(await getSettings());
});
app.post("/api/admin/settings", requireAdmin, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key) return res.status(400).json({ success: false });
  const raw = typeof value === "string" ? value : JSON.stringify(value);
  const existing = (await query("SELECT key FROM settings WHERE key = $1", [key]))[0];
  if (existing) await query("UPDATE settings SET value = $1 WHERE key = $2", [raw, key]);
  else await query("INSERT INTO settings (key, value) VALUES ($1,$2)", [key, raw]);
  res.json({ success: true });
});

app.get("/admin", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

init()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log("Morgan Benjamin on 0.0.0.0:" + PORT);
    });
  })
  .catch((err) => {
    console.error("DB init failed:", err.message);
    process.exit(1);
  });
