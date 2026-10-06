// Writes README.md from the tool definitions, toolsets, prices and the MCP Registry listings in servers/.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { TOOLS } from '../src/tools.js';
import PRICES from '../src/prices.js';
import { LISTINGS } from './listings.mjs';

const root = new URL('..', import.meta.url).pathname;
const REPO = 'https://github.com/retracn/automationnation-mcp';
const slugOf = (t) => (typeof t.slug === 'function' ? 'app-store-reviews-scraper' : t.slug);
const firstSentence = (s) => `${s.split('. ')[0].replace(/\.$/, '')}.`;

const toolRows = TOOLS.map((t) => `| \`${t.name}\` | ${firstSentence(t.description)} | [${PRICES[slugOf(t)]}](https://apify.com/automationnation/${slugOf(t)}) |`).join('\n');
const setRows = Object.entries(LISTINGS).map(([set, l]) => {
    const file = set === 'all' ? 'automationnation-mcp.mcpb' : `automationnation-${set}.mcpb`;
    return `| \`${set}\` | ${l.title} | [${file}](${REPO}/releases/latest/download/${file}) |`;
}).join('\n');
const remote = readdirSync(`${root}servers`).sort().map((d) => JSON.parse(readFileSync(`${root}servers/${d}/server.json`, 'utf8')))
    .filter((s) => s.remotes?.length)
    .map((s) => `| \`${s.name}\` | ${s.description} | \`${s.remotes[0].url.length > 90 ? `${s.remotes[0].url.slice(0, 60)}…` : s.remotes[0].url}\` |`).join('\n');

