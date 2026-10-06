// End-to-end tests over stdio against a mock Apify API: tool listing without a token,
// input mapping, spending caps, polling and result shaping.
import { after, afterEach, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const calls = [];
let polls = 0;
const ROWS = {
    'automationnation~google-flights-scraper': [
        { price: 412, currency: 'USD', isBest: true, airlines: ['British Airways'], flightNumbers: ['BA 117'], fromAirport: 'JFK', toAirport: 'LHR', departure: '2026-11-12T18:30', arrival: '2026-11-13T06:40', duration: '7 hr 10 min', stops: 0, legs: [{ big: 'x' }], departureDate: '2026-11-12', googleFlightsUrl: 'https://www.google.com/travel/flights?q=x', scrapedAt: 'now' },
        { price: 389, currency: 'USD', isBest: false, airlines: ['Norse Atlantic'], stops: 0, departureDate: '2026-11-12' },
    ],
    'automationnation~youtube-transcript-scraper': [
        { videoId: 'abc', title: 'Talk', status: 'ok', transcript: 'hello world '.repeat(500), segments: [{ start: 0, text: 'hello' }, { start: 75.4, text: 'world' }], wordCount: 1000, thumbnail: 'x' },
    ],
};

const mock = createServer(async (req, res) => {
    const url = new URL(req.url.replace(/^\/v2/, ''), 'http://x');
    let body = '';
    for await (const c of req) body += c;
    calls.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), body: body ? JSON.parse(body) : undefined, auth: req.headers.authorization });
    const send = (status, json) => res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(json));
    const start = url.pathname.match(/^\/acts\/([^/]+)\/runs$/);
    if (start) return send(201, { data: { id: `run-${start[1]}`, status: 'RUNNING', defaultDatasetId: `ds-${start[1]}`, startedAt: new Date().toISOString() } });
    const run = url.pathname.match(/^\/actor-runs\/run-(.+)$/);
    if (run) {
        polls += 1;
        return send(200, { data: { id: `run-${run[1]}`, status: 'SUCCEEDED', defaultDatasetId: `ds-${run[1]}`, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString() } });
    }
    if (url.pathname === '/cse/customsearch/v1') {
        const start = Number(url.searchParams.get('start'));
        const num = Number(url.searchParams.get('num'));
        return send(200, { kind: 'customsearch#search', items: Array.from({ length: num }, (_, i) => ({ kind: 'customsearch#result', title: `Result ${start + i}`, link: `https://example.com/${start + i}`, displayLink: 'example.com', snippet: 's'.repeat(400), htmlSnippet: 'x' })) });
    }
    const ds = url.pathname.match(/^\/datasets\/ds-(.+)\/items$/);
    if (ds) return send(200, ROWS[ds[1]] ?? []);
    return send(404, { error: { type: 'record-not-found', message: 'nope' } });
});

let base;
before(async () => {
    await new Promise((r) => mock.listen(0, r));
    base = `http://127.0.0.1:${mock.address().port}`;
});
after(() => {
    mock.closeAllConnections();
    mock.close();
});

const open = new Set();
afterEach(async () => {
    for (const c of open) await c.close().catch(() => {});
    open.clear();
});

async function connect(env) {
    const client = new Client({ name: 'test', version: '1.0.0' });
    open.add(client);
    await client.connect(new StdioClientTransport({ command: process.execPath, args: ['src/index.js'], env: { PATH: process.env.PATH, APIFY_API_BASE_URL: base, AUTOMATIONNATION_CSE_URL: `${base}/cse/customsearch/v1`, ...env } }));
    return client;
}

test('lists every tool without a token and explains how to add one', async () => {
    const client = await connect({});
    const { tools } = await client.listTools();
    assert.equal(tools.length, 19);
    for (const t of tools) {
        assert.ok(t.description.length > 80, `${t.name} has a real description`);
        assert.equal(t.annotations.readOnlyHint, true);
    }
    const res = await client.callTool({ name: 'search_flights', arguments: { origin: 'JFK', destination: 'LHR' } });
    assert.equal(res.isError, true);
    assert.match(res.content[0].text, /APIFY_TOKEN/);
});

