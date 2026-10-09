function el(html) {
  const d = document.createElement("div");
  d.innerHTML = html.trim();
  return d.firstChild;
}

const nav = document.getElementById("nav");
window.addEventListener("scroll", () => {
  if (nav) nav.classList.toggle("on", window.scrollY > 16);
});

const featAudio = document.getElementById("featAudio");
const featPlay = document.getElementById("featPlay");
const dock = document.getElementById("dock");
const dockPlay = document.getElementById("dockPlay");
const dockTitle = document.getElementById("dockTitle");

function setPlayIcons(playing) {
  const mark = playing ? "❚❚" : "▶";
  if (featPlay) featPlay.textContent = mark;
  if (dockPlay) dockPlay.textContent = mark;
}

function toggleAudio() {
  if (!featAudio || !featAudio.src) return;
  if (featAudio.paused) {
    featAudio.play();
    if (dock) dock.classList.add("on");
  } else featAudio.pause();
}

if (featPlay) featPlay.onclick = toggleAudio;
if (dockPlay) dockPlay.onclick = toggleAudio;
if (featAudio) {
  featAudio.addEventListener("play", () => setPlayIcons(true));
  featAudio.addEventListener("pause", () => setPlayIcons(false));
}

fetch("/api/content")
  .then((r) => r.json())
  .then((data) => {
    const social = (data.settings && data.settings.social) || {};
    const about = (data.settings && data.settings.about) || {};
    if (about.photo) {
      const pic = document.getElementById("aboutPhoto");
      if (pic) pic.style.backgroundImage = "url(" + about.photo + ")";
    }

    const tracks = data.tracks || [];
    const featured = tracks.find((t) => /after the rain/i.test(t.title)) || tracks[0];
    const featTitle = document.getElementById("featTitle");
    const featDesc = document.getElementById("featDesc");
    const featCover = document.getElementById("featCover");
    const featLinks = document.getElementById("featLinks");

    if (featured) {
      if (featTitle) featTitle.textContent = featured.title;
      if (dockTitle) dockTitle.textContent = featured.title;
      if (featured.description && featDesc) featDesc.textContent = featured.description;
      if (featured.cover && featCover) {
        featCover.innerHTML = "";
        const img = document.createElement("img");
        img.src = featured.cover;
        img.alt = featured.title;
        featCover.appendChild(img);
      }
      if (featured.audio && featAudio) {
        featAudio.src = featured.audio;
      }
      if (featLinks) {
        const addLink = (url, label) => {
          if (!url) return;
          const a = document.createElement("a");
          a.href = url;
          a.target = "_blank";
          a.rel = "noopener";
          a.textContent = label;
          featLinks.appendChild(a);
        };
        if (featured.youtube_id) addLink("https://www.youtube.com/watch?v=" + featured.youtube_id, "Listen");
        addLink(featured.spotify, "Spotify");
        addLink(featured.apple, "Apple");
        addLink(featured.youtube, "YouTube");
        addLink(featured.audiomack, "Audiomack");
        if (!featLinks.children.length && featured.links) {
          featured.links.split(/\s+/).filter(Boolean).forEach((url) => addLink(url, "Listen"));
        }
      }
    }

    const rest = featured ? tracks.filter((t) => t.id !== featured.id) : tracks;
    const tracksBox = document.getElementById("tracks");
    const tracksEmpty = document.getElementById("tracksEmpty");

    function matchStyle(value, cat) {
      const g = String(value || "").toLowerCase();
      if (cat === "all") return true;
      return g === cat || g.split(/[\s,/]+/).includes(cat);
    }

    function trackCard(t) {
      const card = el("<article class='card'></article>");
      if (t.cover) {
        const img = document.createElement("img");
        img.src = t.cover;
        img.alt = t.title;
        card.appendChild(img);
      }
      const h = document.createElement("h3");
      h.textContent = t.title;
      card.appendChild(h);
      if (t.genre) {
        const p = document.createElement("p");
        p.textContent = t.genre;
        card.appendChild(p);
      }
      if (t.audio) {
        const a = document.createElement("audio");
        a.controls = true;
        a.preload = "none";
        a.src = t.audio;
        card.appendChild(a);
      }
      return card;
    }

    function draw(cat) {
      if (!tracksBox) return;
      tracksBox.innerHTML = "";
      const list = rest.filter((t) => matchStyle(t.genre, cat));
      list.forEach((t) => tracksBox.appendChild(trackCard(t)));
      if (tracksEmpty) tracksEmpty.style.display = list.length ? "none" : "block";
    }
    draw("all");
    document.querySelectorAll("#filters button").forEach((btn) => {
      btn.onclick = () => {
        document.querySelectorAll("#filters button").forEach((b) => b.classList.remove("on"));
        btn.classList.add("on");
        draw(btn.dataset.cat);
      };
    });

    const folio = data.works || [];
    const fBox = document.getElementById("folio");
    const fEmpty = document.getElementById("folioEmpty");
    if (fEmpty) fEmpty.style.display = folio.length ? "none" : "block";
    folio.forEach((item) => {
      if (!fBox) return;
      const card = el("<article class='card'></article>");
      const kind = (item.category || "image").toLowerCase();
      if (kind !== "text" && item.image) {
        const img = document.createElement("img");
        img.src = item.image;
        img.alt = item.title || "";
        card.appendChild(img);
      }
      if (item.title) {
        const h = document.createElement("h3");
        h.textContent = item.title;
        card.appendChild(h);
      }
      if (kind === "text" && item.description) {
        const p = document.createElement("p");
        p.textContent = item.description;
        card.appendChild(p);
      }
      fBox.appendChild(card);
    });

    ["socials", "socialsFoot"].forEach((id) => {
      const box = document.getElementById(id);
      if (!box) return;
      ["instagram", "spotify", "youtube", "apple"].forEach((k) => {
        if (social[k]) {
          const a = document.createElement("a");
          a.href = social[k];
          a.target = "_blank";
          a.rel = "noopener";
          a.textContent = k;
          a.style.marginRight = "14px";
          box.appendChild(a);
        }
      });
    });
  })
  .catch(() => {});