const readme = `# AutomationNation MCP server: Google Flights, Hotels, Shopping, News, Jobs, Trends, Maps leads, YouTube transcripts and more for AI agents

[![automationnation-mcp MCP server](https://glama.ai/mcp/servers/retracn/automationnation-mcp/badges/score.svg)](https://glama.ai/mcp/servers/retracn/automationnation-mcp) [![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE) [![MCP Registry](https://img.shields.io/badge/MCP%20Registry-io.github.retracn-0b57d0)](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.retracn)

An MCP server with ${TOOLS.length} data tools for Claude, ChatGPT, Cursor, VS Code and other AI agents. Each tool runs one of [AutomationNation's Apify Actors](https://apify.com/automationnation) on **your Apify account** and returns compact JSON the agent can use straight away: flight fares, hotel prices, product prices, news, jobs, search trends, local business leads, competitors' ads, YouTube transcripts, app reviews and AI-search visibility.

- **Purpose-built tools**: short, documented inputs (\`origin\`, \`destination\`, \`departure_date\`…) instead of raw scraper schemas, and outputs trimmed to the fields an agent needs.
- **Pay per result, no subscription**: usage is billed by each Actor on your Apify account (prices below). [A free Apify account](https://console.apify.com/sign-up) includes monthly credit.
- **Safe by default**: every run carries a spending cap of about 3x its expected cost; long runs return partial results with a \`run_id\` instead of timing out.
- **Works without a token for discovery**: tools are listed before you configure anything, so clients and registries can inspect them.

## Tools

| Tool | What it does | Price on your Apify account |
|---|---|---|
${toolRows}
| \`get_run_results\` | Fetch the results of a run that was still going when its tool returned. | Free |

## Install

**No install (Claude, ChatGPT and other clients with remote MCP):** add this URL as a connector and sign in with Apify:

\`\`\`
https://mcp.apify.com/?tools=automationnation/data-tools-mcp-server
\`\`\`

It runs the same server hosted on Apify ([data-tools-mcp-server](https://apify.com/automationnation/data-tools-mcp-server)). Clients that use \`mcp.json\` can connect to \`https://automationnation--data-tools-mcp-server.apify.actor/mcp\` with the header \`Authorization: Bearer <APIFY_TOKEN>\`. Add \`?tools=travel\` (or any toolset below) to load fewer tools.

**Run it yourself:** You need an Apify API token: sign up free at [console.apify.com](https://console.apify.com/sign-up), then copy the token from [Settings → API & Integrations](https://console.apify.com/settings/integrations).

MCP Registry name: \`io.github.retracn/automationnation-mcp\`.

**Claude Desktop**: download [automationnation-mcp.mcpb](${REPO}/releases/latest/download/automationnation-mcp.mcpb) (or a smaller toolset below), open it, and paste your token when asked.

**Claude Code**

\`\`\`bash
claude mcp add automationnation -e APIFY_TOKEN=your_apify_token -- npx -y github:retracn/automationnation-mcp
\`\`\`

**Cursor, VS Code, Windsurf, Cline and other clients** (\`mcp.json\`):

\`\`\`json
{
  "mcpServers": {
    "automationnation": {
      "command": "npx",
      "args": ["-y", "github:retracn/automationnation-mcp"],
      "env": { "APIFY_TOKEN": "your_apify_token", "AUTOMATIONNATION_TOOLS": "all" }
    }
  }
}
\`\`\`

**Smithery**: \`npx -y @smithery/cli mcp add automationnation/data-tools\`

**Self-hosted over HTTP** (one deployment serves many users; each client sends its own token as \`Authorization: Bearer <APIFY_TOKEN>\`):

\`\`\`bash
npx -y github:retracn/automationnation-mcp --http --port 8080      # http://localhost:8080/mcp
docker build -t automationnation-mcp . && docker run -p 8080:8080 automationnation-mcp --http
\`\`\`

## Toolsets

Load only what you need with \`AUTOMATIONNATION_TOOLS\` (or \`--tools\`): a comma-separated list of toolsets or tool names. Fewer tools keep the agent's context small.

| Toolset | Tools for | Claude Desktop bundle |
|---|---|---|
${setRows}

## How it works

1. The agent calls a tool, for example \`search_flights\` with \`{"origin": "JFK", "destination": "LHR", "departure_date": "2026-11-12"}\`.
2. The server starts the matching Actor through the [Apify API](https://docs.apify.com/api/v2) with your token and a spending cap (\`maxTotalChargeUsd\`), and sends progress updates while it runs.
3. Most tools finish in 5–30 seconds; lead searches take 1–3 minutes. The server waits up to 4 minutes (\`AUTOMATIONNATION_WAIT_SECS\`), then returns a one-line summary, the Apify run link and the results as compact JSON.
4. If a run is still going, the tool returns what is ready plus a \`run_id\`; \`get_run_results\` fetches the rest.

Your token is only sent to \`api.apify.com\`. Runs, datasets and spend are visible in your [Apify Console](https://console.apify.com/actors/runs).

## No install: Apify's hosted MCP endpoints

Every Actor is also available on Apify's hosted MCP server with OAuth sign-in. These listings are in the [official MCP Registry](https://registry.modelcontextprotocol.io):

| Registry name | What the agent can do | Endpoint |
|---|---|---|
${remote}

Use the URL in any client with remote MCP support; clients with MCP OAuth (Claude, ChatGPT) sign in with Apify, others send \`Authorization: Bearer <APIFY_TOKEN>\`.

## Development

\`\`\`bash
npm install
npm test                      # stdio end-to-end tests against a mock Apify API
node scripts/build.mjs        # dist/index.js plus one .mcpb bundle per toolset
\`\`\`

\`servers/*/server.json\` are the MCP Registry listings; the GitHub Actions workflow publishes them when they change.

## Related: drop-in packages for broken libraries

The same Actors also power open-source drop-in replacements. Change one import and keep your code:

| Package | Replaces | Fixes |
|---|---|---|
| [pytrends-cloud](https://github.com/retracn/pytrends-cloud) (Python) | pytrends | 429 TooManyRequestsError |
| [youtube-transcript-cloud](https://github.com/retracn/youtube-transcript-cloud) (Python) | youtube-transcript-api | RequestBlocked / IpBlocked on cloud servers |
| [youtube-transcript-cloud](https://github.com/retracn/youtube-transcript-cloud-js) (npm) | youtube-transcript | Fails in production on Vercel, Lambda, Render |
| [google-trends-api-cloud](https://github.com/retracn/google-trends-api-cloud) (npm) | google-trends-api | 429s; dailyTrends and realTimeTrends 404 |
| [app-store-scraper-cloud](https://github.com/retracn/app-store-scraper-cloud) (npm) | app-store-scraper | reviews() 403 / "Unexpected token <", 500-review cap |
| [jobspy-google](https://github.com/retracn/jobspy-google) (Python) | JobSpy's Google source | "Google Jobs is currently unavailable" |
| [amadeus-cloud](https://github.com/retracn/amadeus-cloud) (npm) | Amadeus SDK flight search | Self-Service keys switched off (July 2026) |

More: [guides and examples](https://retracn.github.io/automationnation-actors/) · [all AutomationNation Actors](https://apify.com/automationnation)

MIT licensed.
`;
writeFileSync(`${root}README.md`, readme);
console.log(`README.md: ${TOOLS.length} tools, ${Object.keys(LISTINGS).length} toolsets`);
