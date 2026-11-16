// makefun-frontend-01 entry (Node 22, standard library only).
//
// The frontend lives in app/ beside this file: plain static files a
// browser opens at app/index.html — ES modules, one stylesheet, no build
// step — reading make.fun's public API. This program hands it in: it
// copies app/ and screenshots/ into the output directory and writes
// dossier.json, the summary the judge reads (the screenshots, the first
// load's files and bytes, and the app's source), using the vendored
// make.fun library. vendor/makefun-frontend.ts is the kit's copy,
// unchanged: the scorer rebuilds the dossier with the same library and
// compares it byte for byte.
//
// Build it first, then serve the app locally (a tiny static server over
// app/), open it in a desktop browser on live data, and put 3 screenshots
// of it in screenshots/ — the first by name is the cover. Then run:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const repo = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** Copy a directory tree, creating the destination first. */
function copyDir(from, to) {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

/** The plain files of a directory, for the summary this program prints. */
function plainFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => statSync(join(dir, name)).isFile());
}

mkdirSync(out, { recursive: true });
copyDir(join(repo, 'app'), join(out, 'app'));
copyDir(join(repo, 'screenshots'), join(out, 'screenshots'));

// The scorer's caps: at most 3 screenshots of 256 KiB, app/ at most 993
// files and 16 MiB, and the dossier's text at most 160 KiB.
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 3, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 16777216,
});
writeFileSync(join(out, 'dossier.json'), dossier);

const shots = plainFiles(join(out, 'screenshots'));
const appFiles = plainFiles(join(out, 'app'));
console.log(`handed in ${appFiles.length} app files and ${shots.length} screenshots -> ${out}/dossier.json`);
