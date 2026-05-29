/*
   ____                   __  __                                 
  / __ \                 |  \/  |                                
 | |  | |_ __   ___ _ __ | \  / | ___ _ __ ___   ___  _ __ _   _ 
 | |  | | '_ \ / _ \ '_ \| |\/| |/ _ \ '_ ` _ \ / _ \| '__| | | |
 | |__| | |_) |  __/ | | | |  | |  __/ | | | | | (_) | |  | |_| |
  \____/| .__/ \___|_| |_|_|  |_|\___|_| |_| |_|\___/|_|   \__, |
        | |                                                 __/ |
        |_|                                                |___/ 
  CaviraOSS @ 2026

 - filename
 - what is the file used for
*/

import {
  SourceAuthError,
  SourceConfigError,
  type SourceConnector,
  type SourceContent,
  type SourceItem,
} from "./framework";

export type GitHubSourceConfig = {
  repo?: string;
  token?: string;
  branch?: string;
  path?: string;
  limit?: number;
  include?: Array<"files" | "issues">;
  fetcher?: typeof fetch;
};

const githubApi = "https://api.github.com";

const splitRepo = (repo?: string) => {
  const parts = (repo || "").split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new SourceConfigError("repo must be owner/name", "github");
  }
  return { owner: parts[0], name: parts[1] };
};

const boundedLimit = (limit?: number) =>
  Math.max(1, Math.min(100, Math.floor(limit || 25)));

export function createGitHubSource(
  config: GitHubSourceConfig,
): SourceConnector {
  const repo = splitRepo(config.repo);
  const branch = config.branch || "main";
  const include = config.include?.length ? config.include : ["files", "issues"];
  const limit = boundedLimit(config.limit);
  const fetcher = config.fetcher || fetch;

  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "openmemory-js",
  };
  if (config.token) headers.authorization = `Bearer ${config.token}`;

  const requestJson = async <T>(url: string): Promise<T> => {
    const response = await fetcher(url, { headers });
    if (response.status === 401 || response.status === 403) {
      throw new SourceAuthError(
        `GitHub auth failed with HTTP ${response.status}`,
        "github",
      );
    }
    if (!response.ok) {
      throw new SourceConfigError(
        `GitHub request failed with HTTP ${response.status}`,
        "github",
      );
    }
    return (await response.json()) as T;
  };

  return {
    kind: "github",
    async list(): Promise<SourceItem[]> {
      const items: SourceItem[] = [];

      if (include.includes("files")) {
        const tree = await requestJson<{
          tree?: Array<{ path: string; type: string }>;
        }>(
          `${githubApi}/repos/${repo.owner}/${repo.name}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
        );
        const prefix = config.path ? `${config.path.replace(/\/$/, "")}/` : "";
        for (const entry of tree.tree || []) {
          if (items.length >= limit) break;
          if (entry.type !== "blob") continue;
          if (prefix && !entry.path.startsWith(prefix)) continue;
          items.push({
            id: `file:${entry.path}`,
            name: entry.path,
            type: "file",
            uri: `https://github.com/${repo.owner}/${repo.name}/blob/${branch}/${entry.path}`,
            metadata: { repo: config.repo, branch },
          });
        }
      }

      if (include.includes("issues") && items.length < limit) {
        const issues = await requestJson<
          Array<{ number: number; title: string; html_url: string }>
        >(
          `${githubApi}/repos/${repo.owner}/${repo.name}/issues?state=all&per_page=${limit - items.length}`,
        );
        for (const issue of issues) {
          items.push({
            id: `issue:${issue.number}`,
            name: issue.title,
            type: "issue",
            uri: issue.html_url,
            metadata: { repo: config.repo, number: issue.number },
          });
        }
      }

      return items;
    },
    async fetch(item_id: string): Promise<SourceContent> {
      if (item_id.startsWith("file:")) {
        const filePath = item_id.slice("file:".length);
        const response = await fetcher(
          `https://raw.githubusercontent.com/${repo.owner}/${repo.name}/${branch}/${filePath}`,
          { headers },
        );
        if (!response.ok) {
          throw new SourceConfigError(
            `GitHub raw file failed with HTTP ${response.status}`,
            "github",
          );
        }
        return {
          id: item_id,
          name: filePath,
          type: "file",
          uri: `https://github.com/${repo.owner}/${repo.name}/blob/${branch}/${filePath}`,
          content_type: "text/markdown",
          content: await response.text(),
          metadata: { repo: config.repo, branch, path: filePath },
        };
      }

      if (item_id.startsWith("issue:")) {
        const number = item_id.slice("issue:".length);
        const issue = await requestJson<{
          title: string;
          body?: string;
          html_url: string;
          state: string;
        }>(`${githubApi}/repos/${repo.owner}/${repo.name}/issues/${number}`);
        return {
          id: item_id,
          name: issue.title,
          type: "issue",
          uri: issue.html_url,
          content_type: "text/markdown",
          content: `# ${issue.title}\n\n${issue.body || ""}`.trim(),
          metadata: { repo: config.repo, number, state: issue.state },
        };
      }

      throw new SourceConfigError(
        `unknown GitHub item id: ${item_id}`,
        "github",
      );
    },
  };
}
