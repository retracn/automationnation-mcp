// Runs the AutomationNation MCP server over stdio and calls each tool against the live Actors.
import { Actor } from 'apify';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

await Actor.init();
const { only = [], concurrency = 4 } = (await Actor.getInput()) ?? {};
const CASES = [
    ['search_flights', { origin: 'JFK', destination: 'LHR', max_results: 5 }],
    ['search_hotels', { location: 'Paris', max_results: 5 }],
    ['search_google_shopping', { query: 'wireless earbuds', max_results: 5 }],
    ['get_youtube_transcripts', { videos: ['https://www.youtube.com/watch?v=UF8uR6Z6KLc'], max_characters: 1500 }],
    ['search_google_news', { query: 'Apify', max_results: 5 }],
    ['search_google_images', { query: 'modern kitchen', max_results: 5 }],
    ['search_google_videos', { query: 'how to make sourdough bread', max_results: 5 }],
    ['search_jobs', { query: 'software engineer', location: 'New York', max_results: 5 }],
    ['get_google_trends', { terms: ['chatgpt', 'claude'], time_range: 'past_90_days' }],
    ['get_trending_searches', { country: 'US', max_results: 5 }],
    ['get_advertiser_ads', { advertiser: 'nike.com', max_results: 5 }],
    ['get_app_reviews', { app: 'com.spotify.music', max_reviews: 5 }],
    ['get_app_reviews', { app: '324684580', max_reviews: 5 }],
    ['analyze_app_reviews', { apps: ['https://apps.apple.com/us/app/duolingo-language-lessons/id570060128'], max_reviews_per_app: 20 }],
    ['check_ai_overview_citations', { queries: ['best crm for small business'], domain: 'hubspot.com' }],
    ['check_ai_visibility', { brand: 'Notion', domain: 'notion.so', prompts: ['What is the best note-taking app for teams?'], engines: ['claude'] }],
    ['find_local_businesses', { business_type: 'dentist', location: 'Austin, TX', max_results: 3 }],
    ['find_uk_business_leads', { business_type: 'plumber', cities: ['Leeds'], max_results: 3 }],
].filter(([name]) => !only.length || only.includes(name));

const client = new Client({ name: 'smoke', version: '1.0.0' });
await client.connect(new StdioClientTransport({ command: process.execPath, args: ['server/index.js'], env: { ...process.env } }));
const { tools } = await client.listTools();
console.log(`Server lists ${tools.length} tools`);

const results = [];
let next = 0;
async function worker() {
    while (next < CASES.length) {
        const [name, args] = CASES[next++];
        const t0 = Date.now();
        try {
            const res = await client.callTool({ name, arguments: args }, undefined, { timeout: 330_000, resetTimeoutOnProgress: true });
            const text = res.content?.[0]?.text ?? '';
            const lines = text.split('\n');
            let rows = null;
            try { rows = JSON.parse(lines.slice(2).join('\n')); } catch { /* error text */ }
            results.push({ name, args, ok: !res.isError && Array.isArray(rows) && rows.length > 0, secs: Math.round((Date.now() - t0) / 1000), summary: lines[0], run: lines[1], rows: Array.isArray(rows) ? rows.length : null, sample: Array.isArray(rows) ? rows.slice(0, 2) : text.slice(0, 600), chars: text.length });
        } catch (e) {
            results.push({ name, args, ok: false, secs: Math.round((Date.now() - t0) / 1000), error: String(e?.message ?? e) });
        }
        const r = results.at(-1);
        console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${name} ${r.secs}s ${r.summary ?? r.error ?? ''}`);
    }
}
await Promise.all(Array.from({ length: concurrency }, worker));
await client.close();
await Actor.pushData(results);
await Actor.setValue('OUTPUT', { ok: results.filter((r) => r.ok).length, total: results.length, failed: results.filter((r) => !r.ok).map((r) => r.name) });
await Actor.exit();
