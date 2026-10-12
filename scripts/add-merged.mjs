#!/usr/bin/env node
// Add (or refresh) a merged upstream fix on the lit-dark site. No dependencies.
//
//   node scripts/add-merged.mjs <owner/repo> <pr> --light "job name" --dark "why it was dark" --fix "what the PR changed" \
//        [--dark-since ISO] [--dark-run URL] [--lit-run URL] [--note "..."]
//   node scripts/add-merged.mjs --render        # only regenerate docs/index.html from docs/merged.json
//
// Fetches the PR with `gh api`, refuses PRs that are not merged, finds (or verifies) a dark
// upstream run before the merge (--dark-run) and the first upstream run after it (--lit-run;
// auto-detected on the default branch when omitted), writes the entry to docs/merged.json
// (deduped by repo + pr), then rewrites the static "Merged fixes" section in docs/index.html
// between the merged:start/end markers. Until the after-merge run is lit, the page says
// "waiting for upstream light"; re-run later to refresh. Same flags and entry shape as
// fitzyracing1/patch-cloud add-merged.mjs.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = join(root, 'docs', 'merged.json');
const htmlPath = join(root, 'docs', 'index.html');
const START = '<!-- merged:start -->';
const END = '<!-- merged:end -->';

// ---- shared with fitzyracing1/lit-dark scripts/add-merged.mjs and fitzyracing1/patch-cloud add-merged.mjs ----
function die(msg) { console.error(`add-merged: ${msg}`); process.exit(1); }

const VALUE_FLAGS = ['dark', 'note', 'fix', 'light', 'dark-since', 'dark-run', 'lit-run'];
function parseArgs(argv) {
  const pos = []; const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--render') opts.render = true;
    else if (a === '--list') opts.list = true;
    else if (a === '--no-detect') opts.noDetect = true;
    else if (a.startsWith('--') && VALUE_FLAGS.includes(a.slice(2))) {
      if (i + 1 >= argv.length) die(`${a} needs a value`);
      opts[a.slice(2)] = argv[++i];
    } else if (a === '-h' || a === '--help') opts.help = true;
    else if (a.startsWith('--')) die(`unknown flag ${a}`);
    else pos.push(a);
  }
  return { pos, opts };
}

function gh(path) {
  try {
    return JSON.parse(execFileSync('gh', ['api', path], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 64 << 20 }));
  } catch { die(`gh api ${path} failed (is gh installed and authenticated?)`); }
}

const iso = (s) => (s ? new Date(s).toISOString().replace(/\.\d{3}Z$/, 'Z') : null);

/** Map a GitHub job/run conclusion to the light it shows. Only lit / dark / waiting leave this function. */
function lightOf(status, conclusion) {
  if (status && status !== 'completed') return 'waiting';
  if (conclusion === 'success') return 'lit';
  if (['failure', 'timed_out', 'startup_failure'].includes(conclusion)) return 'dark';
  return null; // skipped / cancelled / neutral: no light
}

function parseRunUrl(url, repo) {
  const m = /^https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/actions\/runs\/(\d+)/.exec(String(url || ''));
  if (!m) die(`bad run URL "${url}" (want https://github.com/owner/repo/actions/runs/N)`);
  if (m[1].toLowerCase() !== repo.toLowerCase()) die(`run ${url} is not in ${repo}`);
  return Number(m[2]);
}

/** Facts for one workflow run, restricted to jobs whose name contains `light` (when given). */
function runFacts(repo, id, light) {
  const r = gh(`repos/${repo}/actions/runs/${id}`);
  const jobs = gh(`repos/${repo}/actions/runs/${id}/jobs?per_page=100&filter=latest`).jobs || [];
  const picked = jobs.filter((j) => !light || j.name.includes(light))
    .map((j) => ({ name: j.name, light: lightOf(j.status, j.conclusion), url: j.html_url }))
    .filter((j) => j.light);
  let state;
  if (r.status !== 'completed' || picked.some((j) => j.light === 'waiting')) state = 'waiting';
  else if (light) state = !picked.length ? 'none' : picked.every((j) => j.light === 'lit') ? 'lit' : picked.some((j) => j.light === 'dark') ? 'dark' : 'waiting';
  else state = lightOf(r.status, r.conclusion) || 'none';
  return {
    id: r.id, url: r.html_url, workflow: r.name, branch: r.head_branch, headSha: r.head_sha,
    createdAt: iso(r.created_at), state,
    jobs: picked.map((j) => ({ name: j.name, light: j.light, url: j.url })),
  };
}

