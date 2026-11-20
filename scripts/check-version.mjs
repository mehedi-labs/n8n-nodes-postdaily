// Fails when NODE_VERSION in GenericFunctions.ts differs from package.json.
// The node sends it as its User-Agent, so PostDaily can tell versions apart.
// `npm run release` bumps package.json only: update NODE_VERSION in the same commit.
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const source = readFileSync(new URL('../nodes/PostDaily/GenericFunctions.ts', import.meta.url), 'utf8');
const found = source.match(/export const NODE_VERSION = '([^']+)'/)?.[1];

if (found !== version) {
	console.error(`NODE_VERSION is ${found ?? 'missing'} but package.json is ${version}. Update nodes/PostDaily/GenericFunctions.ts.`);
	process.exit(1);
}

console.log(`NODE_VERSION matches package.json (${version}).`);
