#!/usr/bin/env node
// Prints a Markdown report: broken links, stale data files, and upcoming term changes.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const load = async (f) => JSON.parse(await readFile(path.join(ROOT, "data", f), "utf8"));
const campus = await load("campus.json"), academics = await load("academics.json");
const issues = [], notes = [];
const today = new Date().toISOString().slice(0, 10);
const days = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

// 1. Term coverage
const terms = campus.terms.slice().sort((a, b) => a.classesStart.localeCompare(b.classesStart));
const last = terms[terms.length - 1];
const left = days(today, last.finalsEnd);
if (left < 45) issues.push(`**Add next term.** ${last.name} is the last term in \`campus.json\` and ends in ${left} days. Add the next term's dates from the Registrar's academic calendar.`);
if (!campus.dates.some((d) => d.date > today && d.kind === "deadline")) issues.push("**No upcoming deadlines** are listed in `campus.json` → `dates`.");
const tba = campus.dates.filter((d) => /TBA/i.test(d.title) && d.date >= today);
if (tba.length) issues.push(`**${tba.length} date(s) still say TBA.** Check the Registrar for updates.`);

// 2. Freshness of automated data
for (const [f, maxH] of [["events.json", 48], ["news.json", 24 * 14], ["library-hours.json", 72], ["buildings.json", 24 * 30]]) {
  try {
    const j = await load(f);
    const h = j.generatedAt ? (Date.now() - new Date(j.generatedAt)) / 3600000 : Infinity;
    if (h > maxH) issues.push(`**\`${f}\` is stale** (${isFinite(h) ? Math.round(h) + "h old" : "never refreshed"}). Check the "Refresh campus data" workflow log.`);
  } catch { issues.push(`**\`${f}\` is missing or unreadable.**`); }
}
if (!campus.meta.sources?.engageBase) notes.push("Eagle Engage isn't connected. Add its web address to `campus.json` → `meta.sources.engageBase` to include student-org events.");
const shuttle = campus.transit.find((t) => t.schedule);
if (shuttle && !shuttle.schedule.MWF.fromStatesboro.length) notes.push("Intercampus shuttle departure times are empty in `campus.json`.");

// 3. Links
const urls = new Set();
JSON.stringify([campus, academics], (k, v) => { if (typeof v === "string" && /^https?:\/\//.test(v)) urls.add(v.split("#")[0]); return v; });
const bad = [];
await Promise.all([...urls].map(async (u) => {
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(u, { method: "GET", redirect: "follow", headers: { "User-Agent": "CampusROAM link check" }, signal: AbortSignal.timeout(20000) });
      if (r.status < 400 || r.status === 403 || r.status === 429) return;
      if (i) bad.push(`${r.status} ${u}`);
    } catch (e) { if (i) bad.push(`ERR ${u}`); }
  }
}));
if (bad.length) issues.push(`**${bad.length} broken link(s):**\n` + bad.sort().map((b) => `  - ${b}`).join("\n"));

console.log(`# ROAM data check, ${today}\n`);
console.log(issues.length ? `## NEEDS ATTENTION\n\n${issues.map((i) => "- " + i).join("\n")}\n` : "All checks passed.\n");
if (notes.length) console.log(`## Notes\n\n${notes.map((n) => "- " + n).join("\n")}\n`);
console.log(`Checked ${urls.size} links.`);
