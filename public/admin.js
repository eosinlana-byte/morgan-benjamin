const $ = (id) => document.getElementById(id);

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

function field(name, placeholder, value = "") {
  const i = document.createElement("input");
  i.name = name;
  i.placeholder = placeholder;
  i.value = value || "";
  return i;
}

$("go").onclick = async () => {
  $("lerr").textContent = "";
  try {
    await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ user: $("user").value, password: $("pass").value }),
    });
    openDash();
  } catch (e) {
    $("lerr").textContent = e.message;
  }
};

$("out").onclick = async () => {
  await api("/api/admin/logout", { method: "POST" });
  location.reload();
};

document.querySelectorAll("header nav button").forEach((b) => {
  b.onclick = () => {
    document.querySelectorAll(".tab").forEach((t) => (t.hidden = t.id !== b.dataset.tab));
  };
});

async function openDash() {
  $("login").hidden = true;
  $("dash").hidden = false;
  await Promise.all([loadTracks(), loadWorks(), loadNotes(), loadEnquiries(), loadSettings()]);
}

function formFrom(fields, onSave) {
  const wrap = document.createElement("form");
  wrap.className = "form";
  const inputs = {};
  fields.forEach(([name, ph]) => {
    const i = name === "description" || name === "text" ? document.createElement("textarea") : field(name, ph);
    if (i.tagName === "TEXTAREA") {
      i.name = name;
      i.placeholder = ph;
    }
    wrap.appendChild(i);
    inputs[name] = i;
  });
  const file = document.createElement("input");
  file.type = "file";
  file.accept = "image/*,audio/*";
  wrap.appendChild(file);
  const btn = document.createElement("button");
  btn.textContent = "Save";
  wrap.appendChild(btn);
  wrap.onsubmit = async (e) => {
    e.preventDefault();
    const body = {};
    Object.keys(inputs).forEach((k) => (body[k] = inputs[k].value));
    if (file.files[0]) {
      const url = await upload(file.files[0]);
      if (file.files[0].type.startsWith("audio")) body.audio = url;
      else {
        body.cover = url;
        body.image = url;
      }
    }
    await onSave(body);
    wrap.reset();
  };
  return wrap;
}

async function loadTracks() {
  const box = $("tracks");
  box.innerHTML = "<h2>Tracks</h2>";
  box.appendChild(
    formFrom(
      [
        ["title", "Title"],
        ["genre", "Genre: pop, rock, rap, indie, edm"],
        ["role", "Role: vocals, production…"],
        ["description", "Note"],
        ["audio", "Audio URL if not uploading"],
        ["cover", "Cover URL if not uploading"],
        ["links", "Spotify / YouTube link"],
      ],
      async (body) => {
        await api("/api/admin/tracks", { method: "POST", body: JSON.stringify(body) });
        loadTracks();
      }
    )
  );
  const rows = await api("/api/admin/tracks");
  rows.forEach((r) => {
    const d = document.createElement("div");
    d.className = "row";
    d.innerHTML = "<b></b> · <span></span> ";
    d.querySelector("b").textContent = r.title;
    d.querySelector("span").textContent = r.genre || "";
    const del = document.createElement("button");
    del.textContent = "Delete";
    del.onclick = async () => {
      await api("/api/admin/tracks/" + r.id, { method: "DELETE" });
      loadTracks();
    };
    d.appendChild(del);
    box.appendChild(d);
  });
}

async function loadWorks() {
  const box = $("works");
  box.innerHTML = "<h2>Work</h2>";
  box.appendChild(
    formFrom(
      [
        ["title", "Title"],
        ["category", "lyrics / vocals / production / mix / intro"],
        ["description", "Note"],
        ["audio", "Audio URL optional"],
        ["image", "Image URL optional"],
      ],
      async (body) => {
        await api("/api/admin/works", { method: "POST", body: JSON.stringify(body) });
        loadWorks();
      }
    )
  );
  const rows = await api("/api/admin/works");
  rows.forEach((r) => {
    const d = document.createElement("div");
    d.className = "row";
    d.textContent = r.title + " · " + r.category + " ";
    const del = document.createElement("button");
    del.textContent = "Delete";
    del.onclick = async () => {
      await api("/api/admin/works/" + r.id, { method: "DELETE" });
      loadWorks();
    };
    d.appendChild(del);
    box.appendChild(d);
  });
}

async function loadNotes() {
  const box = $("notes");
  box.innerHTML = "<h2>Listener notes</h2>";
  box.appendChild(
    formFrom(
      [
        ["quote", "What they said"],
        ["name", "Name"],
        ["role", "Fan / city / optional"],
        ["image", "Photo URL optional"],
      ],
      async (body) => {
        await api("/api/admin/testimonials", { method: "POST", body: JSON.stringify(body) });
        loadNotes();
      }
    )
  );
  const rows = await api("/api/admin/testimonials");
  rows.forEach((r) => {
    const d = document.createElement("div");
    d.className = "row";
    d.textContent = (r.name || "Note") + " - " + (r.quote || "").slice(0, 80) + " ";
    const del = document.createElement("button");
    del.textContent = "Delete";
    del.onclick = async () => {
      await api("/api/admin/testimonials/" + r.id, { method: "DELETE" });
      loadNotes();
    };
    d.appendChild(del);
    box.appendChild(d);
  });
}

async function loadEnquiries() {
  const box = $("enquiries");
  box.innerHTML = "<h2>Messages</h2>";
  const rows = await api("/api/admin/enquiries");
  if (!rows.length) box.appendChild(Object.assign(document.createElement("p"), { textContent: "None yet." }));
  rows.forEach((r) => {
    const d = document.createElement("div");
    d.className = "row";
    d.innerHTML = "<p></p><p></p><p></p>";
    d.children[0].textContent = r.name + " · " + r.email;
    d.children[1].textContent = [r.phone, r.service, r.subject].filter(Boolean).join(" · ");
    d.children[2].textContent = r.message;
    const del = document.createElement("button");
    del.textContent = "Delete";
    del.onclick = async () => {
      await api("/api/admin/enquiries/" + r.id, { method: "DELETE" });
      loadEnquiries();
    };
    d.appendChild(del);
    box.appendChild(d);
  });
}

async function loadSettings() {
  const box = $("settings");
  box.innerHTML = "<h2>Settings</h2>";
  const s = await api("/api/admin/settings");
  const about = s.about || {};
  const social = s.social || {};
  const f = document.createElement("form");
  f.className = "form";
  f.innerHTML = `
    <input name="line" placeholder="One line under the logo" />
    <textarea name="text" placeholder="About. Only what he actually said."></textarea>
    <input name="instagram" placeholder="Instagram URL" />
    <input name="spotify" placeholder="Spotify URL" />
    <input name="youtube" placeholder="YouTube URL" />
    <button>Save</button>
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
    alert("Saved");
  };
  box.appendChild(f);
}

api("/api/admin/check").then((d) => {
  if (d.authenticated) openDash();
});
