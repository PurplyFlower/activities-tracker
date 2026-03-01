// app.js
import { auth, db } from "./firebase-config.js";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

/**
 * Firestore collections:
 * - activities
 * - orgSettings  (per user per org)
 *
 * activities model:
 * {
 *   uid: string,
 *   org: string,
 *   position: string,
 *   type: "VOL_CLIN" | "VOL_NONCLIN" | "PAID_CLIN" | "PAID_NONCLIN" | "EXTRACURR" | "HOBBY",
 *   date: "YYYY-MM-DD",
 *   startTime: "HH:MM",
 *   endTime: "HH:MM",
 *   contactName: string,
 *   contactEmail: string,
 *   contactPhone: string,
 *   location: string,
 *   description: string,
 *   createdAt: serverTimestamp,
 *   updatedAt: serverTimestamp
 * }
 *
 * orgSettings model (doc id: `${uid}__${org}`):
 * {
 *   uid: string,
 *   org: string,
 *   ongoing: boolean,
 *   updatedAt: serverTimestamp
 * }
 */

const TYPES = {
  ARTISTIC_ENDEAVORS: "Artistic Endeavors",
  COMMUNITY_SERVICE_VOLUNTEER_MEDICAL_CLINICAL: "Community Service/Volunteer - Medical/Clinical",
  COMMUNITY_SERVICE_VOLUNTEER_NOT_MEDICAL_CLINICAL: "Community Service/Volunteer - NOT Medical/Clinical",
  CONFERENCES_ATTENDED: "Conferences Attended",
  EXTRACURRICULAR_ACTIVITIES: "Extracurricular Activities",
  HOBBIES: "Hobbies",
  HONORS_AWARDS_RECOGNITIONS: "Honors/Awards/Recognitions",
  INTERCOLLEGIATE_ATHLETICS: "Intercollegiate Athletics",
  LEADERSHIP_NOT_LISTED_ANYWHERE: "Leadership - Not Listed Anywhere",
  MILITARY_SERVICE: "Military Service",
  OTHER: "Other",
  PAID_EMPLOYMENT_MEDICAL_CLINICAL: "Paid Employment - Medical/Clinical",
  PAID_EMPLOYMENT_NOT_MEDICAL_CLINICAL: "Paid Employment - NOT Medical/Clinical",
  PHYSICIAN_SHADOWING_CLINICAL_OBSERVATION: "Physician Shadowing/Clinical Observation",
  PRESENTATIONS_POSTERS: "Presentations/Posters",
  PUBLICATIONS: "Publications",
  RESEARCH_LAB: "Research/Lab",
  SOCIAL_JUSTICE_ADVOCACY: "Social Justice/Advocacy",
  TEACHING_TUTORING_TEACHING_ASSISTANT: "Teaching/Tutoring/Teaching Assistant",
};

const $ = (id) => document.getElementById(id);

const state = {
  user: null,
  activities: [],
  orgSettings: new Map(), // org -> { ongoing: boolean }
  unsubActs: null,
  unsubOrgs: null,
  editingId: null,
  currentOrg: null,
};

function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }

function setActiveNav(route) {
  const map = { orgs: $("navOrgs"), timeline: $("navTimeline") };
  Object.values(map).forEach((a) => a.classList.remove("active"));
  if (map[route]) map[route].classList.add("active");
}

function route() {
  const hash = window.location.hash || "#/orgs";
  const parts = hash.replace("#/", "").split("/");
  const view = parts[0];
  const param = parts[1] ? decodeURIComponent(parts[1]) : null;

  if (!state.user) {
    renderAuth();
    return;
  }

  if (view === "org") {
    state.currentOrg = param || null;
    renderOrgDetail();
    return;
  }

  if (view === "timeline") {
    renderTimeline();
    return;
  }

  renderOrgs();
}

function renderAuth() {
  setActiveNav(null);
  $("statusText").textContent = "Signed out";
  $("btnAuth").textContent = "Login";
  hide($("btnLogout"));

  show($("viewAuth"));
  hide($("viewOrgs"));
  hide($("viewOrgDetail"));
  hide($("viewTimeline"));

  window.location.hash = "#/auth";
}

