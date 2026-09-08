/**
 * critic-comment.mjs — Section A critic, report-only.
 *
 * Reads the evidence the pipeline produced (verify-slice-<N>.json, gitleaks.json,
 * any screenshots) and the slice's own scope from slices.md, then posts ONE
 * comment on the merge request.
 *
 * It judges against the slice scope rather than against taste: the shadow run
 * needs to answer "did the critic catch anything real", and a critic that
 * editorialises makes that unanswerable.
 *
 * This runs in the ordinary branch pipeline, not a merge_request_event one, so
 * it finds its own MR by source branch. That is deliberate: the existing
 * lint/test/build jobs have no `rules`, so they never appear in an MR pipeline,
 * and a critic that ran there could not `needs:` the evidence it has to read.
 *
 * Posting needs a token that can write MR notes. CI_JOB_TOKEN cannot create
 * notes, so this reads CRITIC_TOKEN (a masked CI variable, Developer role —
 * plan item A1). Without it the comment is still written to the artifact and
 * the job succeeds: no token must never look like a clean review.
 *
 * ESM and dependency-free on purpose: package.json declares no "type", so a
 * .js file here would be CommonJS, and `require()` is a lint error in this repo.
 */

import fs from "node:fs";
import path from "node:path";

const REPO = path.resolve(import.meta.dirname, "..");
const OUT = path.join(REPO, "critic-comment.md");

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

/** The evidence file names itself by slice number; find whichever one exists. */
function findEvidence() {
  const hit = fs
    .readdirSync(REPO)
    .filter((f) => /^verify-slice-\d+\.json$/.test(f))
    .sort();
  if (hit.length === 0) return { file: null, report: null };
  return { file: hit[0], report: readJson(path.join(REPO, hit[0])) };
}

/** The scope line for slice N, straight out of slices.md. */
function sliceScope(n) {
  let text;
  try {
    text = fs.readFileSync(path.join(REPO, "slices.md"), "utf8");
  } catch {
    return null;
  }
  const lines = text.split("\n");
  const start = lines.findIndex((l) => new RegExp(`^${n}\\.\\s`).test(l.trim()));
  if (start === -1) return null;
  const scope = [lines[start].trim()];
  // Continuation lines are indented; the next numbered item ends the entry.
  for (let i = start + 1; i < lines.length; i++) {
    if (!/^\s+\S/.test(lines[i])) break;
    scope.push(lines[i].trim());
  }
  return scope.join(" ");
}

const secs = (n) => (typeof n === "number" ? `${(n / 1000).toFixed(1)}s` : "?");

const { file: evidenceFile, report } = findEvidence();
const slice = report?.slice ?? null;
const scope = slice === null ? null : sliceScope(slice);
const leaks = readJson(path.join(REPO, "gitleaks.json"));
const shotsDir = path.join(REPO, "screenshots");
const shots = fs.existsSync(shotsDir)
  ? fs.readdirSync(shotsDir).filter((f) => /\.png$/i.test(f))
  : [];

const out = [];
out.push("## Critic — report-only");
out.push("");
out.push(
  `Slice **${slice ?? "unknown"}** · commit \`${(report?.commit ?? "?").slice(0, 8)}\` · branch \`${report?.branch ?? "?"}\``,
);
out.push("");

out.push("**Scope this is judged against**");
out.push("");
out.push(
  scope
    ? `> ${scope}`
    : "> No matching entry in `slices.md`. The critic has nothing to judge against — either this is not a slice branch, or the slice was never written down.",
);
out.push("");

out.push("**Gate**");
out.push("");
if (!report) {
  out.push(
    `No \`verify-slice-*.json\` reached this job${evidenceFile ? "" : " (no evidence file was produced)"}. Treat everything below as unverified.`,
  );
} else {
  out.push("| check | result | time |");
  out.push("| --- | --- | --- |");
  for (const c of report.checks ?? []) {
    out.push(`| \`${c.name}\` | ${c.passed ? "pass" : `**FAIL** (exit ${c.exit_code})`} | ${secs(c.duration_ms)} |`);
  }
  out.push("");
  for (const c of (report.checks ?? []).filter((x) => !x.passed)) {
    out.push(`<details><summary>${c.name} output</summary>`);
    out.push("");
    out.push("```");
    out.push((c.output ?? "").trim() || "(no output captured)");
    out.push("```");
    out.push("");
    out.push("</details>");
    out.push("");
  }
}
out.push("");

out.push("**Secrets**");
out.push("");
if (leaks === null) {
  out.push("No `gitleaks.json` — the secrets job did not report. That is not the same as clean.");
} else if (Array.isArray(leaks) && leaks.length === 0) {
  out.push("gitleaks found nothing.");
} else {
  const found = Array.isArray(leaks) ? leaks : [leaks];
  out.push(`gitleaks reported **${found.length}** finding(s):`);
  out.push("");
  for (const f of found.slice(0, 20)) {
    out.push(`- \`${f.File ?? "?"}\`:${f.StartLine ?? "?"} — ${f.Description ?? f.RuleID ?? "match"}`);
  }
  out.push("");
  out.push("A secret that has already been pushed must be **rotated**, not deleted. Detection is not prevention.");
}
out.push("");

out.push("**Screenshots**");
out.push("");
out.push(shots.length ? shots.map((s) => `- \`screenshots/${s}\``).join("\n") : "None in this pipeline.");
out.push("");

out.push("---");
out.push("");
out.push(
  report?.passed === false || (Array.isArray(leaks) && leaks.length > 0)
    ? "**Verdict: something here needs a human.** Nothing is blocked — every Section A gate is report-only."
    : "**Verdict: nothing to flag from the evidence.** That is a statement about the gate, not about whether the slice is good.",
);

const body = `${out.join("\n")}\n`;
fs.writeFileSync(OUT, body);
console.log(`critic: comment written to ${path.relative(REPO, OUT)} (${body.length} bytes)`);

const token = process.env.CRITIC_TOKEN;
const api = process.env.CI_API_V4_URL;
const project = process.env.CI_PROJECT_ID;
const branch = process.env.CI_COMMIT_REF_NAME;

if (!token) {
  console.log(
    "critic: CRITIC_TOKEN is not set, so nothing was posted. The comment is in the job artifacts. " +
      "Create the Developer-role token (plan item A1) and add it as a masked CI variable to enable posting.",
  );
  process.exit(0);
}
if (!api || !project || !branch) {
  console.log("critic: not running in CI, so there is no merge request to comment on.");
  process.exit(0);
}

const headers = { "PRIVATE-TOKEN": token };

const found = await fetch(
  `${api}/projects/${project}/merge_requests?source_branch=${encodeURIComponent(branch)}&state=opened`,
  { headers },
).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`MR lookup ${r.status} ${r.statusText}`))));

if (!Array.isArray(found) || found.length === 0) {
  console.log(`critic: no open merge request with source branch '${branch}'. Comment is in the artifacts.`);
  process.exit(0);
}

const iid = found[0].iid;
const res = await fetch(`${api}/projects/${project}/merge_requests/${iid}/notes`, {
  method: "POST",
  headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify({ body }),
});

if (!res.ok) {
  // allow_failure is true, but a silent non-post is the failure mode that makes
  // a shadow run worthless. Say it loudly.
  console.error(`critic: POST failed ${res.status} ${res.statusText}: ${(await res.text()).slice(0, 500)}`);
  process.exit(1);
}
console.log(`critic: comment posted to MR !${iid}`);
