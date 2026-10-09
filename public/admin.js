const $ = (s, r = document) => r.querySelector(s);

async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: opts.body instanceof FormData ? {} : { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function upload(file) {
  const fd = new FormData();
  fd.append("file", file);
  const d = await api("/api/admin/upload", { method: "POST", body: fd });
  return d.url;
}

let toastTimer;
function toast(msg, type = "ok") {
  const t = $("#toast");
  if (!t) return;
  t.textContent = msg;
  t.className = "toast " + type;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2800);
}

function showApp(on) {
  $("#loginView").hidden = on;
  $("#appView").hidden = !on;
  if (on) loadView(currentView);
}

let currentView = "dashboard";
const TITLES = {
  dashboard: "Dashboard",
  tracks: "Tracks",
  works: "Work",
  notes: "Notes",
  enquiries: "Messages",
  settings: "Settings",
};

function loadView(view) {
  currentView = view;
  $("#viewTitle").textContent = TITLES[view] || view;
  document.querySelectorAll(".sidebar__nav button").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === view);
  });
  $("#sidebar").classList.remove("open");
  const c = $("#viewContent");
  c.innerHTML = "";
  if (view === "dashboard") renderDashboard(c);
  else if (view === "tracks") renderTracks(c);
  else if (view === "works") renderWorks(c);
  else if (view === "notes") renderNotes(c);
  else if (view === "enquiries") renderEnquiries(c);
  else if (view === "settings") renderSettings(c);
}

$("#loginForm").onsubmit = async (e) => {
  e.preventDefault();
  const note = $("#loginNote");
  note.textContent = "";
  note.classList.remove("error");
  try {
    await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({
        user: $("#loginUser").value,
        password: $("#loginPass").value,
      }),
    });
    showApp(true);
  } catch (err) {
    note.textContent = err.message;
    note.classList.add("error");
  }
};

$("#logoutBtn").onclick = async () => {
  await api("/api/admin/logout", { method: "POST" });
  location.reload();
};

$("#mobileMenuBtn").onclick = () => $("#sidebar").classList.toggle("open");
document.querySelectorAll(".sidebar__nav button").forEach((b) => {
  b.onclick = () => loadView(b.dataset.view);
});

function panel(title, inner, extraHead = "") {
  return `<section class="panel"><div class="panel__head"><h3>${title}</h3>${extraHead}</div><div class="panel__body">${inner}</div></section>`;
}

function row(title, sub, id, kind) {
  const wrap = document.createElement("div");
  wrap.className = "list-row";
  wrap.innerHTML = `<div class="list-row__main"><div class="list-row__title"></div><div class="list-row__sub"></div></div><div class="list-row__actions"><button type="button" class="btn btn--danger btn--sm">Delete</button></div>`;
  wrap.querySelector(".list-row__title").textContent = title;
  wrap.querySelector(".list-row__sub").textContent = sub || "";
  wrap.querySelector("button").onclick = async () => {
    if (!confirm("Delete this?")) return;
    await api("/api/admin/" + kind + "/" + id, { method: "DELETE" });
    loadView(currentView);
  };
  return wrap;
}

async function renderDashboard(c) {
  const [tracks, works, notes, enqs] = await Promise.all([
    api("/api/admin/tracks"),
    api("/api/admin/works"),
    api("/api/admin/testimonials"),
    api("/api/admin/enquiries"),
  ]);
  const unread = enqs.filter((e) => e.status !== "read").length;
  const badge = $("#enqBadge");
  if (unread) {
    badge.hidden = false;
    badge.textContent = String(unread);
  } else badge.hidden = true;
  c.innerHTML = `
    <div class="stats">
      <div class="stat"><div class="stat__num">${tracks.length}</div><div class="stat__label">Tracks</div></div>
      <div class="stat"><div class="stat__num">${works.length}</div><div class="stat__label">Work</div></div>
      <div class="stat"><div class="stat__num">${notes.length}</div><div class="stat__label">Notes</div></div>
      <div class="stat"><div class="stat__num">${enqs.length}</div><div class="stat__label">Messages</div></div>
    </div>
    ${panel("Quick add", `<p class="empty">Use Tracks to add After the Rain audio and cover. Use Notes only for real listener quotes.</p>`)}
  `;
}

