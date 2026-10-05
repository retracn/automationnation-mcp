// Stateless Streamable HTTP mode for hosting the server: each request gets its own server instance
// bound to the caller's Apify token, so one deployment can serve many users.
// On Apify (Actor Standby) every user gets their own run, so the run's APIFY_TOKEN is the caller's
// and serves as the fallback when a request carries no token of its own.

import { createServer as createHttpServer } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from './server.js';

function tokenOf(req, url, fallback) {
    const auth = req.headers.authorization ?? '';
    if (/^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, '').trim();
    return req.headers['x-apify-token'] || url.searchParams.get('apifyToken') || url.searchParams.get('token') || fallback || '';
}

async function readJson(req) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks).toString('utf8');
    return body ? JSON.parse(body) : undefined;
}

export function startHttp({ toolset, waitSecs, port, defaultToken = '' }) {
    const server = createHttpServer(async (req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        // Apify's readiness probe, health checks and a plain GET of the root.
        if (req.headers['x-apify-container-server-readiness-probe'] || url.pathname === '/health' || (req.method === 'GET' && url.pathname === '/')) {
            res.writeHead(200, { 'Content-Type': 'text/plain' }).end('AutomationNation MCP server. MCP endpoint: POST /mcp\n');
            return;
        }
        if (url.pathname !== '/mcp' && url.pathname !== '/') {
            res.writeHead(404).end();
            return;
        }
        if (req.method !== 'POST') {
            res.writeHead(405, { Allow: 'POST' }).end();
            return;
        }
        try {
            const mcp = createServer({ token: tokenOf(req, url, defaultToken), toolset: url.searchParams.get('tools') || toolset, waitSecs });
            const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
            res.on('close', () => {
                transport.close();
                mcp.close();
            });
            await mcp.connect(transport);
            await transport.handleRequest(req, res, await readJson(req));
        } catch (e) {
            if (!res.headersSent) res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32600, message: String(e?.message ?? e) }, id: null }));
        }
    });
    server.listen(port, () => console.error(`AutomationNation MCP server on http://localhost:${port}/mcp`));
    return server;
}
