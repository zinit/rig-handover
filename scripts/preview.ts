import { mkdirSync, writeFileSync } from 'node:fs';
import { createApp } from '../src/app.js';

// Plan morning-digest § 3. Saves one rig page as a single HTML file for review (ADR 0003): the
// page is self-contained (ADR 0001), so the response body is the whole copy. The banner shows
// LANE_MARKER from .env; run with it unset for the clean-up copy (§ 4). Output goes to var/, which
// git ignores: previews never go in the repo.
const path = process.argv[2] ?? '/digest/2026-10-28';
const out = process.argv[3] ?? `var/preview/${path.replace(/^\//, '').replaceAll('/', '-')}.html`;

const res = await createApp().request(path);
if (res.status !== 200) throw new Error(`${path} answered ${res.status}`);
mkdirSync(out.slice(0, out.lastIndexOf('/')), { recursive: true });
writeFileSync(out, await res.text());
console.log(out);