function addForm(fields, onSave) {
  const f = document.createElement("form");
  fields.forEach(([name, label, type]) => {
    const box = document.createElement("div");
    box.className = "field";
    const lab = document.createElement("label");
    lab.textContent = label;
    const input = type === "textarea" ? document.createElement("textarea") : document.createElement("input");
    input.name = name;
    box.appendChild(lab);
    box.appendChild(input);
    f.appendChild(box);
  });
  const file = document.createElement("input");
  file.type = "file";
  file.accept = "image/*,audio/*";
  const fileWrap = document.createElement("div");
  fileWrap.className = "field";
  const fl = document.createElement("label");
  fl.textContent = "Upload cover or audio";
  fileWrap.appendChild(fl);
  fileWrap.appendChild(file);
  f.appendChild(fileWrap);
  const btn = document.createElement("button");
  btn.className = "btn btn--primary";
  btn.textContent = "Save";
  f.appendChild(btn);
  f.onsubmit = async (e) => {
    e.preventDefault();
    const body = {};
    fields.forEach(([name]) => (body[name] = f[name].value));
    if (file.files[0]) {
      try {
        const url = await upload(file.files[0]);
        if (file.files[0].type.startsWith("audio")) body.audio = url;
        else {
          body.cover = url;
          body.image = url;
        }
      } catch (err) {
        toast(err.message, "err");
        return;
      }
    }
    await onSave(body);
    f.reset();
    toast("Saved");
    loadView(currentView);
  };
  return f;
}

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fieldHTML(label, name, value, opts = {}) {
  const required = opts.required ? "required" : "";
  const input = opts.type === "textarea"
    ? `<textarea data-name="${name}" rows="${opts.rows || 3}" ${required}>${esc(value)}</textarea>`
    : `<input type="text" data-name="${name}" value="${esc(value)}" ${required} />`;
  return `<div class="field"><label>${esc(label)}</label>${input}${opts.hint ? `<div class="hint">${esc(opts.hint)}</div>` : ""}</div>`;
}

function fileFieldHTML(label, name, value, accept) {
  const showImage = Boolean(value) && accept.includes("image");
  return `
  <div class="field">
    <label>${esc(label)}</label>
    <input type="text" data-name="${name}" value="${esc(value)}" placeholder="Upload a file or paste a URL" />
    <div class="file-pick">
      <button type="button" class="btn btn--ghost btn--sm" data-upload="${name}">Upload</button>
      <input type="file" data-file="${name}" accept="${accept}" />
      <span class="file-pick__name" data-filename="${name}"></span>
    </div>
    <div class="url-preview" data-urlpreview="${name}">${value ? "Saved: " + esc(value) : ""}</div>
    <img class="preview-img" data-preview="${name}" ${showImage ? `src="${esc(value)}"` : "hidden"} />
  </div>`;
}

function collectForm(root) {
  const body = {};
  root.querySelectorAll("[data-name]").forEach((el) => {
    body[el.dataset.name] = el.value;
  });
  return body;
}

function closeModal() {
  const m = $("#modal");
  if (m) m.hidden = true;
}

function openModal(title, html) {
  $("#modalTitle").textContent = title;
  $("#modalBody").innerHTML = html;
  $("#modal").hidden = false;
  $("#modal").querySelectorAll("[data-close]").forEach((el) => {
    el.onclick = closeModal;
  });
  wireUploads($("#modalBody"));
}

function wireUploads(root) {
  root.querySelectorAll("[data-upload]").forEach((btn) => {
    btn.onclick = () => root.querySelector(`[data-file="${btn.dataset.upload}"]`).click();
  });
  root.querySelectorAll("[data-file]").forEach((input) => {
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      const name = input.dataset.file;
      const label = root.querySelector(`[data-filename="${name}"]`);
      if (label) label.textContent = "Uploading…";
      try {
        const url = await upload(file);
        const urlInput = root.querySelector(`[data-name="${name}"]`);
        if (urlInput) urlInput.value = url;
        const prev = root.querySelector(`[data-urlpreview="${name}"]`);
        if (prev) prev.textContent = "Saved: " + url;
        const img = root.querySelector(`[data-preview="${name}"]`);
        if (img && file.type.startsWith("image")) {
          img.src = url;
          img.hidden = false;
        }
        if (label) label.textContent = file.name;
        toast("Uploaded");
      } catch (err) {
        if (label) label.textContent = "";
        toast(err.message, "err");
      }
    };
  });
}

