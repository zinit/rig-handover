import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { digest, readNight } from '../src/digest/read.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');
  const row = (job: string) => night?.rows.find((r) => r.job === job);

  it('has 5 jobs, sorted, and counts the 1 bad line', () => {
    expect(night).not.toBeNull();
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night?.badLines).toBe(1);
    expect(night?.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
  });

  it('fixtures/refresh: 3 retries, ends ok', () => {
    expect(row('fixtures/refresh')).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: null,
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
  });

  it('notes/backup fails with "quota exceeded"', () => {
    expect(row('notes/backup')).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded', owner: 'lane-07' });
  });

  it('keeps digest/render with a null owner', () => {
    expect(row('digest/render')).toMatchObject({ owner: null, runs: 1, lastStatus: 'ok' });
  });

  it('keeps the offset from the log', () => {
    expect(row('lane/sync')).toMatchObject({
      runs: 8,
      retries: 1,
      firstAt: '2026-10-28T23:00:06+01:00',
      lastAt: '2026-10-29T05:00:04+01:00',
    });
  });
});

describe('readNight edges', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('no file for the night: null', () => {
    expect(readNight(dir, '2026-01-01')).toBeNull();
  });

  it('empty file: a night with no rows', () => {
    writeFileSync(join(dir, '2026-01-01.jsonl'), '');
    expect(readNight(dir, '2026-01-01')).toEqual({
      night: '2026-01-01',
      rows: [],
      badLines: 0,
      counts: { ok: 0, retry: 0, fail: 0 },
    });
  });

  it('refuses a night that is not YYYY-MM-DD', () => {
    expect(readNight(dir, '../runs/2026-10-28')).toBeNull();
  });
});

describe('digest', () => {
  it('counts lines without a valid at / job / status as bad, skips blank ones', () => {
    const text = [
      '{"at":"2026-01-01T01:00:00+01:00","job":"a","status":"ok","owner":"x"}',
      '',
      '{"job":"a","status":"ok"}',
      '{"at":"2026-01-01T02:00:00+01:00","job":"a","status":"done"}',
      '[1,2]',
      'not json',
      '',
    ].join('\n');
    const n = digest('2026-01-01', text);
    expect(n.rows).toHaveLength(1);
    expect(n.badLines).toBe(4);
  });
});
