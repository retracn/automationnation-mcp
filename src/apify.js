// Minimal Apify API client: start an Actor run on the caller's account, wait for it within a
// time budget (polling, so the MCP client gets progress updates), then read the run's dataset.

// APIFY_API_BASE_URL follows Apify's own convention (set inside Actor runs; tests point it at a mock).
const API = `${(process.env.APIFY_API_BASE_URL || 'https://api.apify.com').replace(/\/+$/, '')}/v2`;
const TERMINAL = new Set(['SUCCEEDED', 'FAILED', 'TIMED-OUT', 'ABORTED']);
const USER_AGENT = 'automationnation-mcp';

export class ApifyError extends Error {
    constructor(message, { status, type } = {}) {
        super(message);
        this.name = 'ApifyError';
        this.status = status;
        this.type = type;
    }
}

async function call(token, path, { method = 'GET', body, signal } = {}) {
    const res = await fetch(`${API}${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            'User-Agent': USER_AGENT,
            ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal,
    });
    const text = await res.text();
    let json;
    try {
        json = text ? JSON.parse(text) : undefined;
    } catch {
        json = undefined;
    }
    if (!res.ok) {
        const err = json?.error ?? {};
        throw new ApifyError(err.message || `Apify API returned HTTP ${res.status}`, { status: res.status, type: err.type });
    }
    return json;
}

export const runUrl = (runId) => `https://console.apify.com/view/runs/${runId}`;

/**
 * Starts `actor` with `input` and waits up to `waitSecs` for it to finish.
 * Returns the run object, which may still be RUNNING when the budget runs out.
 * If `signal` aborts (the client cancelled the tool call), the run is aborted too so the user isn't billed for it.
 */
export async function runActor({ token, actor, input, maxItems, maxTotalChargeUsd, waitSecs = 240, signal, onProgress }) {
    const qs = new URLSearchParams();
    if (maxItems) qs.set('maxItems', String(maxItems));
    if (maxTotalChargeUsd) qs.set('maxTotalChargeUsd', maxTotalChargeUsd.toFixed(2));
    const started = Date.now();
    let run = (await call(token, `/acts/${actor.replace('/', '~')}/runs?${qs}`, { method: 'POST', body: input, signal })).data;
    try {
        while (!TERMINAL.has(run.status)) {
            const elapsed = (Date.now() - started) / 1000;
            const left = waitSecs - elapsed;
            if (left < 1) break;
            await onProgress?.(run, Math.round(elapsed));
            run = (await call(token, `/actor-runs/${run.id}?waitForFinish=${Math.min(10, Math.floor(left))}`, { signal })).data;
        }
    } catch (e) {
        if (signal?.aborted) await abortRun(token, run.id).catch(() => {});
        throw e;
    }
    return run;
}

export async function getRun(token, runId, signal) {
    return (await call(token, `/actor-runs/${encodeURIComponent(runId)}`, { signal })).data;
}

export async function getItems(token, datasetId, { limit = 100, offset = 0, signal } = {}) {
    if (!datasetId) return [];
    const qs = new URLSearchParams({ clean: 'true', format: 'json', limit: String(limit), offset: String(offset) });
    const items = await call(token, `/datasets/${datasetId}/items?${qs}`, { signal });
    return Array.isArray(items) ? items : [];
}

export async function abortRun(token, runId) {
    await call(token, `/actor-runs/${runId}/abort`, { method: 'POST' });
}

/** Turns API errors into a message an agent can act on. */
export function explainError(e) {
    if (e?.name === 'AbortError') return 'The request was cancelled.';
    if (!(e instanceof ApifyError)) return `Could not reach the Apify API: ${e?.message ?? e}`;
    if (e.status === 401) {
        return 'Apify rejected the API token. Check APIFY_TOKEN: copy it from https://console.apify.com/settings/integrations (a free Apify account includes monthly credit).';
    }
    if (e.status === 402 || /usage|credit|limit|payment/i.test(e.type ?? '')) {
        return `Apify couldn't start the run on this account: ${e.message} Add credit or raise the usage limit at https://console.apify.com/billing.`;
    }
    if (e.status === 404) return `Apify couldn't find that run or Actor: ${e.message}`;
    return `Apify API error (${e.status ?? 'network'}${e.type ? `, ${e.type}` : ''}): ${e.message}`;
}
