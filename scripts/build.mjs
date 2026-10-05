// Builds dist/index.js (one self-contained file) and one MCPB bundle per toolset in dist/.
//   node scripts/build.mjs            all bundles
//   node scripts/build.mjs travel     just one
import { execFileSync } from 'node:child_process';
import { copyFileSync, createReadStream, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { LISTINGS } from './listings.mjs';
import { selectTools } from '../src/tools.js';

const root = new URL('..', import.meta.url).pathname;
const pkg = JSON.parse(readFileSync(`${root}package.json`, 'utf8'));
const only = process.argv.slice(2);

rmSync(`${root}dist`, { recursive: true, force: true });
await build({
    entryPoints: [`${root}src/index.js`],
    outfile: `${root}dist/index.js`,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node18',
    legalComments: 'none',
    banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
});

const sha256 = (file) => new Promise((resolve) => {
    const h = createHash('sha256');
    createReadStream(file).on('data', (d) => h.update(d)).on('end', () => resolve(h.digest('hex')));
});

const built = {};
for (const [toolset, l] of Object.entries(LISTINGS)) {
    if (only.length && !only.includes(toolset)) continue;
    const dir = `${root}build/${toolset}`;
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(`${dir}/server`, { recursive: true });
    copyFileSync(`${root}dist/index.js`, `${dir}/server/index.js`);
    copyFileSync(`${root}../marketing/icons/${l.icon}`, `${dir}/icon.png`);
    const tools = selectTools(toolset);
    const manifest = {
        manifest_version: '0.3',
        name: toolset === 'all' ? 'automationnation-mcp' : `automationnation-${toolset}`,
        display_name: toolset === 'all' ? l.title : `${l.title} (AutomationNation)`,
        version: pkg.version,
        description: l.description,
        long_description: `${l.description}\n\nEach tool call runs an AutomationNation Actor on your own Apify account and is billed per result there; Apify's free plan includes monthly credit. Get your API token at https://console.apify.com/settings/integrations.\n\nTools: ${tools.map((t) => t.name).join(', ')}, get_run_results.`,
        author: { name: 'AutomationNation', url: 'https://retracn.github.io/automationnation-actors/' },
        repository: { type: 'git', url: 'https://github.com/retracn/automationnation-mcp' },
        homepage: 'https://github.com/retracn/automationnation-mcp',
        documentation: 'https://github.com/retracn/automationnation-mcp#readme',
        support: 'https://github.com/retracn/automationnation-mcp/issues',
        icon: 'icon.png',
        server: {
            type: 'node',
            entry_point: 'server/index.js',
            mcp_config: {
                command: 'node',
                args: ['${__dirname}/server/index.js'],
                env: { APIFY_TOKEN: '${user_config.apify_token}', AUTOMATIONNATION_TOOLS: toolset },
            },
        },
        tools: [
            ...tools.map((t) => ({ name: t.name, description: t.description.split('. ')[0].replace(/\.$/, '') + '.' })),
            { name: 'get_run_results', description: 'Fetch the results of a run that was still going when its tool returned.' },
        ],
        keywords: ['mcp', 'apify', ...l.keywords],
        license: 'MIT',
        compatibility: { platforms: ['darwin', 'win32', 'linux'], runtimes: { node: '>=18.0.0' } },
        user_config: {
            apify_token: {
                type: 'string',
                title: 'Apify API token',
                description: 'Runs are billed per result on this Apify account. Free account: https://console.apify.com/sign-up, token: https://console.apify.com/settings/integrations',
                sensitive: true,
                required: true,
            },
        },
    };
    writeFileSync(`${dir}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
    const out = `${root}dist/${manifest.name}.mcpb`;
    execFileSync(`${root}node_modules/.bin/mcpb`, ['pack', dir, out], { stdio: ['ignore', 'ignore', 'inherit'] });
    built[toolset] = { file: `dist/${manifest.name}.mcpb`, sha256: await sha256(out), tools: manifest.tools.length };
    console.log(`${toolset.padEnd(14)} ${manifest.tools.length} tools  ${built[toolset].file}`);
}
writeFileSync(`${root}dist/bundles.json`, `${JSON.stringify(built, null, 2)}\n`);
