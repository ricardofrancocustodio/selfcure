// ---------------------------------------------------------------------------
// Git host providers — mirror of packages/cli/src/git-providers.ts
//
// Duplicated intentionally: @selfcure/cli already depends on @selfcure/web,
// so the reverse import would create a circular dependency. Keep this file
// in lockstep with the CLI counterpart.
// ---------------------------------------------------------------------------

import { execSync } from 'node:child_process';

export type GitProviderId = 'github' | 'gitlab';

export interface GitProvider {
  id:         GitProviderId;
  displayName: string;
  prKindLabel: string;
  ensureReady(gitRoot: string): void;
  resolveBaseBranch(configured: string | undefined, gitRoot: string): string | undefined;
  openPr(opts: {
    gitRoot:     string;
    branch:      string;
    baseBranch?: string;
    title:       string;
    bodyFile:    string;
  }): string;
}

const githubProvider: GitProvider = {
  id:          'github',
  displayName: 'GitHub',
  prKindLabel: 'pull request',
  ensureReady(_gitRoot) {
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
    return raw.split('\n').filter((l) => l.startsWith('https://')).pop()?.trim() ?? raw.trim();
  },
};

const gitlabProvider: GitProvider = {
  id:          'gitlab',
  displayName: 'GitLab',
  prKindLabel: 'merge request',
  ensureReady(_gitRoot) {
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
      const json = JSON.parse(out) as { default_branch?: string };
      return json.default_branch || undefined;
    } catch {
      return undefined;
    }
  },
  openPr({ gitRoot, branch, baseBranch, title, bodyFile }) {
    const baseFlag = baseBranch ? ` --target-branch ${JSON.stringify(baseBranch)}` : '';
    const raw = execSync(
      `glab mr create --title ${JSON.stringify(title)} ` +
      `--description-file ${JSON.stringify(bodyFile)} ` +
      `--source-branch ${JSON.stringify(branch)}${baseFlag} --yes`,
      { cwd: gitRoot, stdio: 'pipe', encoding: 'utf-8' },
    ) as string;
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
    const urlLine = lines.reverse().find((l) => /https?:\/\/\S+/.test(l));
    if (!urlLine) return raw.trim();
    const match = urlLine.match(/https?:\/\/\S+/);
    return match ? match[0] : urlLine;
  },
};

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
