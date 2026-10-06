# AutomationNation MCP server: Google Flights, Hotels, Shopping, News, Jobs, Trends, Maps leads, YouTube transcripts and more for AI agents

[![automationnation-mcp MCP server](https://glama.ai/mcp/servers/retracn/automationnation-mcp/badges/score.svg)](https://glama.ai/mcp/servers/retracn/automationnation-mcp) [![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE) [![MCP Registry](https://img.shields.io/badge/MCP%20Registry-io.github.retracn-0b57d0)](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.retracn)

An MCP server with 18 data tools for Claude, ChatGPT, Cursor, VS Code and other AI agents. Each tool runs one of [AutomationNation's Apify Actors](https://apify.com/automationnation) on **your Apify account** and returns compact JSON the agent can use straight away: flight fares, hotel prices, product prices, news, jobs, search trends, local business leads, competitors' ads, YouTube transcripts, app reviews and AI-search visibility.

- **Purpose-built tools**: short, documented inputs (`origin`, `destination`, `departure_date`…) instead of raw scraper schemas, and outputs trimmed to the fields an agent needs.
- **Pay per result, no subscription**: usage is billed by each Actor on your Apify account (prices below). [A free Apify account](https://console.apify.com/sign-up) includes monthly credit.
- **Safe by default**: every run carries a spending cap of about 3x its expected cost; long runs return partial results with a `run_id` instead of timing out.
- **Works without a token for discovery**: tools are listed before you configure anything, so clients and registries can inspect them.

**Try it without installing anything:** add `https://mcp.apify.com/?tools=automationnation/data-tools-mcp-server` as a connector in Claude, ChatGPT or any remote-MCP client, sign in with Apify, and ask something like *"find nonstop flights from London to New York on 12 November"*. Other ways to run it are under [Install](#install).

## Tools

| Tool | What it does | Price on your Apify account |
|---|---|---|
| `search_flights` | Search Google Flights for one route and date. | [$0.20 per 1,000 flights ($0.16 on Gold and above)](https://apify.com/automationnation/google-flights-scraper) |
| `search_hotels` | Search Google Hotels for a city, neighbourhood or landmark. | [$1 per 1,000 hotels ($0.80 on Gold and above)](https://apify.com/automationnation/google-hotels-scraper) |
| `search_google` | Search Google and get the web results in Google's order: title, URL, site and snippet for each. | [$5 per 1,000 searches of up to 10 results ($4 on Gold and above)](https://apify.com/automationnation/google-custom-search-api) |
| `search_google_shopping` | Search Google Shopping for a product in any country. | [$1 per 1,000 products ($0.80 on Gold and above)](https://apify.com/automationnation/google-shopping-scraper) |
| `get_youtube_transcripts` | Get the transcript (captions) of YouTube videos, with title, channel, duration, caption language and word count, and optional timestamps. | [$1.50 per 1,000 transcripts ($1.20 on Gold and above)](https://apify.com/automationnation/youtube-transcript-scraper) |
| `search_google_news` | Search Google News for a topic, company or person. | [$1 per 1,000 articles ($0.80 on Gold and above)](https://apify.com/automationnation/google-news-scraper) |
| `search_google_images` | Search Google Images. | [$0.25 per 1,000 images ($0.20 on Gold and above)](https://apify.com/automationnation/google-images-scraper) |
| `search_google_videos` | Search Google's video results across YouTube, TikTok, Vimeo, news sites and more. | [$1 per 1,000 videos ($0.80 on Gold and above)](https://apify.com/automationnation/google-videos-scraper) |
| `search_jobs` | Search Google Jobs, which aggregates listings from LinkedIn, Indeed, Glassdoor, company career sites and more, in 26 countries. | [$2 per 1,000 jobs ($1.50 on paid plans) + $0.03 per search](https://apify.com/automationnation/google-jobs-scraper) |
| `get_google_trends` | Google Trends for up to 5 keywords: interest over time (0–100), average, latest and peak interest, trend direction and change, top regions, and top and rising related searches with "Breakout" flags. | [$1 per 1,000 keyword reports ($0.27–$0.90 on paid plans) · $0.50 per 1,000 trending searches](https://apify.com/automationnation/google-trends-scraper) |
| `get_trending_searches` | What's trending on Google right now in a country, like trends.google.com/trending: each trending search with its search volume, increase, start time, whether it is still active, related searches and optional news articles. | [$1 per 1,000 keyword reports ($0.27–$0.90 on paid plans) · $0.50 per 1,000 trending searches](https://apify.com/automationnation/google-trends-scraper) |
| `find_local_businesses` | Find local businesses on Google Maps in any country, as sales leads. | [$0.03 per lead ($0.024 on Gold)](https://apify.com/automationnation/google-maps-leads) |
| `find_uk_business_leads` | UK business leads from Google Maps, enriched from Companies House: everything find_local_businesses returns plus the company director's name, company number, incorporation date, company age and SIC codes, with a match-confidence rating. | [$0.05 per lead ($0.04 on Gold)](https://apify.com/automationnation/uk-business-leads) |
| `get_advertiser_ads` | Every ad an advertiser runs on Google Search, YouTube, Display and Shopping, from Google's Ads Transparency Center. | [$1 per 1,000 ads ($0.80 on Gold and above)](https://apify.com/automationnation/google-ads-transparency-scraper) |
| `get_app_reviews` | App reviews from the Apple App Store or Google Play: star rating, title, text, date, reviewer and the developer's reply, plus app version and helpful votes for Google Play. | [$0.08 per 1,000 reviews ($0.05–$0.07 on paid plans)](https://apify.com/automationnation/app-store-reviews-scraper) |
| `analyze_app_reviews` | AI analysis of the latest App Store and Google Play reviews for up to 5 apps: top bugs, top feature requests, critical issues, competitor mentions, a sentiment summary, the rating distribution and the app versions mentioned. | [$0.05 per app report ($0.04 on Gold)](https://apify.com/automationnation/app-store-review-miner) |
| `check_ai_overview_citations` | Check Google AI Overviews for your keywords: whether an AI Overview appears, whether it cites your domain and at what position, which domains and competitors it cites instead, whether your brand is mentioned, the AI Overview text, your organic rank, and what changed since your last check. | [$0.04 per keyword ($0.032 on Gold), plus $2 per run from 17 Nov 2026; $0.01 per keyword until 16 Oct 2026](https://apify.com/automationnation/aeo-auditor) |
| `check_ai_visibility` | Ask AI assistants the questions your customers ask and see whether they mention and cite your brand. | [$0.05 per answer checked ($0.04 on Gold) + $0.50 per optional report](https://apify.com/automationnation/ai-visibility-tracker) |
| `get_run_results` | Fetch the results of a run that was still going when its tool returned. | Free |

## Install

**No install (Claude, ChatGPT and other clients with remote MCP):** add this URL as a connector and sign in with Apify:

```
https://mcp.apify.com/?tools=automationnation/data-tools-mcp-server
```

It runs the same server hosted on Apify ([data-tools-mcp-server](https://apify.com/automationnation/data-tools-mcp-server)). Clients that use `mcp.json` can connect to `https://automationnation--data-tools-mcp-server.apify.actor/mcp` with the header `Authorization: Bearer <APIFY_TOKEN>`. Add `?tools=travel` (or any toolset below) to load fewer tools.

**Run it yourself:** You need an Apify API token: sign up free at [console.apify.com](https://console.apify.com/sign-up), then copy the token from [Settings → API & Integrations](https://console.apify.com/settings/integrations).

MCP Registry name: `io.github.retracn/automationnation-mcp`.

**Claude Desktop**: download [automationnation-mcp.mcpb](https://github.com/retracn/automationnation-mcp/releases/latest/download/automationnation-mcp.mcpb) (or a smaller toolset below), open it, and paste your token when asked.

**Claude Code**

```bash
claude mcp add automationnation -e APIFY_TOKEN=your_apify_token -- npx -y github:retracn/automationnation-mcp
```

**Cursor, VS Code, Windsurf, Cline and other clients** (`mcp.json`):

```json
{
  "mcpServers": {
    "automationnation": {
      "command": "npx",
      "args": ["-y", "github:retracn/automationnation-mcp"],
      "env": { "APIFY_TOKEN": "your_apify_token", "AUTOMATIONNATION_TOOLS": "all" }
    }
  }
}
```

**Hosted endpoint for any client with remote MCP** (Streamable HTTP, nothing to install; your token goes in a header):

```json
{
  "mcpServers": {
    "automationnation": {
      "url": "https://automationnation--data-tools-mcp-server.apify.actor/mcp",
      "headers": { "Authorization": "Bearer your_apify_token" }
    }
  }
}
```

**Open WebUI**: Admin Panel → Settings → External Tools → **+**, type **MCP (Streamable HTTP)**, URL `https://automationnation--data-tools-mcp-server.apify.actor/mcp`, auth **Bearer** with your Apify token. Prefer single tools? See [open-webui-tools](https://github.com/retracn/open-webui-tools).

**LibreChat** (`librechat.yaml`):

```yaml
mcpServers:
  automationnation:
    type: streamable-http
    url: https://automationnation--data-tools-mcp-server.apify.actor/mcp
    headers:
      Authorization: "Bearer your_apify_token"
```

**Smithery**: `npx -y @smithery/cli mcp add automationnation/data-tools`

**Self-hosted over HTTP** (one deployment serves many users; each client sends its own token as `Authorization: Bearer <APIFY_TOKEN>`):

```bash
npx -y github:retracn/automationnation-mcp --http --port 8080      # http://localhost:8080/mcp
docker build -t automationnation-mcp . && docker run -p 8080:8080 automationnation-mcp --http
```

## Toolsets

Load only what you need with `AUTOMATIONNATION_TOOLS` (or `--tools`): a comma-separated list of toolsets or tool names. Fewer tools keep the agent's context small.

| Toolset | Tools for | Claude Desktop bundle |
|---|---|---|
| `all` | AutomationNation Data Tools | [automationnation-mcp.mcpb](https://github.com/retracn/automationnation-mcp/releases/latest/download/automationnation-mcp.mcpb) |
| `travel` | Google Flights & Hotels | [automationnation-travel.mcpb](https://github.com/retracn/automationnation-mcp/releases/latest/download/automationnation-travel.mcpb) |
| `youtube` | YouTube Transcripts | [automationnation-youtube.mcpb](https://github.com/retracn/automationnation-mcp/releases/latest/download/automationnation-youtube.mcpb) |
| `shopping` | Google Shopping | [automationnation-shopping.mcpb](https://github.com/retracn/automationnation-mcp/releases/latest/download/automationnation-shopping.mcpb) |
| `news` | Google News | [automationnation-news.mcpb](https://github.com/retracn/automationnation-mcp/releases/latest/download/automationnation-news.mcpb) |
| `google-search` | Google Search Verticals | [automationnation-google-search.mcpb](https://github.com/retracn/automationnation-mcp/releases/latest/download/automationnation-google-search.mcpb) |
| `jobs` | Google Jobs | [automationnation-jobs.mcpb](https://github.com/retracn/automationnation-mcp/releases/latest/download/automationnation-jobs.mcpb) |
| `trends` | Google Trends | [automationnation-trends.mcpb](https://github.com/retracn/automationnation-mcp/releases/latest/download/automationnation-trends.mcpb) |
| `leads` | Google Maps Leads | [automationnation-leads.mcpb](https://github.com/retracn/automationnation-mcp/releases/latest/download/automationnation-leads.mcpb) |
| `ads` | Google Ads Transparency | [automationnation-ads.mcpb](https://github.com/retracn/automationnation-mcp/releases/latest/download/automationnation-ads.mcpb) |
| `app-reviews` | App Store & Google Play Reviews | [automationnation-app-reviews.mcpb](https://github.com/retracn/automationnation-mcp/releases/latest/download/automationnation-app-reviews.mcpb) |
| `ai-visibility` | AI Visibility & AI Overviews | [automationnation-ai-visibility.mcpb](https://github.com/retracn/automationnation-mcp/releases/latest/download/automationnation-ai-visibility.mcpb) |

## How it works

1. The agent calls a tool, for example `search_flights` with `{"origin": "JFK", "destination": "LHR", "departure_date": "2026-11-12"}`.
2. The server starts the matching Actor through the [Apify API](https://docs.apify.com/api/v2) with your token and a spending cap (`maxTotalChargeUsd`), and sends progress updates while it runs.
3. Most tools finish in 5–30 seconds; lead searches take 1–3 minutes. The server waits up to 4 minutes (`AUTOMATIONNATION_WAIT_SECS`), then returns a one-line summary, the Apify run link and the results as compact JSON.
4. If a run is still going, the tool returns what is ready plus a `run_id`; `get_run_results` fetches the rest.

Your token is only sent to `api.apify.com`. Runs, datasets and spend are visible in your [Apify Console](https://console.apify.com/actors/runs).

## No install: Apify's hosted MCP endpoints

Every Actor is also available on Apify's hosted MCP server with OAuth sign-in. These listings are in the [official MCP Registry](https://registry.modelcontextprotocol.io):

| Registry name | What the agent can do | Endpoint |
|---|---|---|
| `io.github.retracn/ai-visibility` | AI visibility for agents: is a brand mentioned and cited by Gemini, Claude and Google AI Overviews? | `https://mcp.apify.com/?tools=automationnation/ai-visibility-tracker` |
| `io.github.retracn/app-reviews-ai` | AI summary of App Store and Google Play reviews: bugs, feature requests and critical issues. | `https://mcp.apify.com/?tools=automationnation/app-store-review-miner` |
| `io.github.retracn/app-store-reviews` | App Store reviews for AI agents: any app or country, past the 500-review limit, with dev replies. | `https://mcp.apify.com/?tools=automationnation/app-store-reviews-scraper` |
| `io.github.retracn/automationnation` | Google Shopping, Flights, Hotels, News, Images, Ads, Jobs, Trends, YouTube transcripts, leads. | `https://mcp.apify.com/?tools=automationnation/google-maps-le…` |
| `io.github.retracn/automationnation-mcp` | Agent tools: Google web search, Flights, Hotels, Shopping, News, Jobs, Trends, Maps leads, YouTube | `https://mcp.apify.com/?tools=automationnation/data-tools-mcp-server` |
| `io.github.retracn/google-ads-transparency` | Competitors' Google ads for AI agents: every ad a brand runs, with dates and ad text. | `https://mcp.apify.com/?tools=automationnation/google-ads-transparency-scraper` |
| `io.github.retracn/google-ai-overview-tracker` | Check if Google AI Overviews cite your website: citations, competitors and changes over time. | `https://mcp.apify.com/?tools=automationnation/aeo-auditor` |
| `io.github.retracn/google-flights` | Google Flights for AI agents: prices, airlines, flight numbers, times, stops, emissions. | `https://mcp.apify.com/?tools=automationnation/google-flights-scraper` |
| `io.github.retracn/google-hotels` | Google Hotels for AI agents: prices for your dates, ratings, star class, location, photos. | `https://mcp.apify.com/?tools=automationnation/google-hotels-scraper` |
| `io.github.retracn/google-images` | Google Images for AI agents: full-size image URLs, sizes and source pages, with filters. | `https://mcp.apify.com/?tools=automationnation/google-images-scraper` |
| `io.github.retracn/google-jobs` | Search Google Jobs from AI agents: listings with salaries, full descriptions and apply links. | `https://mcp.apify.com/?tools=automationnation/google-jobs-scraper` |
| `io.github.retracn/google-maps-leads` | Local business leads from Google Maps in any country: emails, socials, website audit, outreach. | `https://mcp.apify.com/?tools=automationnation/google-maps-leads` |
| `io.github.retracn/google-news` | Google News for AI agents: headlines, sources, dates and article URLs, with time filters. | `https://mcp.apify.com/?tools=automationnation/google-news-scraper` |
| `io.github.retracn/google-play-reviews` | Google Play reviews for AI agents: any app, country or language, with developer replies. | `https://mcp.apify.com/?tools=automationnation/google-play-reviews-scraper` |
| `io.github.retracn/google-shopping` | Google Shopping for AI agents: product prices, discounts, stores, ratings and reviews. | `https://mcp.apify.com/?tools=automationnation/google-shopping-scraper` |
| `io.github.retracn/google-trends` | Google Trends data for AI agents: interest over time, regions, rising queries and trending searches. | `https://mcp.apify.com/?tools=automationnation/google-trends-scraper` |
| `io.github.retracn/google-videos` | Google video results for AI agents: YouTube, TikTok and more, with channel and duration. | `https://mcp.apify.com/?tools=automationnation/google-videos-scraper` |
| `io.github.retracn/uk-business-leads` | UK business leads from Google Maps with emails, phones, Companies House directors and outreach. | `https://mcp.apify.com/?tools=automationnation/uk-business-leads` |
| `io.github.retracn/youtube-transcripts` | YouTube transcripts for AI agents: text and timestamps for any video, channel or playlist. | `https://mcp.apify.com/?tools=automationnation/youtube-transcript-scraper` |

Use the URL in any client with remote MCP support; clients with MCP OAuth (Claude, ChatGPT) sign in with Apify, others send `Authorization: Bearer <APIFY_TOKEN>`.

## Development

```bash
npm install
npm test                      # stdio end-to-end tests against a mock Apify API
node scripts/build.mjs        # dist/index.js plus one .mcpb bundle per toolset
```

`servers/*/server.json` are the MCP Registry listings; the GitHub Actions workflow publishes them when they change.

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