function defaultBranch(repo) { return gh(`repos/${repo}`).default_branch; }

/** Last run on the default branch before the merge where the light was dark. */
function detectDarkRun(repo, branch, mergedAt, light) {
  const runs = (gh(`repos/${repo}/actions/runs?branch=${encodeURIComponent(branch)}&per_page=50&created=${encodeURIComponent('<' + mergedAt)}`).workflow_runs || [])
    .filter((r) => r.conclusion && r.conclusion !== 'cancelled' && r.conclusion !== 'skipped');
  for (const r of runs.slice(0, 15)) {
    const f = runFacts(repo, r.id, light);
    if (f.state === 'dark') return f;
  }
  return null;
}

/** First run on the default branch after the merge that has the light; `waiting` when none has finished yet. */
function detectLitRun(repo, branch, mergedAt, mergeSha, light) {
  const runs = (gh(`repos/${repo}/actions/runs?branch=${encodeURIComponent(branch)}&per_page=50&created=${encodeURIComponent('>=' + mergedAt)}`).workflow_runs || [])
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const ordered = [...runs.filter((r) => r.head_sha === mergeSha), ...runs.filter((r) => r.head_sha !== mergeSha)];
  for (const r of ordered.slice(0, 15)) {
    const f = runFacts(repo, r.id, light);
    if (f.state !== 'none') return f;
  }
  return null;
}

/** Fetch PR + before/after facts; returns the merged.json entry (prev keeps hand-written text). */
function buildEntry(repo, pr, opts, prev = {}) {
  const p = gh(`repos/${repo}/pulls/${pr}`);
  if (!p.merged || !p.merged_at) die(`${repo}#${pr} is not merged (state: ${p.state}); only merged fixes are listed`);
  const fullRepo = p.base?.repo?.full_name || repo;
  const mergedAt = iso(p.merged_at);
  const branch = p.base?.repo?.default_branch || defaultBranch(fullRepo);
  const light = opts.light ?? prev.light ?? '';

  let darkRun = null;
  const darkUrl = opts['dark-run'] ?? prev.darkRun?.url;
  if (darkUrl) {
    darkRun = runFacts(fullRepo, parseRunUrl(darkUrl, fullRepo), light);
    if (darkRun.createdAt > mergedAt) die(`--dark-run ${darkUrl} started after the merge`);
    if (darkRun.state !== 'dark') die(`--dark-run ${darkUrl}: ${light || 'run'} is ${darkRun.state}, not dark`);
  } else if (!opts.noDetect) darkRun = detectDarkRun(fullRepo, branch, mergedAt, light);

  let litRun = null;
  const litUrl = opts['lit-run'] ?? (prev.litRun?.state === 'lit' ? prev.litRun.url : null);
  if (litUrl) {
    litRun = runFacts(fullRepo, parseRunUrl(litUrl, fullRepo), light);
    if (litRun.createdAt < mergedAt) die(`--lit-run ${litUrl} started before the merge`);
  } else if (!opts.noDetect) litRun = detectLitRun(fullRepo, branch, mergedAt, p.merge_commit_sha, light);
  if (litRun && litRun.state !== 'lit') console.log(`note: after-merge run ${litRun.url} is ${litRun.state}; page will say "waiting for upstream light"`);
  if (!litRun) console.log('note: no finished run after the merge yet; page will say "waiting for upstream light"');

  return {
    repo: fullRepo,
    pr,
    title: p.title,
    url: p.html_url,
    mergedAt,
    mergedBy: p.merged_by?.login || '',
    branch,
    light,
    darkSince: opts['dark-since'] ?? prev.darkSince ?? '',
    darkBefore: opts.dark ?? prev.darkBefore ?? '',
    fix: opts.fix ?? prev.fix ?? '',
    darkRun,
    litRun: litRun || { state: 'waiting' },
    verifiedAt: iso(new Date()),
    note: opts.note ?? prev.note ?? '',
  };
}

