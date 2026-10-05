import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { explainError, getItems, getRun, runActor, runUrl } from './apify.js';
import { compact } from './format.js';
import { actorOf, chargeCap, selectTools } from './tools.js';

export const VERSION = '1.0.0';

const INSTRUCTIONS = `Data tools backed by AutomationNation's Apify Actors: Google Flights, Hotels, Shopping, News, Images, Videos, Jobs and Trends, Google Maps business leads, Google Ads Transparency, YouTube transcripts, App Store and Google Play reviews, and AI search visibility.
Every tool call starts a run on the user's Apify account and is billed per result there (Apify's free plan includes monthly credit). Keep max_results modest unless the user asks for more.
Tools return a one-line summary, a link to the Apify run and compact JSON. If a tool says the run is still running, call get_run_results with its run_id a little later.`;

const NO_TOKEN = `No Apify API token is configured, so this tool can't run yet. Set APIFY_TOKEN in this MCP server's configuration: create a free account at https://console.apify.com/sign-up, then copy the token from https://console.apify.com/settings/integrations. Runs are billed per result on that Apify account.`;

const MAX_OUTPUT_CHARS = 120_000;
const text = (s, isError = false) => ({ content: [{ type: 'text', text: s }], ...(isError && { isError: true }) });

function render({ summary, run, items, elapsed, note }) {
    let json = JSON.stringify(items);
    let cut = '';
    if (json.length > MAX_OUTPUT_CHARS) {
        let n = items.length;
        while (n > 1 && JSON.stringify(items.slice(0, n)).length > MAX_OUTPUT_CHARS) n = Math.floor(n * 0.8);
        json = JSON.stringify(items.slice(0, n));
        cut = ` Showing ${n} of ${items.length} results to keep the response small; ask for fewer results or call get_run_results with an offset.`;
    }
    const header = [summary + cut, `Apify run: ${runUrl(run.id)} (${run.status}, ${elapsed}s). run_id: ${run.id}`, note].filter(Boolean).join('\n');
    return `${header}\n${json}`;
}

async function execute(tool, args, extra, { token, waitSecs }) {
    if (!token) return text(NO_TOKEN, true);
    const problem = tool.validate?.(args);
    if (problem) return text(problem, true);
    const progressToken = extra?._meta?.progressToken;
    const onProgress = progressToken === undefined ? undefined : (run, secs) => extra.sendNotification({
        method: 'notifications/progress',
        params: { progressToken, progress: secs, message: `${tool.title}: Apify run ${run.status.toLowerCase()} after ${secs}s` },
    }).catch(() => {});
    const started = Date.now();
    try {
        const maxItems = tool.maxItems(args);
        const run = await runActor({
            token, actor: actorOf(tool, args), input: tool.input(args), maxItems, maxTotalChargeUsd: chargeCap(tool, args), waitSecs, signal: extra?.signal, onProgress,
        });
        const rows = await getItems(token, run.defaultDatasetId, { limit: maxItems, signal: extra?.signal });
        const items = tool.format(rows, args);
        const elapsed = Math.round((Date.now() - started) / 1000);
        if (run.status === 'SUCCEEDED') return text(render({ summary: tool.summary(rows, args), run, items, elapsed }));
        if (run.status === 'RUNNING' || run.status === 'READY') {
            return text(render({ summary: `Partial results (${items.length} so far).`, run, items, elapsed, note: `The run is still going. Call get_run_results with run_id "${run.id}" in a minute for the full results.` }));
        }
        const why = run.statusMessage ? `: ${run.statusMessage}` : '';
        return text(render({ summary: `The Apify run ended ${run.status.toLowerCase()}${why}.`, run, items, elapsed }), items.length === 0);
    } catch (e) {
        return text(explainError(e), true);
    }
}

export function createServer({ token = '', toolset = 'all', waitSecs = 240 } = {}) {
    const server = new McpServer({ name: 'automationnation', title: 'AutomationNation Data Tools', version: VERSION }, { instructions: INSTRUCTIONS });
    for (const tool of selectTools(toolset)) {
        server.registerTool(tool.name, {
            title: tool.title,
            description: tool.description,
            inputSchema: tool.inputSchema,
            annotations: { title: tool.title, readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
        }, (args, extra) => execute(tool, args, extra, { token, waitSecs }));
    }
    server.registerTool('get_run_results', {
        title: 'Get results of a run',
        description: "Fetch the status and results of an Apify run started by one of this server's tools, for example one that was still running when the tool returned (large lead or AI-visibility searches). Pass the run_id from that tool's output. Free: it only reads results already paid for.",
        inputSchema: {
            run_id: z.string().min(5).describe('The run_id printed by the tool that started the run.'),
            limit: z.number().int().min(1).max(500).default(50).describe('How many results to return.'),
            offset: z.number().int().min(0).default(0).describe('Skip this many results, to page through a large run.'),
        },
        annotations: { title: 'Get results of a run', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async ({ run_id: runId, limit, offset }, extra) => {
        if (!token) return text(NO_TOKEN, true);
        try {
            const run = await getRun(token, runId, extra?.signal);
            const rows = await getItems(token, run.defaultDatasetId, { limit, offset, signal: extra?.signal });
            const items = rows.map((r) => compact(r, { maxString: 500, maxArray: 10 }));
            const done = !['RUNNING', 'READY'].includes(run.status);
            return text(render({
                summary: `${items.length} results from offset ${offset}.`,
                run,
                items,
                elapsed: Math.round(((run.finishedAt ? Date.parse(run.finishedAt) : Date.now()) - Date.parse(run.startedAt)) / 1000),
                note: done ? null : 'The run is still going; call again later for the rest.',
            }));
        } catch (e) {
            return text(explainError(e), true);
        }
    });
    return server;
}
