#!/usr/bin/env node
// Snip CLI: a zero-dependency terminal client for the Snip backend.
'use strict';

const { spawn } = require('node:child_process');

const API = (process.env.SNIP_API || 'http://localhost:3000').replace(/\/+$/, '');

const USAGE = `snip - tiny URL shortener CLI

Usage:
  snip add <url>    shorten a URL and print the short link
  snip ls           list all links
  snip open <code>  open a short link in your browser
  snip help         show this help

Backend: ${API} (set SNIP_API to change)`;

function fail(message) {
  console.error(`snip: ${message}`);
  process.exit(1);
}

async function request(path, options) {
  try {
    return await fetch(API + path, options);
  } catch {
    fail(`could not reach the backend at ${API}`);
  }
}

async function readError(res) {
  try {
    const body = await res.json();
    if (body && typeof body.error === 'string') return body.error;
  } catch {}
  return `request failed (${res.status})`;
}

async function add(url) {
  if (!url) fail('missing URL. Usage: snip add <url>');
  const res = await request('/api/links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) fail(await readError(res));
  const link = await res.json();
  console.log(link.shortUrl);
}

async function ls() {
  const res = await request('/api/links');
  if (!res.ok) fail(await readError(res));
  const links = await res.json();
  if (links.length === 0) {
    console.log('No links yet.');
    return;
  }
  const rows = [['CODE', 'HITS', 'URL'], ...links.map((l) => [l.code, String(l.hits), l.url])];
  const codeWidth = Math.max(...rows.map((r) => r[0].length));
  const hitsWidth = Math.max(...rows.map((r) => r[1].length));
  for (const [code, hits, url] of rows) {
    console.log(`${code.padEnd(codeWidth)}  ${hits.padStart(hitsWidth)}  ${url}`);
  }
}

function openInBrowser(target) {
  const [cmd, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '""', `"${target}"`]]
      : process.platform === 'darwin'
        ? ['open', [target]]
        : ['xdg-open', [target]];
  // Verbatim args keep cmd from splitting URLs that contain & on Windows.
  const child = spawn(cmd, args, { stdio: 'ignore', detached: true, windowsVerbatimArguments: true });
  child.on('error', () => fail(`could not open a browser; visit ${target}`));
  child.unref();
}

async function open(code) {
  if (!code) fail('missing code. Usage: snip open <code>');
  const res = await request(`/${encodeURIComponent(code)}`, { redirect: 'manual' });
  const location = res.headers.get('location');
  if (res.status === 404) fail(`unknown code: ${code}`);
  if (res.status < 300 || res.status >= 400 || !location) fail(`unexpected response (${res.status})`);
  console.log(`Opening ${location}`);
  openInBrowser(location);
}

async function main() {
  const [command, arg] = process.argv.slice(2);
  switch (command) {
    case 'add':
      return add(arg);
    case 'ls':
      return ls();
    case 'open':
      return open(arg);
    case undefined:
    case 'help':
    case '-h':
    case '--help':
      console.log(USAGE);
      return;
    default:
      console.error(USAGE);
      fail(`unknown command: ${command}`);
  }
}

main();
