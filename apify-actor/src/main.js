// AutomationNation MCP server as an Apify Actor.
// Standby mode: serves MCP over Streamable HTTP at /mcp; each user has their own run, billed to them,
// and tool calls run AutomationNation Actors with that user's token.
// Normal run (Console "Start", Store tests): lists the tools and how to connect, then exits.
import { Actor } from 'apify';
import { startHttp } from '../server/http.js';
import { selectTools } from '../server/tools.js';

await Actor.init();
const { toolset = 'all' } = (await Actor.getInput()) ?? {};
const base = process.env.ACTOR_STANDBY_URL || 'https://automationnation--data-tools-mcp-server.apify.actor';
const mcpUrl = `${base.replace(/\/+$/, '')}/mcp`;

if (Actor.config.get('metaOrigin') === 'STANDBY') {
    startHttp({ toolset, waitSecs: 240, port: Actor.config.get('containerPort') || Number(process.env.ACTOR_WEB_SERVER_PORT) || 4321, defaultToken: Actor.config.get('token') });
} else {
    const tools = selectTools(toolset);
    await Actor.pushData([...tools.map((t) => ({ tool: t.name, title: t.title, description: `${t.description.split('. ')[0].replace(/\.$/, '')}.`, mcpUrl })),
        { tool: 'get_run_results', title: 'Get results of a run', description: 'Fetch the results of a run that was still going when its tool returned.', mcpUrl }]);
    await Actor.setStatusMessage(`MCP server with ${tools.length + 1} tools. Connect your AI client to ${mcpUrl} (header Authorization: Bearer <your Apify token>), or use https://mcp.apify.com/?tools=automationnation/data-tools-mcp-server and sign in with Apify.`, { isStatusMessageTerminal: true });
    await Actor.exit();
}
