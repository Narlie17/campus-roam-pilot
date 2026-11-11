#!/usr/bin/env node
// Refreshes ROAM's public data. Each source is independent: if one fails, its last good file is kept.
//   data/events.json         university calendar (Localist API -> iCal -> RSS) + Eagle Engage org events
//   data/orgs.json           Eagle Engage student organization directory (Presence)
//   data/library-hours.json  LibCal hours for Henderson & Lane libraries
//   data/news.json           each college's news feed
//   data/buildings.json      building coordinates (calendar places + OpenStreetMap) for walking times
// Usage: node scripts/refresh-data.mjs [--only events,orgs,library,news,buildings] [--from raw-events.json] [--presence-from dir]
// Node 18+, no dependencies.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const P = (f) => path.join(ROOT, "data", f);
const CAL = "https://calendar.georgiasouthern.edu";
const DAYS_AHEAD = 60;
const UA = "CampusROAM/1.1 (student pilot; reads public pages)";
const args = process.argv.slice(2);
const only = (args[args.indexOf("--only") + 1] || "events,orgs,library,news,buildings,courses").split(",");
const run = (k) => args.indexOf("--only") < 0 || only.includes(k);

const campus = JSON.parse(await readFile(P("campus.json"), "utf8"));
const academics = JSON.parse(await readFile(P("academics.json"), "utf8"));
const readJson = async (f, d) => { try { return JSON.parse(await readFile(P(f), "utf8")); } catch { return d; } };
const save = (f, obj) => writeFile(P(f), JSON.stringify(obj, null, 1) + "\n");

// ---------- helpers ----------
const stripHtml = (s = "") => String(s).replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
  .replace(/&#8217;|&#39;|&rsquo;|&lsquo;/g, "'").replace(/&#8220;|&#8221;|&quot;|&ldquo;|&rdquo;/g, '"')
  .replace(/&#8211;|&ndash;/g, "–").replace(/&#8212;|&mdash;/g, "—").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
const clip = (s, n = 320) => (s && s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s || "");
async function get(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { "User-Agent": UA, Accept: "*/*", ...(opts.headers || {}) } });
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
  return r.text();
}
function campusOf(text = "") {
  const t = text.toLowerCase();
  if (/armstrong|savannah|abercorn/.test(t)) return "armstrong";
  if (/statesboro/.test(t)) return "statesboro";
  if (/augusta|atlanta|italy|tuscany|online|virtual|zoom|swainsboro|hinesville|liberty/.test(t)) return "other";
  return "";
}
const kw = campus.interests.map((i) => ({ id: i.id, re: new RegExp("\\b(" + i.keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")s?\\b", "i") }));
const tagsOf = (...p) => { const t = p.filter(Boolean).join(" "); return kw.filter((k) => k.re.test(t)).map((k) => k.id); };
const collegeKw = academics.colleges.map((c) => ({ id: c.id, re: new RegExp("(" + c.keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "i"), name: c.name.toLowerCase() }));
function collegesOf(e) {
  const deptText = (e.depts || []).join(" ").toLowerCase();
  const text = [e.title, e.location, (e.types || []).join(" "), deptText].join(" ");
  return collegeKw.filter((c) => c.id !== "explore" && (deptText.includes(c.name) || c.re.test(text))).map((c) => c.id);
}
function normalize(e) {
  const start = new Date(e.start);
  if (isNaN(start)) return null;
  let end = e.end ? new Date(e.end) : null;
  if (!end || isNaN(end) || end <= start) end = new Date(start.getTime() + 3600000);
  const out = {
    id: String(e.id), title: stripHtml(e.title), start: start.toISOString(), end: end.toISOString(), allDay: !!e.allDay,
    location: stripHtml(e.location || ""), campus: e.campus || campusOf(e.location || ""), url: e.url || CAL + "/calendar",
    types: e.types || [], depts: e.depts || [], source: e.source || "calendar",
    tags: tagsOf(e.title, (e.types || []).join(" "), e.location, e.desc), desc: clip(stripHtml(e.desc || "")), free: e.free ?? null,
  };
  if (e.org) out.org = e.org;
  if (e.orgUri) out.orgUri = e.orgUri;
  if (e.lat && e.lon) { out.lat = +e.lat; out.lon = +e.lon; }
  out.colleges = collegesOf(out);
  return out;
}

