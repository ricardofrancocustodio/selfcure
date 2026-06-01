// ---------------------------------------------------------------------------
// Git host providers — GitHub (`gh`) and GitLab (`glab`).
//
// Both vendors ship a first-party CLI that handles auth, OAuth, and API calls.
// Selfcure delegates the entire authentication surface to that CLI — we never
// store tokens, OAuth client IDs, or repo URLs. The user runs `gh auth login`
// or `glab auth login` once on their machine, and selfcure shells out from
// there.
//
// This file is intentionally duplicated in packages/web/src/git-providers.ts
// to keep both packages dependency-free of each other (CLI already imports
// from @selfcure/web; the reverse would create a circular dependency).
// ---------------------------------------------------------------------------

import { execSync } from 'node:child_process';

export type GitProviderId = 'github' | 'gitlab';

export interface GitProvider {
  id:         GitProviderId;
  /** Human label for marketing copy and error messages */
  displayName: string;
  /** What this host calls a PR — "pull request" (GitHub) or "merge request" (GitLab) */
  prKindLabel: string;
  /**
   * Verify the host CLI is installed and authenticated. Throws with an
   * actionable error message on failure.
   */
  ensureReady(gitRoot: string): void;
  /**
   * Resolve the base branch to open the PR against:
   *   1. Explicit `configured` from `selfcure.config.mjs`.
   *   2. The repo's default branch via the host CLI.
   *   3. `undefined` — caller omits the `--base` flag and the host CLI picks.
   */
  resolveBaseBranch(configured: string | undefined, gitRoot: string): string | undefined;
  /**
   * Open the PR/MR using the host CLI and return its URL.
   * The body must already live in `bodyFile` (a path on disk) to dodge
   * shell-escaping issues with multi-line Markdown.
   */
  openPr(opts: {
    gitRoot:     string;
    branch:      string;
    baseBranch?: string;
    title:       string;
    bodyFile:    string;
  }): string;
}

// ---------------------------------------------------------------------------
// GitHub (`gh`)
// ---------------------------------------------------------------------------

const githubProvider: GitProvider = {
  id:          'github',
  displayName: 'GitHub',
  prKindLabel: 'pull request',

  ensureReady(_gitRoot: string): void {
    try {
      execSync('gh auth status', { stdio: 'pipe' });
    } catch {
      throw new Error(
        'GitHub CLI (gh) is not installed or not authenticated. ' +
        'Install from https://cli.github.com then run: gh auth login',
      );
    }
  },

  resolveBaseBranch(configured, gitRoot) {
    if (configured) return configured;
    try {
      const out = execSync(
        'gh repo view --json defaultBranchRef --jq .defaultBranchRef.name',
        { cwd: gitRoot, stdio: 'pipe', encoding: 'utf-8' },
      ) as string;
      return out.trim() || undefined;
    } catch {
      return undefined;
    }
  },

  openPr({ gitRoot, branch, baseBranch, title, bodyFile }) {
    const baseFlag = baseBranch ? ` --base ${JSON.stringify(baseBranch)}` : '';
    const raw = execSync(
      `gh pr create --title ${JSON.stringify(title)} ` +
      `--body-file ${JSON.stringify(bodyFile)} --head ${JSON.stringify(branch)}${baseFlag}`,
      { cwd: gitRoot, stdio: 'pipe', encoding: 'utf-8' },
    ) as string;
    // gh writes prelude/info to stderr; stdout has the URL on its own line.
    return raw.split('\n').filter((l) => l.startsWith('https://')).pop()?.trim() ?? raw.trim();
  },
};

// ---------------------------------------------------------------------------
// GitLab (`glab`)
// ---------------------------------------------------------------------------

const gitlabProvider: GitProvider = {
  id:          'gitlab',
  displayName: 'GitLab',
  prKindLabel: 'merge request',

  ensureReady(_gitRoot: string): void {
    try {
      execSync('glab auth status', { stdio: 'pipe' });
    } catch {
      throw new Error(
        'GitLab CLI (glab) is not installed or not authenticated. ' +
        'Install from https://gitlab.com/gitlab-org/cli then run: glab auth login',
      );
    }
  },

  resolveBaseBranch(configured, gitRoot) {
    if (configured) return configured;
    try {
      const out = execSync(
        'glab repo view --output json',
        { cwd: gitRoot, stdio: 'pipe', encoding: 'utf-8' },
      ) as string;
      // glab repo view --output json returns { "default_branch": "main", ... }
      const json = JSON.parse(out) as { default_branch?: string };
      return json.default_branch || undefined;
    } catch {
      return undefined;
    }
  },

  openPr({ gitRoot, branch, baseBranch, title, bodyFile }) {
    // `glab mr create` flags:
    //   --source-branch / --target-branch / --title / --description-file
    //   --yes to skip interactive confirmation
    const baseFlag = baseBranch ? ` --target-branch ${JSON.stringify(baseBranch)}` : '';
    const raw = execSync(
      `glab mr create --title ${JSON.stringify(title)} ` +
      `--description-file ${JSON.stringify(bodyFile)} ` +
      `--source-branch ${JSON.stringify(branch)}${baseFlag} --yes`,
      { cwd: gitRoot, stdio: 'pipe', encoding: 'utf-8' },
    ) as string;
    // glab outputs the URL on a line by itself (or as part of "View this merge request: <url>")
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
    const urlLine = lines.reverse().find((l) => /^https?:\/\//.test(l) || /https?:\/\/\S+/.test(l));
    if (!urlLine) return raw.trim();
    const match = urlLine.match(/https?:\/\/\S+/);
    return match ? match[0] : urlLine;
  },
};

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/**
 * Pick the provider for `gitRoot`. Priority:
 *   1. Explicit override (`'github'` or `'gitlab'`).
 *   2. Heuristic on `git remote get-url origin` hostname:
 *      - contains `gitlab` → GitLab
 *      - contains `github` → GitHub
 *      - anything else → GitHub (the safer default)
 */
export function detectProvider(
  gitRoot:  string,
  override: 'github' | 'gitlab' | 'auto' = 'auto',
): GitProvider {
  if (override === 'github') return githubProvider;
  if (override === 'gitlab') return gitlabProvider;
  try {
    const url = execSync('git remote get-url origin', {
      cwd: gitRoot, stdio: 'pipe', encoding: 'utf-8',
    }).toString().trim();
    if (/gitlab/i.test(url)) return gitlabProvider;
    return githubProvider;
  } catch {
    return githubProvider;
  }
}

export { githubProvider, gitlabProvider };
