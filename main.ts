// makefun-frontend-01 entry (Node 22, standard library only).
//
// The frontend lives in app/ beside this file: plain static files a browser
// opens at app/index.html (ES modules, one stylesheet, no build step),
// reading make.fun's public API. This program hands it in: it copies app/
// and screenshots/ into the output directory and writes dossier.json, the
// summary the judge reads (the screenshots, the first load's files and
// bytes, and the app's source), using the vendored make.fun library.
// vendor/makefun-frontend.ts is the kit's copy, unchanged: the scorer
// rebuilds the dossier with the same library and compares it byte for byte.
//
// Serve the app locally first (a tiny static server on app/), open it in a
// desktop browser on live data, and put 3 screenshots of it in
// screenshots/ — the first by name is the cover. Then run:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const repo = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(repo, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(repo, 'screenshots'))) {
  cpSync(join(repo, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The caps the scorer enforces: at most 3 screenshots of 256 KiB, app/ at
// most 993 files and 16 MiB, and the dossier's text at most 160 KiB.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 3, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 16777216,
  }),
);