const DIALS = [
  ["Afghanistan", "+93"],
  ["Aland Islands", "+358"],
  ["Albania", "+355"],
  ["Algeria", "+213"],
  ["American Samoa", "+1684"],
  ["Andorra", "+376"],
  ["Angola", "+244"],
  ["Anguilla", "+1264"],
  ["Antarctica", "+672"],
  ["Antigua and Barbuda", "+1268"],
  ["Argentina", "+54"],
  ["Armenia", "+374"],
  ["Aruba", "+297"],
  ["Australia", "+61"],
  ["Austria", "+43"],
  ["Azerbaijan", "+994"],
  ["Bahamas", "+1242"],
  ["Bahrain", "+973"],
  ["Bangladesh", "+880"],
  ["Barbados", "+1246"],
  ["Belarus", "+375"],
  ["Belgium", "+32"],
  ["Belize", "+501"],
  ["Benin", "+229"],
  ["Bermuda", "+1441"],
  ["Bhutan", "+975"],
  ["Bolivia", "+591"],
  ["Bosnia and Herzegovina", "+387"],
  ["Botswana", "+267"],
  ["Bouvet Island", "+47"],
  ["Brazil", "+55"],
  ["British Indian Ocean Territory", "+246"],
  ["British Virgin Islands", "+1284"],
  ["Brunei", "+673"],
  ["Bulgaria", "+359"],
  ["Burkina Faso", "+226"],
  ["Burundi", "+257"],
  ["Cambodia", "+855"],
  ["Cameroon", "+237"],
  ["Canada", "+1"],
  ["Cape Verde", "+238"],
  ["Caribbean Netherlands", "+599"],
  ["Cayman Islands", "+1345"],
  ["Central African Republic", "+236"],
  ["Chad", "+235"],
  ["Chile", "+56"],
  ["China", "+86"],
  ["Christmas Island", "+61"],
  ["Cocos (Keeling) Islands", "+61"],
  ["Colombia", "+57"],
  ["Comoros", "+269"],
  ["Congo (DRC)", "+243"],
  ["Congo (Republic)", "+242"],
  ["Cook Islands", "+682"],
  ["Costa Rica", "+506"],
  ["Cote d'Ivoire", "+225"],
  ["Croatia", "+385"],
  ["Cuba", "+53"],
  ["Curacao", "+599"],
  ["Cyprus", "+357"],
  ["Czech Republic", "+420"],
  ["Denmark", "+45"],
  ["Djibouti", "+253"],
  ["Dominica", "+1767"],
  ["Dominican Republic", "+1"],
  ["Ecuador", "+593"],
  ["Egypt", "+20"],
  ["El Salvador", "+503"],
  ["Equatorial Guinea", "+240"],
  ["Eritrea", "+291"],
  ["Estonia", "+372"],
  ["Ethiopia", "+251"],
  ["Falkland Islands", "+500"],
  ["Faroe Islands", "+298"],
  ["Fiji", "+679"],
  ["Finland", "+358"],
  ["France", "+33"],
  ["French Guiana", "+594"],
  ["French Polynesia", "+689"],
  ["French Southern and Antarctic Lands", "+262"],
  ["Gabon", "+241"],
  ["Gambia", "+220"],
  ["Georgia", "+995"],
  ["Germany", "+49"],
  ["Ghana", "+233"],
  ["Gibraltar", "+350"],
  ["Greece", "+30"],
  ["Greenland", "+299"],
  ["Grenada", "+1473"],
  ["Guadeloupe", "+590"],
  ["Guam", "+1671"],
  ["Guatemala", "+502"],
  ["Guernsey", "+44"],
  ["Guinea", "+224"],
  ["Guinea-Bissau", "+245"],
  ["Guyana", "+592"],
  ["Haiti", "+509"],
  ["Heard Island and McDonald Islands", "+672"],
  ["Honduras", "+504"],
  ["Hong Kong", "+852"],
  ["Hungary", "+36"],
  ["Iceland", "+354"],
  ["India", "+91"],
  ["Indonesia", "+62"],
  ["Iran", "+98"],
  ["Iraq", "+964"],
  ["Ireland", "+353"],
  ["Isle of Man", "+44"],
  ["Israel", "+972"],
  ["Italy", "+39"],
  ["Jamaica", "+1876"],
  ["Japan", "+81"],
  ["Jersey", "+44"],
  ["Jordan", "+962"],
  ["Kazakhstan", "+7"],
  ["Kenya", "+254"],
  ["Kiribati", "+686"],
  ["Kosovo", "+383"],
  ["Kuwait", "+965"],
  ["Kyrgyzstan", "+996"],
  ["Laos", "+856"],
  ["Latvia", "+371"],
  ["Lebanon", "+961"],
  ["Lesotho", "+266"],
  ["Liberia", "+231"],
  ["Libya", "+218"],
  ["Liechtenstein", "+423"],
  ["Lithuania", "+370"],
  ["Luxembourg", "+352"],
  ["Macau", "+853"],
  ["Macedonia (FYROM)", "+389"],
  ["Madagascar", "+261"],
  ["Malawi", "+265"],
  ["Malaysia", "+60"],
  ["Maldives", "+960"],
  ["Mali", "+223"],
  ["Malta", "+356"],
  ["Marshall Islands", "+692"],
  ["Martinique", "+596"],
  ["Mauritania", "+222"],
  ["Mauritius", "+230"],
  ["Mayotte", "+262"],
  ["Mexico", "+52"],
  ["Micronesia", "+691"],
  ["Moldova", "+373"],
  ["Monaco", "+377"],
  ["Mongolia", "+976"],
  ["Montenegro", "+382"],
  ["Montserrat", "+1664"],
  ["Morocco", "+212"],
  ["Mozambique", "+258"],
  ["Myanmar (Burma)", "+95"],
  ["Namibia", "+264"],
  ["Nauru", "+674"],
  ["Nepal", "+977"],
  ["Netherlands", "+31"],
  ["New Caledonia", "+687"],
  ["New Zealand", "+64"],
  ["Nicaragua", "+505"],
  ["Niger", "+227"],
  ["Nigeria", "+234"],
  ["Niue", "+683"],
  ["Norfolk Island", "+672"],
  ["North Korea", "+850"],
  ["Northern Mariana Islands", "+1670"],
  ["Norway", "+47"],
  ["Oman", "+968"],
  ["Pakistan", "+92"],
  ["Palau", "+680"],
  ["Palestine", "+970"],
  ["Panama", "+507"],
  ["Papua New Guinea", "+675"],
  ["Paraguay", "+595"],
  ["Peru", "+51"],
  ["Philippines", "+63"],
  ["Pitcairn Islands", "+64"],
  ["Poland", "+48"],
  ["Portugal", "+351"],
  ["Puerto Rico", "+1"],
  ["Qatar", "+974"],
  ["Reunion", "+262"],
  ["Romania", "+40"],
  ["Russia", "+7"],
  ["Rwanda", "+250"],
  ["Saint Barthelemy", "+590"],
  ["Saint Helena", "+290"],
  ["Saint Kitts and Nevis", "+1869"],
  ["Saint Lucia", "+1758"],
  ["Saint Martin", "+590"],
  ["Saint Pierre and Miquelon", "+508"],
  ["Saint Vincent and the Grenadines", "+1784"],
  ["Samoa", "+685"],
  ["San Marino", "+378"],
  ["Sao Tome and Principe", "+239"],
  ["Saudi Arabia", "+966"],
  ["Senegal", "+221"],
  ["Serbia", "+381"],
  ["Seychelles", "+248"],
  ["Sierra Leone", "+232"],
  ["Singapore", "+65"],
  ["Sint Maarten", "+1721"],
  ["Slovakia", "+421"],
  ["Slovenia", "+386"],
  ["Solomon Islands", "+677"],
  ["Somalia", "+252"],
  ["South Africa", "+27"],
  ["South Georgia and the South Sandwich Islands", "+500"],
  ["South Korea", "+82"],
  ["South Sudan", "+211"],
  ["Spain", "+34"],
  ["Sri Lanka", "+94"],
  ["Sudan", "+249"],
  ["Suriname", "+597"],
  ["Svalbard and Jan Mayen", "+47"],
  ["Swaziland", "+268"],
  ["Sweden", "+46"],
  ["Switzerland", "+41"],
  ["Syria", "+963"],
  ["Taiwan", "+886"],
  ["Tajikistan", "+992"],
  ["Tanzania", "+255"],
  ["Thailand", "+66"],
  ["Timor-Leste", "+670"],
  ["Togo", "+228"],
  ["Tokelau", "+690"],
  ["Tonga", "+676"],
  ["Trinidad and Tobago", "+1868"],
  ["Tunisia", "+216"],
  ["Turkey", "+90"],
  ["Turkmenistan", "+993"],
  ["Turks and Caicos Islands", "+1649"],
  ["Tuvalu", "+688"],
  ["U.S. Virgin Islands", "+1340"],
  ["Uganda", "+256"],
  ["Ukraine", "+380"],
  ["United Arab Emirates", "+971"],
  ["United Kingdom", "+44"],
  ["United States", "+1"],
  ["United States Minor Outlying Islands", "+1"],
  ["Uruguay", "+598"],
  ["Uzbekistan", "+998"],
  ["Vanuatu", "+678"],
  ["Vatican City", "+39"],
  ["Venezuela", "+58"],
  ["Vietnam", "+84"],
  ["Wallis and Futuna", "+681"],
  ["Western Sahara", "+212"],
  ["Yemen", "+967"],
  ["Zambia", "+260"],
  ["Zimbabwe", "+263"],
];

