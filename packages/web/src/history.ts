// ---------------------------------------------------------------------------
// Local history (free) — stores a per-run snapshot in .selfcure/history.json
// so the /evolution screen can chart maturity over time on this machine.
//
// The paid "shared history" version replaces this with a cloud store, but the
// shape is identical so the front-end never needs to know.
// ---------------------------------------------------------------------------

import fs from 'fs-extra';
import path from 'node:path';

export interface HistorySnapshot {
  /** ISO 8601 timestamp */
  ts: string;
  /** Average testability score (0-100) across all components, weighted by element count */
  overallScore: number;
  /** Total interactive elements analysed */
  totalElements: number;
  /** Elements flagged as ambiguous OR low-score */
  totalIssues: number;
  /** Elements with a non-empty data-testid (governed) */
  governedElements: number;
  /** Number of components scanned */
  totalComponents: number;
}

const HISTORY_DIR  = '.selfcure';
const HISTORY_FILE = 'history.json';
const MAX_ENTRIES  = 500; // hard cap so the file stays readable

function historyPath(cwd: string): string {
  return path.join(cwd, HISTORY_DIR, HISTORY_FILE);
}

export async function readHistory(cwd: string): Promise<HistorySnapshot[]> {
  try {
    const raw = await fs.readFile(historyPath(cwd), 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as HistorySnapshot[];
  } catch {
    return [];
  }
}

export async function appendHistory(cwd: string, snapshot: HistorySnapshot): Promise<void> {
  const file = historyPath(cwd);
  const existing = await readHistory(cwd);
  existing.push(snapshot);
  // Trim oldest entries if we exceed the cap.
  const trimmed = existing.length > MAX_ENTRIES
    ? existing.slice(existing.length - MAX_ENTRIES)
    : existing;
  await fs.outputFile(file, JSON.stringify(trimmed, null, 2), 'utf-8');
}