function upsert(entries, entry) {
  const key = (x) => `${String(x.repo).toLowerCase()}#${x.pr}`;
  const i = entries.findIndex((x) => key(x) === key(entry));
  if (i >= 0) entries[i] = entry; else entries.push(entry);
  entries.sort((a, b) => String(b.mergedAt).localeCompare(String(a.mergedAt)));
  return i >= 0 ? 'updated' : 'added';
}

const USAGE = `usage: add-merged.mjs <owner/repo> <pr> [--light "job name"] [--dark "why it was dark"] [--dark-since ISO]
                      [--fix "what the PR changed"] [--dark-run URL] [--lit-run URL] [--note "..."] [--no-detect]
  --light      substring of the upstream job name that is the light (e.g. test-mysql57-s3-nfs); omit to use the whole run
  --dark-run   a dark upstream run before the merge (default: newest dark run on the default branch before mergedAt)
  --lit-run    the first upstream run after the merge (default: auto-detected; shown as "waiting for upstream light" until lit)
Re-running for the same repo#pr updates it in place (dedupe) and keeps earlier text unless new values are passed.`;
// ---- end shared ----

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtET = (s, withTime = true) => {
  const t = Date.parse(s || '');
  if (!Number.isFinite(t)) return '';
  const o = { timeZone: 'America/New_York', year: 'numeric', month: 'short', day: 'numeric' };
  if (withTime) Object.assign(o, { hour: 'numeric', minute: '2-digit' });
  return new Intl.DateTimeFormat('en-US', o).format(new Date(t)) + (withTime ? ' ET' : '');
};

function loadData() {
  if (!existsSync(dataPath)) return [];
  const d = JSON.parse(readFileSync(dataPath, 'utf8'));
  if (!Array.isArray(d)) die('docs/merged.json must be an array');
  return d;
}

