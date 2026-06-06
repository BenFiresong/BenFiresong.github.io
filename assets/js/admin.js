/* ---- Settings ---- */
const OWNER = "BenFiresong";
const REPO = "BenFiresong.github.io";
const BRANCH = "main";
const STORAGE_KEY = "firesong_admin_token";

/* Each editable area maps to one file in the repo. */
const resources = {
  commands: { path: "data/commands.json", label: "commands", sha: null, state: null },
  about:    { path: "data/about.json",    label: "about",    sha: null, state: null },
  schedule: { path: "data/schedule.json", label: "schedule", sha: null, state: null },
  socials:  { path: "data/socials.json",  label: "socials",  sha: null, state: null },
  charity:  { path: "data/charity.json",  label: "charity",  sha: null, state: null }
};

let token = "";
let copyMap = {}; // remembers special "copy" text for placeholder commands

/* ---- UTF-8 safe base64 (so emojis survive) ---- */
function b64DecodeUnicode(str) {
  return decodeURIComponent(
    atob(str.replace(/\s/g, ""))
      .split("")
      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join("")
  );
}
function b64EncodeUnicode(str) {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (m, p1) =>
      String.fromCharCode("0x" + p1)
    )
  );
}

/* ---- Helpers ---- */
function $(id) { return document.getElementById(id); }
function escapeAttr(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function setStatus(msg, type) {
  const el = $("status");
  if (!msg) { el.className = "status hidden"; el.textContent = ""; return; }
  el.className = "status " + (type || "info");
  el.textContent = msg;
}

/* ---- GitHub calls ---- */
async function ghGet(path) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`;
  const res = await fetch(url, {
    headers: { "Authorization": "Bearer " + token, "Accept": "application/vnd.github+json" }
  });
  if (res.status === 401) throw new Error("That token was not accepted. Please check it and try again.");
  if (res.status === 404) throw new Error("Could not find " + path + " in the repo.");
  if (!res.ok) throw new Error("Loading failed (" + res.status + ").");
  const json = await res.json();
  return { sha: json.sha, data: JSON.parse(b64DecodeUnicode(json.content)) };
}

async function ghPut(path, obj, sha, message) {
  const text = JSON.stringify(obj, null, 2) + "\n";
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Authorization": "Bearer " + token, "Accept": "application/vnd.github+json" },
    body: JSON.stringify({ message: message, content: b64EncodeUnicode(text), sha: sha, branch: BRANCH })
  });
  if (res.status === 401) throw new Error("Token not accepted. Please log in again.");
  if (res.status === 409) throw new Error("That file changed since you loaded it. Please refresh and try again.");
  if (!res.ok) throw new Error("Save failed (" + res.status + ").");
  const out = await res.json();
  return out.content.sha;
}

/* ---- Login ---- */
function tryRestoreToken() {
  try { const s = localStorage.getItem(STORAGE_KEY); if (s) { token = s; return true; } } catch (e) {}
  return false;
}
async function login() {
  const input = $("tokenInput").value.trim();
  if (!input) { setStatus("Please paste your token first.", "err"); return; }
  token = input;
  if ($("remember").checked) { try { localStorage.setItem(STORAGE_KEY, token); } catch (e) {} }
  await enterDashboard();
}
function logout() {
  token = "";
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  $("dash").classList.add("hidden");
  $("login").classList.remove("hidden");
  $("tokenInput").value = "";
}

/* ---- Load everything ---- */
async function loadAll() {
  // Commands first so we can build the copy map
  const cmd = await ghGet(resources.commands.path);
  resources.commands.sha = cmd.sha;
  copyMap = {};
  (cmd.data.sections || []).forEach((sec) => (sec.rows || []).forEach((row) =>
    (row.names || []).forEach((n) => {
      if (typeof n === "object" && n.copy !== undefined && n.copy !== n.label) copyMap[n.label] = n.copy;
    })
  ));
  resources.commands.state = {
    sections: (cmd.data.sections || []).map((sec) => ({
      title: sec.title || "", icon: sec.icon || "", badge: sec.badge || "", style: sec.style || "",
      rows: (sec.rows || []).map((row) => ({
        label: row.label || "",
        namesText: (row.names || []).map((n) => (typeof n === "string" ? n : n.label)).join(", "),
        desc: row.desc || ""
      }))
    }))
  };

  const about = await ghGet(resources.about.path);
  resources.about.sha = about.sha;
  resources.about.state = {
    tagline: about.data.tagline || "",
    paragraphs: (about.data.paragraphs || []).slice(),
    pills: (about.data.pills || []).slice()
  };

  const sched = await ghGet(resources.schedule.path);
  resources.schedule.sha = sched.sha;
  resources.schedule.state = {
    days: (sched.data.days || []).map((d) => ({ name: d.name || "", time: d.time || "", game: d.game || "" })),
    note: sched.data.note || ""
  };

  const soc = await ghGet(resources.socials.path);
  resources.socials.sha = soc.sha;
  resources.socials.state = {
    items: (soc.data.items || []).map((it) => ({
      icon: it.icon || "", label: it.label || "", sub: it.sub || "", url: it.url || "",
      wide: !!it.wide, primary: !!it.primary
    }))
  };

  const ch = await ghGet(resources.charity.path);
  resources.charity.sha = ch.sha;
  resources.charity.state = {
    whatWeDo: (ch.data.whatWeDo || []).slice(),
    cause: { name: (ch.data.cause || {}).name || "", desc: (ch.data.cause || {}).desc || "", link: (ch.data.cause || {}).link || "" },
    steps: (ch.data.steps || []).slice()
  };
}

/* ---- Turn state back into JSON ---- */
function buildCommands(s) {
  return {
    sections: s.sections.map((sec) => {
      const out = {};
      if (sec.title) out.title = sec.title;
      if (sec.icon) out.icon = sec.icon;
      if (sec.badge) out.badge = sec.badge;
      if (sec.style) out.style = sec.style;
      out.rows = sec.rows.map((row) => {
        const r = {};
        if (row.label) r.label = row.label;
        r.names = row.namesText.split(",").map((x) => x.trim()).filter((x) => x.length)
          .map((label) => (copyMap[label] ? { label: label, copy: copyMap[label] } : label));
        if (row.desc) r.desc = row.desc;
        return r;
      });
      return out;
    })
  };
}
function buildAbout(s) { return { tagline: s.tagline, paragraphs: s.paragraphs.slice(), pills: s.pills.slice() }; }
function buildSchedule(s) { return { days: s.days.map((d) => ({ name: d.name, time: d.time, game: d.game })), note: s.note }; }
function buildSocials(s) {
  return { items: s.items.map((it) => {
    const o = { icon: it.icon, label: it.label, sub: it.sub, url: it.url };
    if (it.primary) o.primary = true;
    if (it.wide) o.wide = true;
    return o;
  }) };
}
function buildCharity(s) { return { whatWeDo: s.whatWeDo.slice(), cause: { name: s.cause.name, desc: s.cause.desc, link: s.cause.link }, steps: s.steps.slice() }; }

const builders = { commands: buildCommands, about: buildAbout, schedule: buildSchedule, socials: buildSocials, charity: buildCharity };

/* ---- Small HTML builders for the editors ---- */
function topField(res, key, label, value, isArea) {
  const tag = isArea
    ? `<textarea rows="2" data-res="${res}" data-top="${key}">${escapeAttr(value)}</textarea>`
    : `<input type="text" data-res="${res}" data-top="${key}" value="${escapeAttr(value)}">`;
  return `<label class="small-label">${label}</label>${tag}`;
}
function listTextarea(res, list, i, value, label) {
  return `<label class="small-label">${label || ""}</label><textarea rows="2" data-res="${res}" data-list="${list}" data-i="${i}">${escapeAttr(value)}</textarea>`;
}
function listInput(res, list, i, value, label) {
  return `<label class="small-label">${label || ""}</label><input type="text" data-res="${res}" data-list="${list}" data-i="${i}" value="${escapeAttr(value)}">`;
}
function objInput(res, list, i, f, value, label) {
  return `<label class="small-label">${label}</label><input type="text" data-res="${res}" data-list="${list}" data-i="${i}" data-f="${f}" value="${escapeAttr(value)}">`;
}
function checkField(res, list, i, f, label, checked) {
  return `<div class="checkbox-row"><input type="checkbox" data-res="${res}" data-list="${list}" data-i="${i}" data-f="${f}" ${checked ? "checked" : ""}><label style="text-transform:none;color:var(--muted);font-weight:600;margin:0;">${label}</label></div>`;
}
function delItemBtn(res, list, i, label) {
  return `<button class="btn-sm btn-danger" data-act="delItem" data-res="${res}" data-list="${list}" data-i="${i}">${label}</button>`;
}
function addItemBtn(res, list, label) {
  return `<div class="sec-actions"><button class="btn-sm" data-act="addItem" data-res="${res}" data-list="${list}">${label}</button></div>`;
}

/* ---- Renderers ---- */
function renderCommandsEd() {
  const s = resources.commands.state;
  let h = "";
  s.sections.forEach((sec, si) => {
    h += `<div class="sec-card">
      <div class="sec-head">
        <div class="icon-field"><label class="small-label">Icon</label><input type="text" data-res="commands" data-sec="${si}" data-f="icon" value="${escapeAttr(sec.icon)}"></div>
        <div class="title-field"><label class="small-label">Section name</label><input type="text" data-res="commands" data-sec="${si}" data-f="title" value="${escapeAttr(sec.title)}"></div>
      </div>`;
    sec.rows.forEach((row, ri) => {
      h += `<div class="row-item">
        <label class="small-label">Commands (separate with commas)</label>
        <input type="text" data-res="commands" data-sec="${si}" data-row="${ri}" data-f="namesText" value="${escapeAttr(row.namesText)}">
        <label class="small-label">Description (optional)</label>
        <input type="text" data-res="commands" data-sec="${si}" data-row="${ri}" data-f="desc" value="${escapeAttr(row.desc)}">
        <div class="row-actions"><button class="btn-sm btn-danger" data-act="delRow" data-sec="${si}" data-row="${ri}">Remove this line</button></div>
      </div>`;
    });
    h += `<div class="sec-actions">
      <button class="btn-sm" data-act="addRow" data-sec="${si}">Add a command line</button>
      <button class="btn-sm btn-danger" data-act="delSec" data-sec="${si}">Delete this section</button>
    </div></div>`;
  });
  h += `<div class="add-section-wrap"><button class="btn-sm" data-act="addSec">Add a new section</button></div>`;
  $("ed-commands").innerHTML = h;
}

function renderAboutEd() {
  const s = resources.about.state;
  let h = topField("about", "tagline", "Tagline (under your name)", s.tagline);
  h += `<div style="margin-top:12px"></div>`;
  s.paragraphs.forEach((p, i) => {
    h += `<div class="row-item">${listTextarea("about", "paragraphs", i, p, "Paragraph")}<div class="row-actions">${delItemBtn("about", "paragraphs", i, "Remove paragraph")}</div></div>`;
  });
  h += addItemBtn("about", "paragraphs", "Add a paragraph");
  h += `<div style="margin-top:14px"></div>`;
  s.pills.forEach((p, i) => {
    h += `<div class="row-item">${listInput("about", "pills", i, p, "Pill (little tag)")}<div class="row-actions">${delItemBtn("about", "pills", i, "Remove pill")}</div></div>`;
  });
  h += addItemBtn("about", "pills", "Add a pill");
  $("ed-about").innerHTML = h;
}

function renderScheduleEd() {
  const s = resources.schedule.state;
  let h = "";
  s.days.forEach((d, i) => {
    h += `<div class="row-item">
      ${objInput("schedule", "days", i, "name", d.name, "Day")}
      ${objInput("schedule", "days", i, "time", d.time, "Time")}
      ${objInput("schedule", "days", i, "game", d.game, "What you play")}
      <div class="row-actions">${delItemBtn("schedule", "days", i, "Remove day")}</div>
    </div>`;
  });
  h += addItemBtn("schedule", "days", "Add a day");
  h += `<div style="margin-top:14px"></div>` + topField("schedule", "note", "Note under the schedule", s.note, true);
  $("ed-schedule").innerHTML = h;
}

function renderSocialsEd() {
  const s = resources.socials.state;
  let h = "";
  s.items.forEach((it, i) => {
    h += `<div class="row-item">
      ${objInput("socials", "items", i, "icon", it.icon, "Icon (emoji)")}
      ${objInput("socials", "items", i, "label", it.label, "Name")}
      ${objInput("socials", "items", i, "sub", it.sub, "Little description")}
      ${objInput("socials", "items", i, "url", it.url, "Link")}
      ${checkField("socials", "items", i, "wide", "Full width", it.wide)}
      ${checkField("socials", "items", i, "primary", "Highlighted", it.primary)}
      <div class="row-actions">${delItemBtn("socials", "items", i, "Remove link")}</div>
    </div>`;
  });
  h += addItemBtn("socials", "items", "Add a link");
  $("ed-socials").innerHTML = h;
}

function renderCharityEd() {
  const s = resources.charity.state;
  let h = `<label class="small-label">What we do</label>`;
  s.whatWeDo.forEach((p, i) => {
    h += `<div class="row-item">${listTextarea("charity", "whatWeDo", i, p, "Paragraph")}<div class="row-actions">${delItemBtn("charity", "whatWeDo", i, "Remove paragraph")}</div></div>`;
  });
  h += addItemBtn("charity", "whatWeDo", "Add a paragraph");
  h += `<div class="row-item" style="margin-top:14px">
    <label class="small-label">Current cause</label>
    <input type="text" data-res="charity" data-cause="name" value="${escapeAttr(s.cause.name)}" placeholder="Cause name">
    <textarea rows="2" data-res="charity" data-cause="desc" placeholder="Short description">${escapeAttr(s.cause.desc)}</textarea>
    <input type="text" data-res="charity" data-cause="link" value="${escapeAttr(s.cause.link)}" placeholder="Donate link">
  </div>`;
  h += `<label class="small-label" style="margin-top:8px;display:block">How it works (steps)</label>`;
  s.steps.forEach((p, i) => {
    h += `<div class="row-item">${listTextarea("charity", "steps", i, p, "Step")}<div class="row-actions">${delItemBtn("charity", "steps", i, "Remove step")}</div></div>`;
  });
  h += addItemBtn("charity", "steps", "Add a step");
  $("ed-charity").innerHTML = h;
}

const renderers = {
  commands: renderCommandsEd, about: renderAboutEd, schedule: renderScheduleEd,
  socials: renderSocialsEd, charity: renderCharityEd
};
function renderAll() { Object.keys(renderers).forEach((k) => renderers[k]()); }

/* ---- Default new list items ---- */
function newListItem(res, list) {
  if (res === "schedule" && list === "days") return { name: "", time: "", game: "" };
  if (res === "socials" && list === "items") return { icon: "", label: "", sub: "", url: "", wide: false, primary: false };
  return ""; // paragraphs, pills, whatWeDo, steps are plain text
}

/* ---- Editing events (delegated on the dashboard) ---- */
function onInput(e) {
  const t = e.target, d = t.dataset;
  if (!d.res) return;
  const st = resources[d.res].state;
  const val = t.type === "checkbox" ? t.checked : t.value;

  if (d.res === "commands") {
    if (d.row !== undefined) st.sections[+d.sec].rows[+d.row][d.f] = val;
    else if (d.sec !== undefined) st.sections[+d.sec][d.f] = val;
    return;
  }
  if (d.top !== undefined) { st[d.top] = val; return; }
  if (d.cause !== undefined) { st.cause[d.cause] = val; return; }
  if (d.list !== undefined) {
    if (d.f !== undefined) st[d.list][+d.i][d.f] = val;
    else st[d.list][+d.i] = val;
  }
}

function onClick(e) {
  const d = e.target.dataset;
  const act = d.act;
  if (!act) return;

  if (act === "save") { saveResource(d.res); return; }

  // Commands structural actions
  if (act === "addSec") { resources.commands.state.sections.push({ title: "New section", icon: "", badge: "", style: "", rows: [] }); renderCommandsEd(); return; }
  if (act === "delSec") { if (confirm("Delete this whole section?")) { resources.commands.state.sections.splice(+d.sec, 1); renderCommandsEd(); } return; }
  if (act === "addRow") { resources.commands.state.sections[+d.sec].rows.push({ label: "", namesText: "", desc: "" }); renderCommandsEd(); return; }
  if (act === "delRow") { resources.commands.state.sections[+d.sec].rows.splice(+d.row, 1); renderCommandsEd(); return; }

  // Generic list actions
  if (act === "addItem") { resources[d.res].state[d.list].push(newListItem(d.res, d.list)); renderers[d.res](); return; }
  if (act === "delItem") { resources[d.res].state[d.list].splice(+d.i, 1); renderers[d.res](); return; }
}

/* ---- Save one resource ---- */
async function saveResource(key) {
  const r = resources[key];
  setStatus("Saving " + r.label + "...", "info");
  try {
    const obj = builders[key](r.state);
    r.sha = await ghPut(r.path, obj, r.sha, "Update " + r.label + " via admin");
    setStatus("Saved " + r.label + ". Your site will update in a minute or so. 💜", "ok");
  } catch (err) {
    setStatus(err.message || "Save failed.", "err");
  }
}

/* ---- Enter dashboard ---- */
async function enterDashboard() {
  setStatus("Loading your content...", "info");
  $("login").classList.add("hidden");
  $("dash").classList.remove("hidden");
  try {
    await loadAll();
    renderAll();
    setStatus("", null);
  } catch (err) {
    setStatus(err.message, "err");
    if (/token/i.test(err.message)) { $("dash").classList.add("hidden"); $("login").classList.remove("hidden"); }
  }
}

/* ---- Start ---- */
document.addEventListener("DOMContentLoaded", () => {
  $("loginBtn").addEventListener("click", login);
  $("logoutBtn").addEventListener("click", logout);
  const dash = $("dash");
  dash.addEventListener("input", onInput);
  dash.addEventListener("click", onClick);

  if (tryRestoreToken()) { $("remember").checked = true; enterDashboard(); }
});