function trackForm(s = {}) {
  return `
    <div class="field-row">
      ${fieldHTML("Title *", "title", s.title, { required: true })}
      ${fieldHTML("Artist", "artist", s.artist || "Morgan Benjamin")}
    </div>
    <div class="field-row">
      ${fieldHTML("Genre", "genre", s.genre)}
      ${fieldHTML("Release Date", "release_date", s.release_date, { hint: "e.g. 2026" })}
    </div>
    ${fieldHTML("Description", "description", s.description, { type: "textarea" })}
    ${fileFieldHTML("Cover Artwork", "cover", s.cover || "", "image/*")}
    ${fileFieldHTML("Audio File (.mp3)", "audio", s.audio || "", "audio/*")}
    ${fieldHTML("YouTube ID (for Listen button)", "youtube_id", s.youtube_id, { hint: "The video ID, e.g. dQw4w9WgXcQ" })}
    <div class="field-row">
      ${fieldHTML("Spotify Link", "spotify", s.spotify)}
      ${fieldHTML("Apple Music Link", "apple", s.apple)}
    </div>
    <div class="field-row">
      ${fieldHTML("YouTube Link", "youtube", s.youtube)}
      ${fieldHTML("Audiomack Link", "audiomack", s.audiomack)}
    </div>`;
}

function packTrackLinks(body) {
  const urls = [body.spotify, body.apple, body.youtube, body.audiomack].filter(Boolean);
  if (body.youtube_id && !body.youtube) urls.push("https://www.youtube.com/watch?v=" + body.youtube_id);
  body.links = urls.join(" ");
  body.role = body.artist || "Morgan Benjamin";
  return body;
}

async function openTrackForm(id) {
  let data = {};
  if (id) {
    const all = await api("/api/admin/tracks");
    data = all.find((x) => String(x.id) === String(id)) || {};
  }
  openModal(id ? "Edit" : "Add New", `
    <form id="entityForm">${trackForm(data)}</form>
    <button class="btn btn--primary btn--block" id="saveBtn" type="button" style="margin-top:8px">Save</button>`);
  $("#saveBtn").onclick = async () => {
    const body = packTrackLinks(collectForm($("#entityForm")));
    if (!String(body.title || "").trim()) {
      toast("Enter a title", "err");
      return;
    }
    try {
      if (id) await api("/api/admin/tracks/" + id, { method: "PATCH", body: JSON.stringify(body) });
      else await api("/api/admin/tracks", { method: "POST", body: JSON.stringify(body) });
      closeModal();
      toast("Saved");
      loadView("tracks");
    } catch (e) {
      toast(e.message, "err");
    }
  };
}

async function renderTracks(c) {
  const rows = await api("/api/admin/tracks");
  c.innerHTML = `
    <div class="panel">
      <div class="panel__head">
        <h3>All tracks (${rows.length})</h3>
        <button type="button" class="btn btn--primary" id="addTrack">+ Add track</button>
      </div>
      <div class="panel__body" id="trackList"></div>
    </div>`;
  $("#addTrack").onclick = () => openTrackForm();
  const body = $("#trackList");
  if (!rows.length) body.innerHTML = `<p class="empty">None yet.</p>`;
  rows.forEach((r) => {
    const wrap = document.createElement("div");
    wrap.className = "list-row";
    wrap.innerHTML = `<div class="list-row__main"><div class="list-row__title"></div><div class="list-row__sub"></div></div><div class="list-row__actions"><button type="button" class="btn btn--ghost btn--sm">Edit</button><button type="button" class="btn btn--danger btn--sm">Delete</button></div>`;
    wrap.querySelector(".list-row__title").textContent = r.title;
    wrap.querySelector(".list-row__sub").textContent = [r.artist || "Morgan Benjamin", r.genre, r.release_date].filter(Boolean).join(" · ");
    wrap.querySelector(".btn--ghost").onclick = () => openTrackForm(r.id);
    wrap.querySelector(".btn--danger").onclick = async () => {
      if (!confirm("Delete this?")) return;
      await api("/api/admin/tracks/" + r.id, { method: "DELETE" });
      loadView("tracks");
    };
    body.appendChild(wrap);
  });
}

async function renderWorks(c) {
  c.innerHTML = panel("Add work", "");
  c.querySelector(".panel__body").appendChild(
    addForm(
      [
        ["title", "Title"],
        ["category", "Category"],
        ["description", "Note", "textarea"],
        ["audio", "Audio URL optional"],
        ["image", "Image URL optional"],
      ],
      (body) => api("/api/admin/works", { method: "POST", body: JSON.stringify(body) })
    )
  );
  const rows = await api("/api/admin/works");
  const list = document.createElement("section");
  list.className = "panel";
  list.innerHTML = `<div class="panel__head"><h3>Work</h3></div><div class="panel__body"></div>`;
  const body = list.querySelector(".panel__body");
  if (!rows.length) body.innerHTML = `<p class="empty">None yet.</p>`;
  rows.forEach((r) => body.appendChild(row(r.title, r.category, r.id, "works")));
  c.appendChild(list);
}