test('toolsets limit the tools', async () => {
    const client = await connect({ AUTOMATIONNATION_TOOLS: 'travel' });
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), ['get_run_results', 'search_flights', 'search_hotels']);
});

test('search_flights maps input, caps spend and shapes rows', async () => {
    calls.length = 0;
    const client = await connect({ APIFY_TOKEN: 'test-token' });
    const res = await client.callTool({ name: 'search_flights', arguments: { origin: 'JFK', destination: 'LHR', departure_date: '2026-11-12', cabin_class: 'premium_economy', stops: 'one_stop_or_fewer', max_results: 5 } });
    assert.ok(!res.isError, res.content[0].text);
    const start = calls.find((c) => c.method === 'POST');
    assert.equal(start.path, '/acts/automationnation~google-flights-scraper/runs');
    assert.equal(start.auth, 'Bearer test-token');
    assert.equal(start.query.maxItems, '5');
    assert.equal(start.query.maxTotalChargeUsd, '0.25');
    assert.deepEqual(start.body, { origin: 'JFK', destination: 'LHR', departureDate: '2026-11-12', adults: 1, cabinClass: 'premiumEconomy', stops: 'oneStop', currency: 'USD', country: 'us', maxFlightsPerSearch: 5 });
    const [head, runLine, json] = res.content[0].text.split('\n');
    assert.match(head, /^2 flights JFK → LHR departing 2026-11-12\. Google Flights: https/);
    assert.match(runLine, /console\.apify\.com\/view\/runs\/run-automationnation~google-flights-scraper \(SUCCEEDED/);
    const rows = JSON.parse(json);
    assert.equal(rows[0].price, 412);
    assert.equal(rows[0].legs, undefined, 'verbose fields are dropped');
    assert.equal(rows[0].scrapedAt, undefined);
});

test('transcripts honour timestamps and the character limit', async () => {
    const client = await connect({ APIFY_TOKEN: 'test-token' });
    const res = await client.callTool({ name: 'get_youtube_transcripts', arguments: { videos: ['https://youtu.be/abc12345678'], include_timestamps: true, max_characters: 1000 } });
    const rows = JSON.parse(res.content[0].text.split('\n').slice(2).join('\n'));
    assert.equal(rows[0].transcript, '[0:00] hello\n[1:15] world');
    const plain = await client.callTool({ name: 'get_youtube_transcripts', arguments: { videos: ['abc12345678'], max_characters: 1000 } });
    const prow = JSON.parse(plain.content[0].text.split('\n').slice(2).join('\n'))[0];
    assert.ok(prow.transcript.length <= 1001);
});

test('UK leads need a city or postcode; Actor defaults are overridden', async () => {
    calls.length = 0;
    const client = await connect({ APIFY_TOKEN: 'test-token' });
    const bad = await client.callTool({ name: 'find_uk_business_leads', arguments: { business_type: 'plumber' } });
    assert.equal(bad.isError, true);
    await client.callTool({ name: 'find_uk_business_leads', arguments: { business_type: 'plumber', postcodes: ['M1 1AA'] } });
    assert.deepEqual(calls.find((c) => c.method === 'POST').body.cities, [], 'the demo default (London) must not apply');
    calls.length = 0;
    await client.callTool({ name: 'check_ai_visibility', arguments: { brand: 'Acme', prompts: ['What is the best anvil brand?'] } });
    const vis = calls.find((c) => c.method === 'POST').body;
    assert.deepEqual(vis.competitors, []);
    assert.equal(vis.domain, '');
    assert.equal(vis.generateReport, false);
    calls.length = 0;
    await client.callTool({ name: 'analyze_app_reviews', arguments: { apps: ['https://apps.apple.com/us/app/x/id1', '363590051', 'com.spotify.music', 'Duolingo'] } });
    const miner = calls.find((c) => c.method === 'POST').body;
    assert.deepEqual([miner.appUrls.length, miner.appleAppIds, miner.googlePlayIds, miner.appNames], [1, ['363590051'], ['com.spotify.music'], ['Duolingo']]);
    calls.length = 0;
    await client.callTool({ name: 'get_app_reviews', arguments: { app: 'com.spotify.music' } });
    assert.equal(calls.find((c) => c.method === 'POST').path, '/acts/automationnation~google-play-reviews-scraper/runs');
});

test('search_google calls the Custom Search endpoint page by page, with the token', async () => {
    calls.length = 0;
    const client = await connect({ APIFY_TOKEN: 'test-token' });
    const res = await client.callTool({ name: 'search_google', arguments: { query: 'best crm', site: 'reddit.com', time: 'month', max_results: 15 } });
    assert.ok(!res.isError, res.content[0].text);
    const reqs = calls.filter((c) => c.path === '/cse/customsearch/v1').sort((x, y) => Number(x.query.start) - Number(y.query.start));
    assert.deepEqual(reqs.map((c) => [c.query.start, c.query.num]), [['1', '10'], ['11', '5']]);
    assert.equal(reqs[0].auth, 'Bearer test-token');
    assert.deepEqual([reqs[0].query.q, reqs[0].query.siteSearch, reqs[0].query.dateRestrict, reqs[0].query.gl], ['best crm', 'reddit.com', 'm1', 'us']);
    assert.equal(calls.filter((c) => c.method === 'POST').length, 0, 'no Actor run is started');
    const [head, served, json] = res.content[0].text.split('\n');
    assert.match(head, /^15 Google results for "best crm" on reddit\.com\./);
    assert.match(served, /google-custom-search-api/);
    const rows = JSON.parse(json);
    assert.deepEqual([rows[0].position, rows[14].position, rows[14].title], [1, 15, 'Result 15']);
    assert.ok(rows[0].snippet.length <= 301);
    assert.equal(rows[0].htmlSnippet, undefined);
});

test('API errors come back as readable tool errors', async () => {
    const client = await connect({ APIFY_TOKEN: 'test-token' });
    const res = await client.callTool({ name: 'get_run_results', arguments: { run_id: 'missing-run' } });
    assert.equal(res.isError, true);
    assert.match(res.content[0].text, /couldn't find/);
});

test('HTTP mode: readiness probe, token-free listing and per-request tokens', async () => {
    const { spawn } = await import('node:child_process');
    const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
    const port = 40000 + Math.floor(Math.random() * 10000);
    const child = spawn(process.execPath, ['src/index.js', '--http', '--port', String(port)], { env: { PATH: process.env.PATH, APIFY_API_BASE_URL: base, APIFY_TOKEN: 'must-not-be-used' }, stdio: 'ignore' });
    try {
        let up = false;
        for (let i = 0; i < 50 && !up; i++) {
            await new Promise((r) => setTimeout(r, 100));
            up = await fetch(`http://127.0.0.1:${port}/`, { headers: { 'x-apify-container-server-readiness-probe': '1' } }).then((r) => r.ok).catch(() => false);
        }
        assert.ok(up, 'readiness probe answers 200');
        const anon = new Client({ name: 'http-test', version: '1.0.0' });
        await anon.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp?tools=travel`)));
        const { tools } = await anon.listTools();
        assert.deepEqual(tools.map((t) => t.name).sort(), ['get_run_results', 'search_flights', 'search_hotels']);
        const noToken = await anon.callTool({ name: 'search_flights', arguments: { origin: 'JFK', destination: 'LHR' } });
        assert.equal(noToken.isError, true, 'a self-hosted server never falls back to its own APIFY_TOKEN');
        await anon.close();
        calls.length = 0;
        const user = new Client({ name: 'http-test', version: '1.0.0' });
        await user.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), { requestInit: { headers: { Authorization: 'Bearer user-token' } } }));
        const res = await user.callTool({ name: 'search_flights', arguments: { origin: 'JFK', destination: 'LHR', max_results: 2 } });
        assert.ok(!res.isError, res.content[0].text);
        assert.equal(calls.find((c) => c.method === 'POST').auth, 'Bearer user-token');
        await user.close();
    } finally {
        child.kill();
    }
});