function renderOrgs() {
  setActiveNav("orgs");
  hide($("viewAuth"));
  show($("viewOrgs"));
  hide($("viewOrgDetail"));
  hide($("viewTimeline"));

  const search = ($("orgSearch").value || "").trim().toLowerCase();
  const sortMode = $("orgSort").value;

  const orgMap = buildOrgStats(state.activities, state.orgSettings);
  let orgs = Array.from(orgMap.values());

  if (search) orgs = orgs.filter((o) => o.org.toLowerCase().includes(search));
  orgs.sort((a, b) => sortOrgs(a, b, sortMode));

  const wrap = $("orgCards");
  wrap.innerHTML = "";

  if (orgs.length === 0) show($("orgEmpty"));
  else hide($("orgEmpty"));

  for (const o of orgs) {
    const endShown = o.ongoing ? "Present" : (o.endDate || "—");

    const card = document.createElement("div");
    card.className = "card";
    card.tabIndex = 0;
    card.role = "button";

    card.innerHTML = `
      <div class="cardTop">
        <div>
          <div class="cardTitle">${escapeHtml(o.org)}</div>
          <div class="muted">${o.count} entr${o.count === 1 ? "y" : "ies"}${o.ongoing ? " • ongoing" : ""}</div>
        </div>
        <div class="badge">${formatHours(o.totalHours)}h</div>
      </div>

      <div class="cardMeta">
        <div class="metaItem">
          <div class="metaLabel">Start</div>
          <div class="metaValue">${o.startDate || "—"}</div>
        </div>
        <div class="metaItem">
          <div class="metaLabel">End</div>
          <div class="metaValue">${endShown}</div>
        </div>
      </div>
    `;

    card.addEventListener("click", () => {
      window.location.hash = `#/org/${encodeURIComponent(o.org)}`;
    });
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        window.location.hash = `#/org/${encodeURIComponent(o.org)}`;
      }
    });

    wrap.appendChild(card);
  }
}

function renderOrgDetail() {
  setActiveNav("orgs");
  hide($("viewAuth"));
  hide($("viewOrgs"));
  show($("viewOrgDetail"));
  hide($("viewTimeline"));

  const org = state.currentOrg;
  $("orgTitle").textContent = org || "Organization";

  const list = state.activities.filter((a) => a.org === org);
  const typeFilter = $("typeFilter").value;
  const sortMode = $("orgTableSort").value;

  const filtered = (typeFilter === "ALL") ? list : list.filter((a) => a.type === typeFilter);
  filtered.sort((a, b) => sortActivities(a, b, sortMode));

  const ongoing = !!(state.orgSettings.get(org)?.ongoing);
  $("btnToggleOngoing").textContent = ongoing ? "Marked ongoing ✓" : "Mark as ongoing";

  // Stats
  const stats = summarizeActivities(list);
  const endShown = ongoing ? "Present" : (stats.endDate || "—");
  $("orgMeta").textContent = `${stats.count} entr${stats.count === 1 ? "y" : "ies"} • ${formatHours(stats.totalHours)} total hours • ${stats.startDate || "—"} → ${endShown}`;
  $("orgStats").innerHTML = renderStatsCards(stats.byTypeHours);

  // Table
  const tbody = $("orgTbody");
  tbody.innerHTML = "";

  if (filtered.length === 0) show($("orgDetailEmpty"));
  else hide($("orgDetailEmpty"));

  for (const a of filtered) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div>${escapeHtml(a.date)}</div>
        <div class="small">${escapeHtml(a.description || "")}</div>
      </td>
      <td>${escapeHtml(a.startTime)}</td>
      <td>${escapeHtml(a.endTime)}</td>
      <td><span class="badge">${formatHours(calcHours(a))}h</span></td>
      <td>${escapeHtml(TYPES[a.type] || a.type)}</td>
      <td>${escapeHtml(a.position || "—")}</td>
      <td>${escapeHtml(a.location || "—")}</td>
      <td>
        <div>${escapeHtml(a.contactName || "—")}</div>
        <div class="small">${escapeHtml(a.contactEmail || "")}</div>
        <div class="small">${escapeHtml(a.contactPhone || "")}</div>
      </td>
      <td class="right">
        <button class="btn ghost" data-edit="${a.id}">Edit</button>
      </td>
    `;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => openModalForEdit(btn.dataset.edit));
  });
}

function renderTimeline() {
  setActiveNav("timeline");
  hide($("viewAuth"));
  hide($("viewOrgs"));
  hide($("viewOrgDetail"));
  show($("viewTimeline"));

  const typeFilter = $("timelineTypeFilter").value;
  const sortMode = $("timelineSort").value;

  let list = [...state.activities];
  if (typeFilter !== "ALL") list = list.filter((a) => a.type === typeFilter);
  list.sort((a, b) => sortActivities(a, b, sortMode));

  const tbody = $("timelineTbody");
  tbody.innerHTML = "";

  if (list.length === 0) show($("timelineEmpty"));
  else hide($("timelineEmpty"));

  for (const a of list) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(a.date)}<div class="small">${escapeHtml(a.startTime)}–${escapeHtml(a.endTime)}</div></td>
      <td>${escapeHtml(a.org)}</td>
      <td><span class="badge">${formatHours(calcHours(a))}h</span></td>
      <td>${escapeHtml(TYPES[a.type] || a.type)}</td>
      <td>${escapeHtml(a.position || "—")}</td>
      <td>${escapeHtml(a.location || "—")}</td>
      <td>${escapeHtml(a.description || "—")}</td>
      <td class="right"><button class="btn ghost" data-edit="${a.id}">Edit</button></td>
    `;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => openModalForEdit(btn.dataset.edit));
  });
}

