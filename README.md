# AutomationNation MCP servers

MCP server listings for [AutomationNation's Apify Actors](https://apify.com/automationnation), published to the [official MCP Registry](https://registry.modelcontextprotocol.io). Each server is Apify's hosted MCP endpoint loaded with one Actor, so an AI assistant (Claude, ChatGPT, Cursor, VS Code, …) can call it as a tool.

| Server (MCP Registry name) | What the agent can do | Apify Actor |
|---|---|---|
| `io.github.retracn/google-trends` | Google Trends: interest over time, by region and city, rising queries, Trending now | [google-trends-scraper](https://apify.com/automationnation/google-trends-scraper) |
| `io.github.retracn/google-jobs` | Search Google Jobs: salaries, full descriptions, employer apply links (26 countries) | [google-jobs-scraper](https://apify.com/automationnation/google-jobs-scraper) |
| `io.github.retracn/google-ai-overview-tracker` | Check whether Google AI Overviews cite a website, who's cited instead, and what changed | [aeo-auditor](https://apify.com/automationnation/aeo-auditor) |
| `io.github.retracn/uk-business-leads` | UK business leads from Google Maps with emails, phones and Companies House directors | [uk-business-leads](https://apify.com/automationnation/uk-business-leads) |
| `io.github.retracn/app-reviews-ai` | App Store and Google Play reviews summarised into bugs, feature requests and critical issues | [app-store-review-miner](https://apify.com/automationnation/app-store-review-miner) |
| `io.github.retracn/automationnation` | All five tools in one server | — |

## Connect

You need a free [Apify account](https://console.apify.com/sign-up) and its [API token](https://console.apify.com/settings/integrations). Usage is billed per result by each Actor (see its Store page); Apify's free plan includes $5 of credit a month.

**Remote (streamable HTTP):**

```
https://mcp.apify.com/?tools=automationnation/google-trends-scraper
Authorization: Bearer YOUR_APIFY_TOKEN
```

Clients that support MCP OAuth (e.g. Claude) can use the URL alone and sign in with Apify.

**Claude Desktop / Cursor (local):**

```json
{
  "mcpServers": {
    "google-trends": {
      "command": "npx",
      "args": ["-y", "@apify/actors-mcp-server", "--tools", "automationnation/google-trends-scraper"],
      "env": { "APIFY_TOKEN": "YOUR_APIFY_TOKEN" }
    }
  }
}
```

Swap the Actor name for any other in the table, or list several separated by commas.

## How these listings are published

`servers/*/server.json` follow the [server.json schema](https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json). The GitHub Actions workflow publishes them to the MCP Registry with GitHub OIDC whenever they change; bump `version` to publish an update.

Guides and code examples: https://retracn.github.io/automationnation-actors/
