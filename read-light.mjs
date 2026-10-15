#!/usr/bin/env node
// read-light.mjs — read one repo's latest completed push-triggered Actions run
// and print lit/dark + the active-low bit. Node 18+. Uses @fitzyracing1/light-core.
//
//   node read-light.mjs [owner/repo]
//   node read-light.mjs fitzyracing1/lit-dark
//
// Map once (light-core lightOf): conclusion === "success" → lit (bit 0); anything else → dark (bit 1).
// No completed push run → error (exit 1), not dark.
import process from 'node:process';
import { createGitHub, readLatestPushLight, lamp, toBit } from '@fitzyracing1/light-core';

const repo = process.argv[2] || 'fitzyracing1/lit-dark';
if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
  console.error('Usage: node read-light.mjs [owner/repo]');
  process.exit(2);
}

const gh = createGitHub({ token: process.env.GITHUB_TOKEN, userAgent: 'lit-dark-reader' });
let read;
try {
  read = await readLatestPushLight(gh, repo);
} catch (e) {
  // No run is an error, never dark (SPEC). HTTP and rate-limit failures are errors too.
  console.error(`${repo}: ${e.message}`);
  process.exit(1);
}

const { light, conclusion, workflow, url, at } = read;
console.log(`${lamp(light)} ${light}  bit=${toBit(light)}  ${repo}`);
console.log(`  conclusion: ${conclusion}`);
console.log(`  workflow:   ${workflow}`);
console.log(`  run:        ${url}`);
console.log(`  at:         ${at}`);