/* -----------------------------
   Firestore subscriptions
------------------------------ */

function startSubscriptions(uid) {
  if (state.unsubActs) state.unsubActs();
  if (state.unsubOrgs) state.unsubOrgs();

  // activities
  const qActs = query(
    collection(db, "activities"),
    where("uid", "==", uid),
    orderBy("date", "desc"),
    orderBy("startTime", "desc")
  );

  state.unsubActs = onSnapshot(qActs, (snap) => {
    const rows = [];
    snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
    state.activities = rows;
    route();
  });

  // org settings
  const qOrgs = query(
    collection(db, "orgSettings"),
    where("uid", "==", uid),
    orderBy("org", "asc")
  );

  state.unsubOrgs = onSnapshot(qOrgs, (snap) => {
    const m = new Map();
    snap.forEach((d) => {
      const data = d.data();
      if (data?.org) m.set(data.org, { ongoing: !!data.ongoing });
    });
    state.orgSettings = m;
    route();
  });
}

function orgDocId(uid, org) {
  // stable doc id so toggling doesn't create duplicates
  return `${uid}__${org}`;
}

async function toggleOngoingForCurrentOrg() {
  const org = state.currentOrg;
  if (!state.user || !org) return;

  const current = !!(state.orgSettings.get(org)?.ongoing);
  const next = !current;

  try {
    await setDoc(
      doc(db, "orgSettings", orgDocId(state.user.uid, org)),
      {
        uid: state.user.uid,
        org,
        ongoing: next,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (e) {
    // best-effort: surface minimal error
    alert(e?.message || "Failed to update org setting.");
  }
}

/* -----------------------------
   Modal (Add / Edit)
------------------------------ */

function openModalForAdd(prefillOrg = "") {
  state.editingId = null;
  $("modalTitle").textContent = "Add activity";
  $("modalSubtitle").textContent = "Log one session.";
  hide($("btnDelete"));
  clearForm();
  if (prefillOrg) $("fOrg").value = prefillOrg;
  showModal();
}

function openModalForEdit(id) {
  const a = state.activities.find((x) => x.id === id);
  if (!a) return;

  state.editingId = id;
  $("modalTitle").textContent = "Edit activity";
  $("modalSubtitle").textContent = `Editing ${a.org} on ${a.date}`;
  show($("btnDelete"));

  $("fOrg").value = a.org || "";
  $("fPosition").value = a.position || "";
  $("fType").value = a.type || "EXTRACURR";
  $("fDate").value = a.date || "";
  $("fStart").value = a.startTime || "";
  $("fEnd").value = a.endTime || "";
  $("fContactName").value = a.contactName || "";
  $("fContactEmail").value = a.contactEmail || "";
  $("fContactPhone").value = a.contactPhone || "";
  $("fLocation").value = a.location || "";
  $("fDesc").value = a.description || "";

  hideError("formError");
  showModal();
}

function showModal() { show($("modal")); }
function closeModal() { hide($("modal")); }

function clearForm() {
  $("fOrg").value = "";
  $("fPosition").value = "";
  $("fType").value = "VOL_CLIN";
  $("fDate").value = "";
  $("fStart").value = "";
  $("fEnd").value = "";
  $("fContactName").value = "";
  $("fContactEmail").value = "";
  $("fContactPhone").value = "";
  $("fLocation").value = "";
  $("fDesc").value = "";
  hideError("formError");
}

function validateForm() {
  const org = $("fOrg").value.trim();
  const type = $("fType").value;
  const date = $("fDate").value;
  const startTime = $("fStart").value;
  const endTime = $("fEnd").value;

  if (!org) return "Organization is required.";
  if (!type) return "Activity type is required.";
  if (!date) return "Date is required.";
  if (!startTime) return "Start time is required.";
  if (!endTime) return "End time is required.";

  const hours = calcHours({ startTime, endTime });
  if (!Number.isFinite(hours) || hours <= 0) return "End time must be after start time.";
  return null;
}

async function saveForm() {
  const err = validateForm();
  if (err) { showError("formError", err); return; }

  const payload = {
    uid: state.user.uid,
    org: $("fOrg").value.trim(),
    position: $("fPosition").value.trim(),
    type: $("fType").value,
    date: $("fDate").value,
    startTime: $("fStart").value,
    endTime: $("fEnd").value,
    contactName: $("fContactName").value.trim(),
    contactEmail: $("fContactEmail").value.trim(),
    contactPhone: $("fContactPhone").value.trim(),
    location: $("fLocation").value.trim(),
    description: $("fDesc").value.trim(),
    updatedAt: serverTimestamp(),
  };

  try {
    if (!state.editingId) {
      payload.createdAt = serverTimestamp();
      await addDoc(collection(db, "activities"), payload);
    } else {
      await updateDoc(doc(db, "activities", state.editingId), payload);
    }
    closeModal();
  } catch (e) {
    showError("formError", e?.message || "Failed to save.");
  }
}

async function deleteCurrent() {
  if (!state.editingId) return;
  try {
    await deleteDoc(doc(db, "activities", state.editingId));
    closeModal();
  } catch (e) {
    showError("formError", e?.message || "Failed to delete.");
  }
}

/* -----------------------------
   Helpers
------------------------------ */

function calcHours(a) {
  const [sh, sm] = (a.startTime || "00:00").split(":").map(Number);
  const [eh, em] = (a.endTime || "00:00").split(":").map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  const diff = end - start;
  return diff / 60;
}

function formatHours(h) {
  const v = Math.round(h * 100) / 100;
  return ("" + v).replace(/\.0$/, "").replace(/(\.\d)0$/, "$1");
}

function buildOrgStats(activities, orgSettingsMap) {
  const m = new Map();
  for (const a of activities) {
    const key = a.org || "Unknown";
    if (!m.has(key)) {
      m.set(key, {
        org: key,
        totalHours: 0,
        count: 0,
        startDate: null,
        endDate: null,
        ongoing: !!(orgSettingsMap.get(key)?.ongoing),
      });
    }
    const o = m.get(key);
    const hrs = calcHours(a);
    o.totalHours += Number.isFinite(hrs) ? hrs : 0;
    o.count += 1;
    if (!o.startDate || a.date < o.startDate) o.startDate = a.date;
    if (!o.endDate || a.date > o.endDate) o.endDate = a.date;
  }

  // Include orgs that have settings but no activities yet (rare, but possible)
  for (const [org, settings] of orgSettingsMap.entries()) {
    if (!m.has(org)) {
      m.set(org, {
        org,
        totalHours: 0,
        count: 0,
        startDate: null,
        endDate: null,
        ongoing: !!settings.ongoing,
      });
    } else {
      m.get(org).ongoing = !!settings.ongoing;
    }
  }

  return m;
}

function summarizeActivities(list) {
  const stats = {
    count: list.length,
    totalHours: 0,
    startDate: null,
    endDate: null,
    byTypeHours: Object.fromEntries(Object.keys(TYPES).map((k) => [k, 0])),
  };

  for (const a of list) {
    const hrs = calcHours(a);
    const add = Number.isFinite(hrs) ? hrs : 0;
    stats.totalHours += add;
    if (a.type && stats.byTypeHours[a.type] != null) stats.byTypeHours[a.type] += add;
    if (!stats.startDate || a.date < stats.startDate) stats.startDate = a.date;
    if (!stats.endDate || a.date > stats.endDate) stats.endDate = a.date;
  }
  return stats;
}

function renderStatsCards(byTypeHours) {
  const entries = Object.entries(byTypeHours)
    .map(([k, v]) => ({ key: k, hours: v }))
    .sort((a, b) => b.hours - a.hours);

  return entries.map((x) => `
    <div class="stat">
      <div class="statLabel">${escapeHtml(TYPES[x.key] || x.key)}</div>
      <div class="statValue">${formatHours(x.hours)}h</div>
    </div>
  `).join("");
}

function sortOrgs(a, b, mode) {
  if (mode === "hoursAsc") return a.totalHours - b.totalHours;
  if (mode === "hoursDesc") return b.totalHours - a.totalHours;
  if (mode === "nameAsc") return a.org.localeCompare(b.org);
  if (mode === "nameDesc") return b.org.localeCompare(a.org);
  if (mode === "startAsc") return (a.startDate || "").localeCompare(b.startDate || "");
  if (mode === "startDesc") return (b.startDate || "").localeCompare(a.startDate || "");
  return 0;
}

function sortActivities(a, b, mode) {
  const da = a.date || "";
  const dbb = b.date || "";
  const ta = a.startTime || "";
  const tb = b.startTime || "";

  if (mode === "dateAsc") return (da + ta).localeCompare(dbb + tb);
  if (mode === "dateDesc") return (dbb + tb).localeCompare(da + ta);

  const ha = calcHours(a), hb = calcHours(b);
  if (mode === "hoursAsc") return ha - hb;
  if (mode === "hoursDesc") return hb - ha;

  if (mode === "typeAsc") return (a.type || "").localeCompare(b.type || "");
  return 0;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* -----------------------------
   UI events
------------------------------ */

$("btnAdd").addEventListener("click", () => {
  if (!state.user) {
    window.location.hash = "#/auth";
    return;
  }
  const hash = window.location.hash || "";
  if (hash.startsWith("#/org/")) openModalForAdd(state.currentOrg || "");
  else openModalForAdd("");
});

$("btnAuth").addEventListener("click", () => {
  window.location.hash = "#/auth";
  route();
});

$("btnLogout").addEventListener("click", async () => {
  await signOut(auth);
});

$("btnBackToOrgs").addEventListener("click", () => {
  window.location.hash = "#/orgs";
});

$("btnToggleOngoing").addEventListener("click", toggleOngoingForCurrentOrg);

$("btnCloseModal").addEventListener("click", closeModal);
$("btnCancel").addEventListener("click", closeModal);
$("btnSave").addEventListener("click", saveForm);
$("btnDelete").addEventListener("click", deleteCurrent);

$("modal").addEventListener("click", (e) => {
  if (e.target === $("modal")) closeModal();
});

$("orgSearch").addEventListener("input", () => renderOrgs());
$("orgSort").addEventListener("change", () => renderOrgs());

$("typeFilter").addEventListener("change", () => renderOrgDetail());
$("orgTableSort").addEventListener("change", () => renderOrgDetail());

$("timelineSort").addEventListener("change", () => renderTimeline());
$("timelineTypeFilter").addEventListener("change", () => renderTimeline());

$("btnLogin").addEventListener("click", async () => {
  hideError("authError");
  const email = $("authEmail").value.trim();
  const pass = $("authPass").value;
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    showError("authError", e?.message || "Login failed.");
  }
});

$("btnSignup").addEventListener("click", async () => {
  hideError("authError");
  const email = $("authEmail").value.trim();
  const pass = $("authPass").value;
  try {
    await createUserWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    showError("authError", e?.message || "Signup failed.");
  }
});

function showError(id, msg) {
  const el = $(id);
  el.textContent = msg;
  show(el);
}
function hideError(id) {
  hide($(id));
  $(id).textContent = "";
}

/* -----------------------------
   Auth state + routing boot
------------------------------ */

onAuthStateChanged(auth, (user) => {
  state.user = user || null;

  if (user) {
    $("statusText").textContent = `Signed in as ${user.email || "user"}`;
    $("btnAuth").textContent = "Account";
    show($("btnLogout"));
    startSubscriptions(user.uid);

    if ((window.location.hash || "").startsWith("#/auth")) {
      window.location.hash = "#/orgs";
    }
  } else {
    if (state.unsubActs) state.unsubActs();
    if (state.unsubOrgs) state.unsubOrgs();
    state.activities = [];
    state.orgSettings = new Map();
    state.currentOrg = null;
    renderAuth();
  }

  route();
});

window.addEventListener("hashchange", route);
if (!window.location.hash) window.location.hash = "#/orgs";
