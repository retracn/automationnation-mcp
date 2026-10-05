// Shapes Actor dataset rows into compact objects that fit comfortably in an agent's context.

const isEmpty = (v) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

export function truncate(value, max) {
    if (typeof value !== 'string' || value.length <= max) return value;
    return `${value.slice(0, max).trimEnd()}…`;
}

/** Recursively drops empty values, truncates long strings and caps arrays. */
export function compact(value, { maxString = 500, maxArray = 10 } = {}, depth = 0) {
    if (typeof value === 'string') return truncate(value, maxString);
    if (Array.isArray(value)) {
        return value.slice(0, maxArray).map((v) => compact(v, { maxString, maxArray }, depth + 1)).filter((v) => !isEmpty(v));
    }
    if (value && typeof value === 'object') {
        if (depth > 4) return undefined;
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            const c = compact(v, { maxString, maxArray }, depth + 1);
            if (!isEmpty(c)) out[k] = c;
        }
        return Object.keys(out).length ? out : undefined;
    }
    return value;
}

/**
 * Picks `fields` from each row in that order. A field can be "name" or ["name", {maxString, maxArray}]
 * for a per-field override of the defaults.
 */
export function shape(rows, fields, defaults = {}) {
    return rows.map((row) => {
        const out = {};
        for (const f of fields) {
            const [key, opts] = Array.isArray(f) ? f : [f, {}];
            const v = compact(row[key], { maxString: 300, maxArray: 8, ...defaults, ...opts });
            if (!isEmpty(v)) out[key] = v;
        }
        return out;
    });
}

/** Evenly samples an array down to `max` points (keeps first and last). */
export function downsample(arr, max) {
    if (!Array.isArray(arr) || arr.length <= max) return arr;
    const step = (arr.length - 1) / (max - 1);
    return Array.from({ length: max }, (_, i) => arr[Math.round(i * step)]);
}

export function formatSeconds(sec) {
    const s = Math.max(0, Math.floor(sec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = String(s % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}
