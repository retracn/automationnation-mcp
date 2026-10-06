# Google Data MCP Server: Flights, Hotels, Shopping, YouTube and more for AI agents

**One MCP server with 17 data tools for Claude, ChatGPT, Cursor and other AI agents.** Connect it with one URL and your agent can look up Google Flights fares, Google Hotels prices, Google Shopping, News, Images, Videos, Jobs and Trends, YouTube transcripts, Google Maps business leads, competitors' Google ads, App Store and Google Play reviews, and AI-search visibility. No install and no scraping code.

## Connect in one step

**Claude, ChatGPT and other clients with remote MCP and sign-in:** add this URL as a connector and sign in with Apify:

```
https://mcp.apify.com/?tools=automationnation/data-tools-mcp-server
```

**Cursor, VS Code, Windsurf and other `mcp.json` clients:** use the direct endpoint with your [Apify API token](https://console.apify.com/settings/integrations):

```json
{
  "mcpServers": {
    "automationnation": {
      "url": "https://automationnation--data-tools-mcp-server.apify.actor/mcp",
      "headers": { "Authorization": "Bearer YOUR_APIFY_TOKEN" }
    }
  }
}
```

**Claude Code:** install the plugin, which adds this connector plus skills for travel, research, competitor ads, leads and AI-visibility tasks:

```
/plugin marketplace add retracn/automationnation-data-tools
/plugin install automationnation-data-tools@automationnation
```

Add `?tools=travel` (or `youtube`, `shopping`, `news`, `google-search`, `jobs`, `trends`, `leads`, `ads`, `app-reviews`, `ai-visibility`) to the URL to load only the tools you need.

## Try asking

- "Find the cheapest nonstop flight from London to New York on 12 December, and three 4-star hotels in Midtown for those three nights."
- "Summarise this YouTube video with timestamps for the key points: https://www.youtube.com/watch?v=UF8uR6Z6KLc"
- "How has search interest in electric bikes changed in the UK over the past year, and what's rising?"
- "What's the cheapest price for AirPods Pro on Google Shopping in the US right now, and from which stores?"
- "Show me the Google ads hubspot.com runs in the UK and which ones have run the longest."
- "Find 20 dentists in Austin without a website, with phone numbers."
- "What are people complaining about in Duolingo's recent App Store reviews?"
- "Do Google AI Overviews, Gemini and Claude recommend Notion for team wikis, and who do they name instead?"

## Tools

| Tool | What it returns |
|---|---|
| `search_flights` | Google Flights fares for a route and date: price, airlines, flight numbers, times, stops, emissions |
| `search_hotels` | Google Hotels: nightly prices with taxes, stay total, stars, rating, reviews, location |
| `search_google_shopping` | Google Shopping products: price, discount, store, delivery, rating, reviews |
| `get_youtube_transcripts` | Transcripts of YouTube videos, Shorts, channels or playlists, with optional timestamps |
| `search_google_news` | Google News articles: headline, publisher, time and article URL |
| `search_google_images` | Google Images: full-size image URLs, sizes and source pages |
| `search_google_videos` | Google video results across YouTube, TikTok and more |
| `search_jobs` | Google Jobs listings in 26 countries with salaries and apply links |
| `get_google_trends` | Google Trends interest over time, regions and rising searches |
| `get_trending_searches` | What's trending on Google right now in a country |
| `find_local_businesses` | Google Maps business leads with emails, phones, websites and lead scores |
| `find_uk_business_leads` | UK leads with Companies House directors |
| `get_advertiser_ads` | Every Google ad a brand runs, from the Ads Transparency Center |
| `get_app_reviews` | App Store and Google Play reviews |
| `analyze_app_reviews` | AI summary of bugs, feature requests and sentiment in app reviews |
| `check_ai_overview_citations` | Whether Google AI Overviews cite your site for your keywords |
| `check_ai_visibility` | Whether Google AI Overviews, Gemini and Claude mention and cite your brand |
| `get_run_results` | Results of a long run that was still going when its tool returned |

## Pricing

The server itself is free. Each tool call runs one of [AutomationNation's Actors](https://apify.com/automationnation) on your Apify account at its pay-per-result price, for example $0.20 per 1,000 flights, $1 per 1,000 hotels or products and $1.50 per 1,000 YouTube transcripts. You also pay the small platform cost of the server's own run while it's connected. Every tool call carries a spending cap of about three times its expected cost. Apify's free plan includes monthly credit.

## Why use it

- **Built for agents:** short, documented inputs and compact outputs. [Glama](https://glama.ai/mcp/servers/retracn/automationnation-mcp) rates its tool definitions A.
- **Fast and cheap:** most tools answer in 5–30 seconds over plain HTTP. Prices are typically 3–5x lower than the most-used Actor in each niche.
- **Safe:** read-only tools, a spending cap on every call, and long runs return partial results with a `run_id` instead of timing out.
- **Open source:** the same server runs locally with `npx -y github:retracn/automationnation-mcp` ([GitHub](https://github.com/retracn/automationnation-mcp)).

## FAQ

**Do I need to install anything?** No. Use the URL above in any client with remote MCP support. For a local install, see the GitHub repository.

**Whose account pays?** Yours. Every call runs on the Apify account you sign in with, and nothing is shared with other users.

**What happens if I start this Actor from the Console?** It lists its tools and the URL to connect to, then stops. The MCP server itself runs in Standby mode when a client connects.