(function fillDials() {
  const sel = document.getElementById("cdial");
  if (!sel) return;
  DIALS.forEach(([name, code]) => {
    const o = document.createElement("option");
    o.value = code;
    o.textContent = name + " (" + code + ")";
    if (name === "United States") {
      o.selected = true;
      o.defaultSelected = true;
    }
    sel.appendChild(o);
  });
})();

function showEnquiryReceived() {
  const form = document.getElementById("cform");
  if (form) form.classList.add("done");
  const contact = document.getElementById("contact");
  if (contact) contact.scrollIntoView({ behavior: "smooth", block: "start" });
}

if (new URLSearchParams(location.search).get("sent") === "1") {
  showEnquiryReceived();
  if (history.replaceState) history.replaceState({}, "", "/#contact");
}

const form = document.getElementById("cform");
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const msg = document.getElementById("cmsg");
    if (msg) {
      msg.hidden = false;
      msg.textContent = "Sending…";
    }
    const rawPhone = (f.phone.value || "").trim();
    const phone = rawPhone ? ((f.dial && f.dial.value ? f.dial.value + " " : "") + rawPhone) : "";
    const params = new URLSearchParams({
      name: f.name.value,
      email: f.email.value,
      phone,
      service: f.service.value,
      subject: f.subject.value,
      message: f.message.value,
      hp_trap: f.hp_trap ? f.hp_trap.value : "",
    });
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: params,
      });
      const data = await res.json().catch(() => null);
      if (data && data.success) {
        showEnquiryReceived();
        return;
      }
      if (data && data.error) {
        if (msg) msg.textContent = data.error;
        return;
      }
    } catch (_) {}
    f.method = "post";
    f.action = "/api/contact";
    f.submit();
  });
}
