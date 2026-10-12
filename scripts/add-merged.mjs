#!/usr/bin/env node
// Add (or refresh) a merged upstream fix on the lit-dark site. No dependencies.
//
//   node scripts/add-merged.mjs <owner/repo> <pr> [--dark "what light was dark"] [--note "..."]
//   node scripts/add-merged.mjs --render        # only regenerate docs/index.html from docs/merged.json
//
// Fetches the PR with `gh api`, requires it to be merged, appends or updates the
// entry in docs/merged.json (deduped by repo + pr), then rewrites the static
// "Merged fixes" section in docs/index.html between the merged:start/end markers.
// Existing darkBefore / note values are kept unless new ones are passed.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = join(root, 'docs', 'merged.json');
const htmlPath = join(root, 'docs', 'index.html');
const START = '<!-- merged:start -->';
const END = '<!-- merged:end -->';

function die(msg) { console.error(`add-merged: ${msg}`); process.exit(1); }

function parseArgs(argv) {
  const pos = []; const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--render') opts.render = true;
    else if (a === '--dark' || a === '--note') {
      if (i + 1 >= argv.length) die(`${a} needs a value`);
      opts[a.slice(2)] = argv[++i];
    } else if (a === '-h' || a === '--help') opts.help = true;
    else pos.push(a);
  }
  return { pos, opts };
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function loadData() {
  if (!existsSync(dataPath)) return [];
  const d = JSON.parse(readFileSync(dataPath, 'utf8'));
  if (!Array.isArray(d)) die('docs/merged.json must be an array');
  return d;
}

function render(entries) {
  const sorted = [...entries].sort((a, b) => String(b.mergedAt).localeCompare(String(a.mergedAt)));
  const items = sorted.map((e) => {
    const day = String(e.mergedAt).slice(0, 10);
    return `      <li class="merged-item">
        <div class="merged-head"><span class="merged-lamp" aria-hidden="true">●</span> <a href="${esc(e.url)}">${esc(e.repo)}#${esc(e.pr)}</a> — ${esc(e.title)}</div>
        <div class="merged-meta">Merged <time datetime="${esc(e.mergedAt)}">${esc(day)}</time> by <a href="https://github.com/${esc(e.mergedBy)}">@${esc(e.mergedBy)}</a></div>
        <p><strong>Was dark:</strong> ${esc(e.darkBefore || '—')}</p>${e.note ? `\n        <p class="muted">${esc(e.note)}</p>` : ''}
      </li>`;
  }).join('\n');
  const body = sorted.length
    ? `    <ul class="merged">\n${items}\n    </ul>`
    : `    <p class="muted">No merged fixes recorded yet.</p>`;
  return `${START}
    <section id="merged">
    <h2>Merged fixes</h2>
    <p>Each entry is an upstream pull request, merged by the project’s maintainers, that took a light that was <strong>dark</strong> and made it <strong>lit</strong> upstream. Data: <a href="merged.json">merged.json</a>.</p>
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
  console.error('usage: node scripts/add-merged.mjs <owner/repo> <pr> [--dark "..."] [--note "..."]\n       node scripts/add-merged.mjs --render');
  process.exit(opts.help ? 0 : 2);
}

const entries = loadData();
if (!opts.render) {
  const [repoArg, prArg] = pos;
  const repo = repoArg.replace(/^https:\/\/github\.com\//, '').replace(/\/$/, '');
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) die(`bad repo "${repoArg}" (want owner/repo)`);
  const pr = Number(String(prArg).replace(/^#/, ''));
  if (!Number.isInteger(pr) || pr <= 0) die(`bad PR number "${prArg}"`);

  let p;
  try {
    p = JSON.parse(execFileSync('gh', ['api', `repos/${repo}/pulls/${pr}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }));
  } catch { die(`gh api repos/${repo}/pulls/${pr} failed (is gh installed and authenticated?)`); }
  if (!p.merged || !p.merged_at) die(`${repo}#${pr} is not merged (state: ${p.state}); only merged fixes are listed`);

  const key = (x) => `${String(x.repo).toLowerCase()}#${x.pr}`;
  const i = entries.findIndex((x) => key(x) === key({ repo, pr }));
  const prev = i >= 0 ? entries[i] : {};
  const entry = {
    repo: p.base?.repo?.full_name || repo,
    pr,
    title: p.title,
    url: p.html_url,
    mergedAt: new Date(p.merged_at).toISOString().replace('.000Z', 'Z'),
    mergedBy: p.merged_by?.login || '',
    darkBefore: opts.dark ?? prev.darkBefore ?? '',
    note: opts.note ?? prev.note ?? '',
  };
  if (i >= 0) entries[i] = entry; else entries.push(entry);
  entries.sort((a, b) => String(b.mergedAt).localeCompare(String(a.mergedAt)));
  writeFileSync(dataPath, JSON.stringify(entries, null, 2) + '\n');
  console.log(`${i >= 0 ? 'updated' : 'added'} ${entry.repo}#${pr} — ${entry.title} (merged ${entry.mergedAt} by ${entry.mergedBy})`);
  if (!entry.darkBefore) console.log('tip: re-run with --dark "what light was dark" to describe it');
}
writeHtml(entries);
console.log(`rendered ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} into docs/index.html`);
