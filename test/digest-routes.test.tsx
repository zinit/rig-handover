import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const GOOD = '2026-10-28';
const EMPTY = '2026-01-01';
const BAD = '2026-01-02';
const MISSING = '2026-01-03';

let dir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  copyFileSync(join('runs', `${GOOD}.jsonl`), join(dir, `${GOOD}.jsonl`));
  writeFileSync(join(dir, `${EMPTY}.jsonl`), '');
  writeFileSync(
    join(dir, `${BAD}.jsonl`),
    [
      '{"at":"2026-01-02T01:00:00+01:00","job":"alpha","status":"ok","owner":"ann"}',
      'this is not json',
      '{"at":"2026-01-02T02:00:00+01:00","job":"beta","status":"fail","owner":null,"error":"boom"}',
      '',
    ].join('\n'),
  );
  app = createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir: dir,
  });
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('GET /digest/:night', () => {
  it('200: heading and header cells for a good night', async () => {
    const res = await app.request(`/digest/${GOOD}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain(`digest · ${GOOD}`);
    for (const h of ['job', 'owner', 'runs', 'retries', 'last status', 'last error', 'first', 'last']) {
      expect(html).toContain(`>${h}</th>`);
    }
    expect(html).not.toContain('nothing ran');
    expect(html).not.toContain('bad line');
  });

  it('404: no run log for a night with no file', async () => {
    const res = await app.request(`/digest/${MISSING}`);
    const html = await res.text();
    expect(res.status).toBe(404);
    expect(html).toContain(`digest · ${MISSING}`);
    expect(html).toContain(`no run log for ${MISSING}`);
  });

  it('empty night: nothing ran, no table', async () => {
    const res = await app.request(`/digest/${EMPTY}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
    expect(html).not.toContain('<table');
  });

  it('bad line: says 1 bad line and still shows the good rows', async () => {
    const res = await app.request(`/digest/${BAD}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('1 bad line');
    expect(html).not.toContain('1 bad lines');
    expect(html).toContain('alpha');
    expect(html).toContain('beta');
    expect(html).toContain('fail ⚠');
    expect(html).toContain('—');
  });
});

describe('GET /api/digest/:night', () => {
  it('200: the Night object', async () => {
    const res = await app.request(`/api/digest/${GOOD}`);
    const body = (await res.json()) as {
      night: string;
      rows: { job: string }[];
      badLines: number;
      counts: Record<string, number>;
    };
    expect(res.status).toBe(200);
    expect(body.night).toBe(GOOD);
    expect(body.rows.length).toBeGreaterThan(0);
    expect(body.badLines).toBe(0);
    expect(Object.keys(body.counts).sort()).toEqual(['fail', 'ok', 'retry']);
    const jobs = body.rows.map((r) => r.job);
    expect(jobs).toEqual([...jobs].sort());
  });

  it('404: error body for a night with no file', async () => {
    const res = await app.request(`/api/digest/${MISSING}`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log', night: MISSING });
  });

  it('empty night: rows []', async () => {
    const res = await app.request(`/api/digest/${EMPTY}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      night: EMPTY,
      rows: [],
      badLines: 0,
      counts: { ok: 0, retry: 0, fail: 0 },
    });
  });

  it('bad line: badLines 1, good lines counted', async () => {
    const res = await app.request(`/api/digest/${BAD}`);
    const body = (await res.json()) as { badLines: number; rows: { job: string }[]; counts: Record<string, number> };
    expect(res.status).toBe(200);
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha', 'beta']);
    expect(body.counts).toEqual({ ok: 1, retry: 0, fail: 1 });
  });
});
