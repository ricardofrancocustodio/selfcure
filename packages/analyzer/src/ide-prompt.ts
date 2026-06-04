// ---------------------------------------------------------------------------
// IDE prompt builder — for users without an LLM API key.
//
// Many users (e.g. corporate Copilot / Cursor seats) can run an AI agent in
// their editor but have no direct access to an API key. Instead of asking for
// a key, selfcure hands them a ready-to-paste prompt that lists exactly which
// elements need a stable `data-testid` and what to name them. They paste it
// into the agent they already have authenticated — selfcure never needs the key.
//
// Pure + deterministic: no I/O, no LLM call. Same input → same prompt.
// ---------------------------------------------------------------------------

/** One flagged element, normalised from a lint issue. */
export interface IdePromptIssue {
  /** Path to the source file containing the element. */
  filePath: string;
  /** Component the element belongs to, when known. */
  componentName?: string;
  /** Element kind: button / input / link / form / custom. */
  elementType: string;
  /** The element's current best selector (helps the agent locate it). */
  selector?: string;
  /** 1-based source line, when known. */
  line?: number;
  /**
   * Why it was flagged:
   *   • 'ambiguous'  — best selector also matches a sibling.
   *   • 'low-score'  — no stable selector (testability below threshold).
   */
  kind: 'ambiguous' | 'low-score';
  /** Human-readable reason when kind === 'ambiguous'. */
  ambiguityReason?: string;
  /** The data-testid selfcure suggests for this element. */
  suggestedTestId: string;
}

export interface IdePromptOptions {
  /** Naming convention shown to the agent. Has a sensible default. */
  convention?: string;
  /** Relativise file paths against this directory (e.g. the project root). */
  baseDir?: string;
}

const DEFAULT_CONVENTION =
  '[component]-[type]-[purpose] in kebab-case (e.g. checkout-select-payment-method)';

/** Normalise to forward slashes, relative to baseDir when given. */
function relPath(filePath: string, baseDir?: string): string {
  let p = filePath;
  if (baseDir && p.startsWith(baseDir)) {
    p = p.slice(baseDir.length).replace(/^[/\\]+/, '');
  }
  return p.replace(/\\/g, '/');
}

/** Build the one-line instruction for a single element. */
function lineFor(issue: IdePromptIssue): string {
  const loc = issue.line ? `L${issue.line} · ` : '';
  // `elementType` is selfcure's classification (button/input/link/form/custom),
  // not the literal HTML tag — phrase it as a word + show the selector so the
  // agent can locate the real element (e.g. a `link` matched by `//a`).
  const where = issue.selector ? ` matched by \`${issue.selector}\`` : '';
  const reason =
    issue.kind === 'ambiguous'
      ? issue.ambiguityReason
        ? `ambiguous — ${issue.ambiguityReason.replace(/\.\s*$/, '')}`
        : 'ambiguous — its best selector also matches a sibling'
      : 'no stable selector (low testability)';
  return `- ${loc}the \`${issue.elementType}\` element${where} — ${reason}. Add \`data-testid="${issue.suggestedTestId}"\`.`;
}

/**
 * Build a paste-ready prompt instructing an IDE AI agent (Copilot, Cursor,
 * Claude Code, …) to add `data-testid` attributes to the flagged elements.
 * Returns an empty string when there are no issues.
 */
export function buildIdePrompt(issues: IdePromptIssue[], opts: IdePromptOptions = {}): string {
  if (issues.length === 0) return '';

  const convention = opts.convention ?? DEFAULT_CONVENTION;

  // Group by file, preserving first-seen order.
  const byFile = new Map<string, IdePromptIssue[]>();
  for (const issue of issues) {
    const key = relPath(issue.filePath, opts.baseDir);
    if (!byFile.has(key)) byFile.set(key, []);
    byFile.get(key)!.push(issue);
  }

  const fileBlocks: string[] = [];
  for (const [file, fileIssues] of byFile) {
    fileBlocks.push(`### ${file}\n${fileIssues.map(lineFor).join('\n')}`);
  }

  return [
    'You are working in a frontend codebase. Add stable `data-testid` attributes to the',
    'interactive elements listed below so automated tests can target them reliably.',
    'Change nothing else — do not alter behavior, styling, or unrelated markup.',
    '',
    `Naming convention: ${convention}.`,
    'Keep every `data-testid` value unique within its file. For elements flagged as',
    'ambiguous, make sure the new value disambiguates it from its siblings.',
    '',
    `Elements to fix (${issues.length} across ${byFile.size} file(s)):`,
    '',
    fileBlocks.join('\n\n'),
    '',
    'After editing, the listed elements should each be addressable by a unique',
    '`data-testid`. Then I can open a pull request with the changes.',
  ].join('\n');
}
