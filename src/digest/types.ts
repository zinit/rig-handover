// Plan morning-digest § 1. The shapes every part of § 2 builds against; the reader is
// `readNight` in ./read.ts.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl, after it has been checked at the edge.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job. Missing data stays null here; views render it as `—` (styleguide).
// Times are the `at` strings as the log wrote them, offset kept.
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number; // lines for this job
  retries: number; // lines with status `retry`
  lastStatus: RunStatus;
  lastError: string | null; // error on the job's last line, if any
  firstAt: string;
  lastAt: string;
};

// ok / retry / fail lines in a night, for the board link (§ 2c).
export type NightCounts = Record<RunStatus, number>;

export type Night = {
  night: string; // YYYY-MM-DD
  rows: DigestRow[]; // sorted by job; empty when nothing ran
  badLines: number; // lines that didn't parse or lacked at / job / status
  counts: NightCounts;
};

// null = no file for that night (or not a YYYY-MM-DD night): the page answers 404.
// A Night with no rows = the file is there but empty: "nothing ran".
export type ReadNight = (runsDir: string, night: string) => Night | null;
