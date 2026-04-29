#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const golden = JSON.parse(await fs.readFile(path.join(root, 'golden_search.json'), 'utf8'));
const baseUrl = process.argv[2] || process.env.CACTUS_API_URL || 'https://cactus-worker.platformengineer.workers.dev';

let failures = 0;

function ok(condition, message) {
  if (condition) {
    console.log(`OK   ${message}`);
  } else {
    failures += 1;
    console.log(`FAIL ${message}`);
  }
}

async function search(query) {
  const response = await fetch(`${baseUrl}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${query}: ${response.status} ${JSON.stringify(body)}`);
  return body;
}

async function autocomplete(query) {
  const response = await fetch(`${baseUrl}/api/autocomplete?q=${encodeURIComponent(query)}`);
  const body = await response.json();
  if (!response.ok) throw new Error(`${query}: ${response.status} ${JSON.stringify(body)}`);
  return body;
}

console.log(`Golden search: ${golden.version}`);
console.log(`API: ${baseUrl}`);
console.log('');

for (const test of golden.cases) {
  const data = await search(test.query);
  const games = data.games || [];
  const top = games[0];
  const topNames = games.slice(0, 3).map(game => game.nome);
  const prefix = `"${test.query}"`;

  if (test.top1) ok(top?.nome === test.top1, `${prefix} top1 = ${test.top1} (got ${top?.nome || 'none'})`);
  if (test.top3Any) ok(topNames.some(name => test.top3Any.includes(name)), `${prefix} top3 contains one of ${test.top3Any.join(', ')}`);
  if (test.category) ok(top?.categoria === test.category, `${prefix} top category = ${test.category} (got ${top?.categoria || 'none'})`);
  if (test.top3Category) ok(games.slice(0, 3).some(game => game.categoria === test.top3Category), `${prefix} top3 has category ${test.top3Category}`);
  if (test.correctedQuery) ok(data.correctedQuery === test.correctedQuery, `${prefix} correctedQuery = ${test.correctedQuery} (got ${data.correctedQuery || 'none'})`);
  if (test.methods) {
    const methods = data.searchMethods || [];
    ok(test.methods.every(method => methods.includes(method)), `${prefix} methods include ${test.methods.join(', ')} (got ${methods.join(', ')})`);
  }
  ok(Number(data.timing?.redisHybridMs || 0) < 100, `${prefix} Redis hybrid latency < 100ms (got ${data.timing?.redisHybridMs ?? 'n/a'}ms)`);
}

console.log('');

for (const test of golden.autocomplete || []) {
  const data = await autocomplete(test.query);
  const top = (data.suggestions || [])[0];
  const prefix = `autocomplete "${test.query}"`;
  if (test.topPayload) ok(top?.id_jogo === test.topPayload, `${prefix} payload = ${test.topPayload} (got ${top?.id_jogo || 'none'})`);
  if (test.topTextAny) ok(test.topTextAny.includes(top?.text), `${prefix} text in ${test.topTextAny.join(', ')} (got ${top?.text || 'none'})`);
  ok(Number(data.timing?.redisMs || 0) < 50, `${prefix} Redis latency < 50ms (got ${data.timing?.redisMs ?? 'n/a'}ms)`);
}

console.log('');
if (failures) {
  console.log(`${failures} golden checks failed.`);
  process.exit(1);
}

console.log('All golden checks passed.');