async function renderNotes(c) {
  c.innerHTML = panel("Add a real listener note", "");
  c.querySelector(".panel__body").appendChild(
    addForm(
      [
        ["quote", "What they said", "textarea"],
        ["name", "Name"],
        ["role", "Fan / city / optional"],
        ["image", "Photo URL optional"],
      ],
      (body) => api("/api/admin/testimonials", { method: "POST", body: JSON.stringify(body) })
    )
  );
  const rows = await api("/api/admin/testimonials");
  const list = document.createElement("section");
  list.className = "panel";
  list.innerHTML = `<div class="panel__head"><h3>Notes</h3></div><div class="panel__body"></div>`;
  const body = list.querySelector(".panel__body");
  if (!rows.length) body.innerHTML = `<p class="empty">Real notes show here when added. No fake quotes.</p>`;
  rows.forEach((r) => body.appendChild(row(r.name || "Note", (r.quote || "").slice(0, 80), r.id, "testimonials")));
  c.appendChild(list);
}

async function renderEnquiries(c) {
  const rows = await api("/api/admin/enquiries");
  const unread = rows.filter((e) => e.status !== "read").length;
  const badge = $("#enqBadge");
  if (unread) {
    badge.hidden = false;
    badge.textContent = String(unread);
  } else badge.hidden = true;
  const list = document.createElement("section");
  list.className = "panel";
  list.innerHTML = `<div class="panel__head"><h3>Messages</h3></div><div class="panel__body"></div>`;
  const body = list.querySelector(".panel__body");
  if (!rows.length) body.innerHTML = `<p class="empty">None yet.</p>`;
  rows.forEach((r) => {
    const d = document.createElement("div");
    d.className = "enquiry";
    d.innerHTML = `<div class="enquiry__meta"></div><div class="enquiry__msg"></div><div class="list-row__actions" style="margin-top:10px"><button type="button" class="btn btn--danger btn--sm">Delete</button></div>`;
    d.querySelector(".enquiry__meta").textContent = [r.name, r.email, r.phone, r.service, r.subject].filter(Boolean).join(" · ");
    d.querySelector(".enquiry__msg").textContent = r.message || "";
    d.querySelector("button").onclick = async () => {
      await api("/api/admin/enquiries/" + r.id, { method: "DELETE" });
      loadView("enquiries");
    };
    body.appendChild(d);
  });
  c.appendChild(list);
}

async function renderSettings(c) {
  const s = await api("/api/admin/settings");
  const about = s.about || {};
  const social = s.social || {};
  const box = document.createElement("section");
  box.className = "panel";
  box.innerHTML = `<div class="panel__head"><h3>Settings</h3></div><div class="panel__body"></div>`;
  const f = document.createElement("form");
  f.innerHTML = `
    <div class="field"><label>One line</label><input name="line" /></div>
    <div class="field"><label>About</label><textarea name="text"></textarea></div>
    <div class="field"><label>Instagram URL</label><input name="instagram" /></div>
    <div class="field"><label>Spotify URL</label><input name="spotify" /></div>
    <div class="field"><label>YouTube URL</label><input name="youtube" /></div>
    <button class="btn btn--primary" type="submit">Save</button>
  `;
  f.line.value = about.line || "";
  f.text.value = about.text || "";
  f.instagram.value = social.instagram || "";
  f.spotify.value = social.spotify || "";
  f.youtube.value = social.youtube || "";
  f.onsubmit = async (e) => {
    e.preventDefault();
    await api("/api/admin/settings", {
      method: "POST",
      body: JSON.stringify({
        key: "about",
        value: { photo: about.photo || "/assets/studio.png", line: f.line.value, text: f.text.value },
      }),
    });
    await api("/api/admin/settings", {
      method: "POST",
      body: JSON.stringify({
        key: "social",
        value: { instagram: f.instagram.value, spotify: f.spotify.value, youtube: f.youtube.value, apple: social.apple || "" },
      }),
    });
    toast("Saved");
  };
  box.querySelector(".panel__body").appendChild(f);
  c.appendChild(box);
}

api("/api/admin/check").then((d) => {
  if (d.authenticated) showApp(true);
}).catch(() => {});
