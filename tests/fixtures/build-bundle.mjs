// Builds the self-contained IIFE bundle (Lit + Floating UI inlined) that the
// fixture HTML pages load via <script src="select-lab-bundle.js">. Generated
// on demand so `node tests/<file>.mjs` works right after `npm install`, on any
// machine — nothing here should ever be a hardcoded, machine-specific path.
import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const outfile = path.join(here, 'select-lab-bundle.js');

export async function ensureBundle() {
  await esbuild.build({
    entryPoints: [path.join(here, '../../demo/standalone.ts')],
    bundle: true,
    format: 'iife',
    minify: true,
    outfile,
  });
  return outfile;
}
