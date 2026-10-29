import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, Night, NightCounts, ReadNight, RunLine, RunStatus } from './types.js';

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES: readonly RunStatus[] = ['ok', 'retry', 'fail'];

// The edge: a raw line in, a RunLine or null out. Never throws.
export function parseLine(text: string): RunLine | null {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const { at, job, status, owner, error } = o;
  if (typeof at !== 'string' || Number.isNaN(Date.parse(at))) return null;
  if (typeof job !== 'string' || job === '') return null;
  if (!STATUSES.includes(status as RunStatus)) return null;
  if (owner !== undefined && owner !== null && typeof owner !== 'string') return null;
  if (error !== undefined && typeof error !== 'string') return null;
  const line: RunLine = { at, job, status: status as RunStatus, owner: owner ?? null };
  if (error !== undefined) line.error = error;
  return line;
}

// Lines are taken in file order: the last line for a job sets its status, error and owner.
export function digest(night: string, text: string): Night {
  const byJob = new Map<string, DigestRow>();
  const counts: NightCounts = { ok: 0, retry: 0, fail: 0 };
  let badLines = 0;

  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (!line) {
      badLines++;
      continue;
    }
    counts[line.status]++;
    const row = byJob.get(line.job);
    if (!row) {
      byJob.set(line.job, {
        job: line.job,
        owner: line.owner,
        runs: 1,
        retries: line.status === 'retry' ? 1 : 0,
        lastStatus: line.status,
        lastError: line.error ?? null,
        firstAt: line.at,
        lastAt: line.at,
      });
      continue;
    }
    row.runs++;
    if (line.status === 'retry') row.retries++;
    row.owner = line.owner;
    row.lastStatus = line.status;
    row.lastError = line.error ?? null;
    row.lastAt = line.at;
  }

  const rows = [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { night, rows, badLines, counts };
}

// runs/ is read-only: this only ever reads. `night` must be YYYY-MM-DD, so it can't leave runsDir.
export const readNight: ReadNight = (runsDir, night) => {
  if (!NIGHT.test(night)) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
  return digest(night, text);
};
