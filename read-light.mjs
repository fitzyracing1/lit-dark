#!/usr/bin/env node
// read-light.mjs — read one repo's latest completed push-triggered Actions run
// and print lit/dark + the active-low bit. No dependencies. Node 18+.
//
//   node read-light.mjs [owner/repo]
//   node read-light.mjs fitzyracing1/lit-dark
//
// Map once: conclusion === "success" → lit (bit 0); anything else → dark (bit 1).
import process from 'node:process';

const repo = process.argv[2] || 'fitzyracing1/lit-dark';
if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
  console.error('Usage: node read-light.mjs [owner/repo]');
  process.exit(2);
}

const url = `https://api.github.com/repos/${repo}/actions/runs?per_page=1&status=completed&event=push`;
const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'lit-dark-reader',
  'X-GitHub-Api-Version': '2022-11-28',
};
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

const res = await fetch(url, { headers });
if (!res.ok) {
  console.error(`${repo}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  process.exit(1);
}
const data = await res.json();
const run = data.workflow_runs && data.workflow_runs[0];
if (!run) {
  console.error(`${repo}: no completed push workflow runs yet`);
  process.exit(1);
}

const lit = run.conclusion === 'success';
const bit = lit ? 0 : 1;
const lamp = lit ? '●' : '○';
const state = lit ? 'lit' : 'dark';

console.log(`${lamp} ${state}  bit=${bit}  ${repo}`);
console.log(`  conclusion: ${run.conclusion}`);
console.log(`  workflow:   ${run.name}`);
console.log(`  run:        ${run.html_url}`);
console.log(`  at:         ${run.updated_at}`);