// ---------- EVENTS ----------
async function fromLocalist() {
  const today = new Date().toISOString().slice(0, 10), out = [];
  for (let page = 1; page <= 15; page++) {
    const json = JSON.parse(await get(`${CAL}/api/2/events?start=${today}&days=${DAYS_AHEAD}&pp=100&page=${page}`));
    for (const { event: ev } of json.events || []) {
      const types = (ev.filters?.event_types || []).map((t) => t.name);
      const loc = [ev.location_name, ev.room_number].filter(Boolean).join(", ") || ev.address || "";
      for (const { event_instance: inst } of ev.event_instances || []) {
        out.push({ id: `${ev.id}-${inst.id}`, title: ev.title, start: inst.start, end: inst.end, allDay: inst.all_day, location: loc,
          campus: campusOf([ev.location_name, ev.address, ev.location].join(" ")), url: ev.localist_url || ev.url, types,
          depts: (ev.departments || []).map((d) => d.name), desc: ev.description_text, free: ev.free, lat: ev.geo?.latitude, lon: ev.geo?.longitude });
      }
    }
    if (!json.page?.total || page >= json.page.total) break;
  }
  return out;
}
function icsDate(v) {
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h = "00", mi = "00", s = "00", z] = m;
  const utc = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  if (z) return new Date(utc);
  const f = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "shortOffset" });
  const off = (f.formatToParts(new Date(utc)).find((p) => p.type === "timeZoneName")?.value || "GMT-5").match(/GMT([+-]\d+)/);
  return new Date(utc - (off ? +off[1] : -5) * 3600000);
}
async function fromIcs() {
  const text = (await get(`${CAL}/calendar.ics`)).replace(/\r?\n[ \t]/g, ""), out = [];
  for (const block of text.split("BEGIN:VEVENT").slice(1)) {
    const f = {};
    for (const line of block.split("END:VEVENT")[0].split(/\r?\n/)) {
      const i = line.indexOf(":"); if (i < 0) continue;
      f[line.slice(0, i).split(";")[0]] = line.slice(i + 1).replace(/\\n/g, " ").replace(/\\([,;])/g, "$1");
    }
    if (!f.DTSTART || !f.SUMMARY) continue;
    out.push({ id: (f.UID || f.SUMMARY + f.DTSTART).replace(/[^\w-]/g, "").slice(0, 80), title: f.SUMMARY, start: icsDate(f.DTSTART), end: f.DTEND ? icsDate(f.DTEND) : null,
      allDay: /^\d{8}$/.test(f.DTSTART), location: f.LOCATION || "", url: f.URL || "", types: f.CATEGORIES ? f.CATEGORIES.split(",").map((s) => s.trim()) : [], desc: f.DESCRIPTION || "" });
  }
  return out;
}
async function fromRss() {
  const xml = await get(`${CAL}/calendar.xml`), out = [];
  for (const item of xml.split("<item>").slice(1)) {
    const tag = (n) => { const m = item.match(new RegExp(`<${n}[^>]*>([\\s\\S]*?)</${n}>`, "i")); return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : ""; };
    const start = tag("ev:startdate") || tag("xCal:dtstart") || tag("dc:date") || tag("pubDate");
    if (!tag("title") || !start) continue;
    out.push({ id: tag("link").split("/").pop() + "-" + start.replace(/\W/g, ""), title: tag("title"), start, end: tag("ev:enddate") || tag("xCal:dtend"),
      location: tag("ev:location") || tag("xCal:location"), url: tag("link"), desc: tag("description") });
  }
  return out;
}
// Eagle Engage runs on Presence: public JSON at api.presence.io/<subdomain>/v1/...
const ENGAGE = campus.meta.sources?.engageBase || "https://georgiasouthern.presence.io";
const PRESENCE_SUB = (ENGAGE.match(/https?:\/\/([\w-]+)\.presence\.io/) || [])[1] || "georgiasouthern";
let presenceCache = {};
async function presence(kind) {
  if (presenceCache[kind]) return presenceCache[kind];
  const pi = args.indexOf("--presence-from");
  const data = pi >= 0 ? JSON.parse(await readFile(path.join(args[pi + 1], kind === "organizations" ? "organizations.json" : "events.json"), "utf8"))
    : JSON.parse(await get(`https://api.presence.io/${PRESENCE_SUB}/v1/${kind}`, { headers: { Accept: "application/json" } }));
  return (presenceCache[kind] = data);
}
async function fromEngage() {
  const now = Date.now(), list = await presence("events");
  return list.filter((e) => new Date(e.endDateTimeUtc).getTime() > now && new Date(e.endDateTimeUtc) - new Date(e.startDateTimeUtc) < 3 * 86400000).map((e) => {
    const campusTag = (e.tags || []).find((t) => /^Campus:/.test(t)) || "";
    const tags = (e.tags || []).filter((t) => !/^Campus:|^Competency/.test(t));
    return { id: "engage-" + e.uri, title: e.eventName, start: e.startDateTimeUtc, end: e.endDateTimeUtc, location: e.location || "", url: `${ENGAGE}/event/${e.uri}`,
      types: tags, desc: e.description, org: e.organizationName, orgUri: e.organizationUri, source: "engage",
      campus: /armstrong/i.test(campusTag) ? "armstrong" : /statesboro/i.test(campusTag) ? "statesboro" : campusTag ? "other" : campusOf((e.location || "") + " " + (e.organizationName || "")) };
  });
}
async function refreshOrgs() {
  const list = await presence("organizations");
  const evs = await presence("events").catch(() => []), now = Date.now(), upcoming = {};
  for (const e of evs) if (new Date(e.endDateTimeUtc).getTime() > now) upcoming[e.organizationUri] = (upcoming[e.organizationUri] || 0) + 1;
  const orgs = list.filter((o) => o.name && o.uri).map((o) => ({ name: stripHtml(o.name).trim(), uri: o.uri, cats: o.categories || [], members: o.memberCount || 0,
    meets: [o.regularMeetingTime, o.regularMeetingLocation].filter(Boolean).map((x) => stripHtml(String(x))).join(" · ").slice(0, 90),
    desc: clip(stripHtml(o.description || ""), 220), upcoming: upcoming[o.uri] || 0 })).sort((a, b) => a.name.localeCompare(b.name));
  if (orgs.length < 20) throw new Error("Eagle Engage returned too few organizations");
  await save("orgs.json", { generatedAt: new Date().toISOString(), source: `Eagle Engage (${ENGAGE})`, base: ENGAGE, orgs });
  console.log(`orgs: wrote ${orgs.length}`);
}
async function refreshEvents() {
  let raw = null, source = null;
  const fi = args.indexOf("--from");
  if (fi >= 0) { raw = JSON.parse(await readFile(args[fi + 1], "utf8")); source = "RSS feed snapshot"; }
  for (const [name, fn] of raw ? [] : [["Localist API", fromLocalist], ["iCal feed", fromIcs], ["RSS feed", fromRss]]) {
    try { const r = await fn(); if (r.length) { raw = r; source = name; break; } console.warn(`events: ${name} returned 0`); }
    catch (e) { console.warn(`events: ${name} failed: ${e.message}`); }
  }
  const prev = await readJson("events.json", { events: [] });
  if (!raw) { console.error("events: all calendar sources failed, keeping previous calendar events"); raw = prev.events.filter((e) => e.source !== "engage"); source = prev.source; }
  {
    try { const eg = await fromEngage(); raw = raw.concat(eg); source += ` + Eagle Engage (${eg.length})`; }
    catch (e) { console.warn(`events: Eagle Engage failed: ${e.message}`); raw = raw.concat(prev.events.filter((x) => x.source === "engage")); }
  }
  const now = Date.now(), horizon = now + DAYS_AHEAD * 86400000, seen = new Set();
  const events = raw.map(normalize).filter(Boolean)
    .filter((e) => new Date(e.end).getTime() > now - 6 * 3600000 && new Date(e.start).getTime() < horizon)
    .filter((e) => { const k = e.title.toLowerCase() + e.start; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => a.start.localeCompare(b.start));
  await save("events.json", { generatedAt: new Date().toISOString(), source: `${source} · ${CAL}`, events });
  console.log(`events: wrote ${events.length} (${source})`);
}

// ---------- LIBRARY HOURS (LibCal) ----------
async function refreshLibrary() {
  const s = campus.meta.sources || {};
  let host = s.libcalHost, iid = s.libcalIid;
  if (!host || !iid) {
    const html = await get(s.libraryHoursPage || "https://georgiasouthern.libguides.com/hours/");
    host = host || (html.match(/https?:\/\/[\w-]+\.libcal\.com/) || [])[0];
    iid = iid || (html.match(/libcal\.com[^"'\s]*?[?&]iid=(\d+)/) || html.match(/iid[=:]["']?(\d{3,6})/) || [])[1];
  }
  if (!host || !iid) throw new Error("couldn't find the LibCal widget on the hours page; set libcalHost/libcalIid in campus.json");
  const json = JSON.parse(await get(`${host}/api_hours_grid.php?iid=${iid}&format=json&weeks=2&systemTime=0`));
  const locations = (json.locations || []).map((l) => {
    const days = {};
    for (const w of l.weeks || []) for (const d of Object.values(w)) if (d && d.date) days[d.date] = { status: d.times?.status || "", hours: (d.times?.hours || []).map((h) => ({ from: h.from, to: h.to })), rendered: stripHtml(d.rendered || "") };
    return { lid: l.lid, name: stripHtml(l.name), days };
  }).filter((l) => Object.keys(l.days).length);
  if (!locations.length) throw new Error("LibCal returned no hours");
  await save("library-hours.json", { generatedAt: new Date().toISOString(), source: `${host} (LibCal)`, locations });
  console.log(`library: ${locations.length} locations`);
}

// ---------- COLLEGE NEWS ----------
async function refreshNews() {
  const prev = await readJson("news.json", { colleges: {} });
  const out = { generatedAt: new Date().toISOString(), source: "College news feeds on georgiasouthern.edu", colleges: { ...prev.colleges } };
  let ok = 0;
  for (const c of academics.colleges) {
    try {
      const xml = await get(c.newsFeed);
      const items = xml.split("<item>").slice(1, 7).map((it) => {
        const t = (n) => (it.match(new RegExp(`<${n}[^>]*>([\\s\\S]*?)</${n}>`)) || [])[1]?.replace(/<!\[CDATA\[|\]\]>/g, "").trim() || "";
        const d = new Date(t("pubDate"));
        return { title: stripHtml(t("title")), date: isNaN(d) ? "" : d.toISOString().slice(0, 10), url: t("link") };
      }).filter((x) => x.title && x.url);
      if (items.length) { out.colleges[c.id] = items; ok++; }
    } catch (e) { console.warn(`news: ${c.id} failed: ${e.message}`); }
  }
  await save("news.json", out);
  console.log(`news: refreshed ${ok}/${academics.colleges.length} colleges`);
}

// ---------- BUILDINGS ----------
const norm = (s) => s.toLowerCase().replace(/\(.*?\)/g, " ").replace(/statesboro campus|armstrong campus|building|bldg|hall|center|the\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
async function refreshBuildings() {
  const prev = await readJson("buildings.json", { buildings: [] });
  const found = [];
  try {
    for (let page = 1; page <= 10; page++) {
      const json = JSON.parse(await get(`${CAL}/api/2/places?pp=100&page=${page}`));
      for (const { place: p } of json.places || []) if (p.geo?.latitude) found.push({ name: stripHtml(p.name), lat: +p.geo.latitude, lon: +p.geo.longitude, source: "calendar" });
      if (!json.page?.total || page >= json.page.total) break;
    }
  } catch (e) { console.warn(`buildings: calendar places failed: ${e.message}`); }
  try {
    const q = `[out:json][timeout:60];(way["building"]["name"](32.410,-81.800,32.445,-81.760);way["building"]["name"](31.968,-81.172,31.990,-81.150););out center tags;`;
    const json = JSON.parse(await get("https://overpass-api.de/api/interpreter", { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "Content-Type": "application/x-www-form-urlencoded" } }));
    for (const el of json.elements || []) if (el.center) found.push({ name: el.tags.name, lat: el.center.lat, lon: el.center.lon, source: "openstreetmap" });
  } catch (e) { console.warn(`buildings: OpenStreetMap failed: ${e.message}`); }
  if (!found.length) { console.warn("buildings: no sources answered, keeping previous file"); return; }
  const list = prev.buildings.map((b) => ({ ...b }));
  for (const f of found) {
    const nf = norm(f.name);
    if (!nf) continue;
    const campusId = f.lat < 32.2 ? "armstrong" : "statesboro";
    let hit = list.find((b) => norm(b.name) === nf) || list.find((b) => { const nb = norm(b.name); return nb && (nb.includes(nf) || nf.includes(nb)) && Math.min(nb.length, nf.length) >= 5; });
    if (!hit) { hit = { name: f.name.replace(/\s*\((Statesboro|Armstrong) Campus\)/, ""), campus: campusId }; list.push(hit); }
    if (!hit.lat || f.source === "calendar") Object.assign(hit, { lat: +f.lat.toFixed(6), lon: +f.lon.toFixed(6), source: f.source });
  }
  list.sort((a, b) => a.campus.localeCompare(b.campus) || a.name.localeCompare(b.name));
  await save("buildings.json", { generatedAt: new Date().toISOString(), note: prev.note, buildings: list });
  console.log(`buildings: ${list.filter((b) => b.lat).length}/${list.length} with coordinates`);
}

// ---------- course directory (public Acalog widget API) ----------
// Powers "Find your course" in Classes. Refreshed at most once a week.
const CATALOG = "https://catalog.georgiasouthern.edu/widget-api/catalog/9/courses/";
async function refreshCourses() {
  const out = path.join(ROOT, "courses.js");
  try {
    const prev = await readFile(out, "utf8");
    const at = (prev.match(/"generatedAt":"([^"]+)"/) || [])[1];
    if (at && Date.now() - new Date(at).getTime() < 6.5 * 864e5 && !args.includes("--force")) { console.log("courses: fresh, skipped"); return; }
  } catch {}
  const ent = (t) => t.replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;|\u00a0/g, " ");
  const seen = new Set(), list = [];
  for (let page = 1; page < 120; page++) {
    const j = JSON.parse(await get(`${CATALOG}?page-size=100&page=${page}`, { headers: { Accept: "application/json" } }));
    const L = j["course-list"] || [];
    if (!L.length) break;
    for (const c of L) {
      const m = ent(String(c.title || "")).match(/^([A-Z]{2,5})\s+(\d{4}[A-Z]?)\s+-\s+(.*?)(?:\s+\([\d.\- to]+\s+Credit Hours?\))?$/);
      if (!m) continue;
      const code = `${m[1]} ${m[2]}`;
      if (seen.has(code)) continue;
      seen.add(code); list.push([code, m[3].trim()]);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  if (list.length < 1000) throw new Error(`only ${list.length} courses; keeping previous file`);
  const body = JSON.stringify({ catalog: "2026-2027 Undergraduate & Graduate", source: "catalog.georgiasouthern.edu", generatedAt: new Date().toISOString(), courses: list });
  await writeFile(out, `window.ROAM_COURSES=${body};\n`);
  console.log(`courses: ${list.length}`);
}

// ---------- run ----------
for (const [k, fn] of [["events", refreshEvents], ["orgs", refreshOrgs], ["library", refreshLibrary], ["news", refreshNews], ["buildings", refreshBuildings], ["courses", refreshCourses]]) {
  if (!run(k)) continue;
  try { await fn(); } catch (e) { console.warn(`${k}: ${e.message} (kept previous data)`); }
}
