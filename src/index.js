#!/usr/bin/env node
// AutomationNation Data Tools MCP server.
//   stdio (default):  APIFY_TOKEN=... npx automationnation-mcp [--tools travel,youtube]
//   Streamable HTTP:  npx automationnation-mcp --http [--port 8080]; clients send their token as
//                     "Authorization: Bearer <APIFY_TOKEN>" (or ?apifyToken=...).
// Tools are listed without a token; the token is only needed to run them.

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

function arg(name) {
    const i = process.argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
    if (i === -1) return undefined;
    const a = process.argv[i];
    return a.includes('=') ? a.slice(a.indexOf('=') + 1) : process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : 'true';
}

const toolset = arg('tools') ?? process.env.AUTOMATIONNATION_TOOLS ?? 'all';
const waitSecs = Number(arg('wait') ?? process.env.AUTOMATIONNATION_WAIT_SECS) || 240;

if (arg('http')) {
    const { startHttp } = await import('./http.js');
    startHttp({ toolset, waitSecs, port: Number(arg('port') ?? process.env.PORT) || 8080 });
} else {
    const token = process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN || '';
    const server = createServer({ token, toolset, waitSecs });
    await server.connect(new StdioServerTransport());
}