function render(entries) {
  const sorted = [...entries].sort((a, b) => String(b.mergedAt).localeCompare(String(a.mergedAt)));
  const run = (r) => `<a href="${esc(r.url)}">${esc(r.workflow || 'CI')} ${esc(r.id)}</a> (${esc(fmtET(r.createdAt))})`;
  const items = sorted.map((e) => {
    const light = e.light || 'CI';
    const dr = e.darkRun && e.darkRun.url ? e.darkRun : null;
    const lr = e.litRun && e.litRun.url ? e.litRun : null;
    const isLit = !!lr && lr.state === 'lit';
    const nJobs = (r, l) => (r.jobs || []).filter((j) => j.light === l).length;
    const before = `<code>${esc(light)}</code> was <strong>dark</strong>${e.branch ? ` on ${esc(e.branch)}` : ''}${e.darkSince ? ` since ${esc(fmtET(e.darkSince, false))}` : ''}. ${esc(e.darkBefore || '')}`
      + (dr ? ` Dark run before the fix: ${run(dr)}${(dr.jobs || []).length ? `, ${nJobs(dr, 'dark')} of ${dr.jobs.length} ${esc(light)} jobs dark` : ''}.` : '');
    const after = isLit
      ? `<strong>lit upstream now.</strong> First ${esc(e.branch || 'default-branch')} run after the merge: ${run(lr)}${(lr.jobs || []).length ? `, ${nJobs(lr, 'lit')} of ${lr.jobs.length} ${esc(light)} jobs lit` : ''}.`
      : `<strong>waiting for upstream light</strong>${lr ? ` — latest run after the merge: ${run(lr)}` : ' — no upstream run has finished since the merge'}.`;
    const lamp = isLit
      ? '<span class="merged-lamp" aria-hidden="true">●</span> lit'
      : '<span class="merged-lamp waiting" aria-hidden="true">○</span> waiting for upstream light';
    return `      <li class="merged-item">
        <div class="merged-head">${lamp} · <a href="${esc(e.url)}">${esc(e.repo)}#${esc(e.pr)}</a> — ${esc(e.title)}</div>
        <div class="merged-meta">Merged <time datetime="${esc(e.mergedAt)}">${esc(fmtET(e.mergedAt))}</time> by <a href="https://github.com/${esc(e.mergedBy)}">@${esc(e.mergedBy)}</a> in <a href="https://github.com/${esc(e.repo)}">${esc(e.repo)}</a></div>
        <p><strong>Before:</strong> ${before}</p>
        <p><strong>Fix:</strong> ${esc(e.fix || '—')}</p>
        <p><strong>After:</strong> ${after}</p>${e.note ? `\n        <p class="muted">${esc(e.note)}</p>` : ''}
      </li>`;
  }).join('\n');
  const body = sorted.length
    ? `    <ul class="merged">\n${items}\n    </ul>`
    : `    <p class="muted">No merged fixes recorded yet.</p>`;
  return `${START}
    <section id="merged">
    <h2>Merged fixes</h2>
    <p>Each entry is an upstream pull request, merged by the project’s maintainers, that took a light that was <strong>dark</strong> and made it <strong>lit</strong> upstream. <em>Before</em> links a dark upstream run, <em>After</em> links the first upstream run after the merge; both are checked with the GitHub API. Data: <a href="merged.json">merged.json</a>.</p>
${body}
    </section>
    ${END}`;
}

function writeHtml(entries) {
  const html = readFileSync(htmlPath, 'utf8');
  const s = html.indexOf(START), e = html.indexOf(END);
  if (s < 0 || e < s) die(`markers ${START} / ${END} not found in docs/index.html`);
  writeFileSync(htmlPath, html.slice(0, s) + render(entries) + html.slice(e + END.length));
}

const { pos, opts } = parseArgs(process.argv.slice(2));
if (opts.help || (!opts.render && pos.length !== 2)) {
  console.error(USAGE.replace('add-merged.mjs', 'node scripts/add-merged.mjs') + '\n       node scripts/add-merged.mjs --render');
  process.exit(opts.help ? 0 : 2);
}

const entries = loadData();
if (!opts.render) {
  const repo = pos[0].replace(/^https:\/\/github\.com\//, '').replace(/\/$/, '');
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) die(`bad repo "${pos[0]}" (want owner/repo)`);
  const pr = Number(String(pos[1]).replace(/^#/, ''));
  if (!Number.isInteger(pr) || pr <= 0) die(`bad PR number "${pos[1]}"`);
  const prev = entries.find((x) => `${x.repo}#${x.pr}`.toLowerCase() === `${repo}#${pr}`.toLowerCase()) || {};
  const entry = buildEntry(repo, pr, opts, prev);
  const how = upsert(entries, entry);
  writeFileSync(dataPath, JSON.stringify(entries, null, 2) + '\n');
  console.log(`${how} ${entry.repo}#${pr} — ${entry.title} (merged ${entry.mergedAt} by ${entry.mergedBy})`);
  console.log(`  before: ${entry.darkRun ? `${entry.darkRun.state} ${entry.darkRun.url}` : 'no dark run found (pass --dark-run)'}`);
  console.log(`  after:  ${entry.litRun.url ? `${entry.litRun.state} ${entry.litRun.url}` : 'waiting for upstream light'}`);
  for (const [k, f] of [['darkBefore', '--dark'], ['fix', '--fix'], ['light', '--light']]) if (!entry[k]) console.log(`tip: pass ${f} to fill in ${k}`);
}
writeHtml(entries);
console.log(`rendered ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} into docs/index.html`);
