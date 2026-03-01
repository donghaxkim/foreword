import { Octokit } from "octokit";
import { NextRequest, NextResponse } from "next/server";
import { loadTokensForDevice } from "@/app/lib/tokens";

const CADDY_REPO = process.env.GITHUB_CADDY_REPO ?? "getcaddy/caddy";
const DEFAULT_SYNC_DAYS = 7;
const MIN_SYNC_DAYS = 1;
const MAX_SYNC_DAYS = 90;

function parseSyncDays(body: Record<string, unknown>): number {
  const raw = body.days;
  if (raw === undefined || raw === null) return DEFAULT_SYNC_DAYS;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_SYNC_DAYS;
  return Math.max(MIN_SYNC_DAYS, Math.min(MAX_SYNC_DAYS, Math.floor(n)));
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown> = {};
    try {
      const parsed = await request.json();
      if (typeof parsed === "object" && parsed !== null) {
        body = parsed as Record<string, unknown>;
      }
    } catch {
      // Empty or invalid JSON body is OK — we'll try Supabase tokens
    }

    // Load tokens from Supabase (primary), with body fallback for dev/testing
    const deviceTokens = await loadTokensForDevice(request).catch(() => ({} as { github?: string; linear?: string }));

    let githubApiKey = deviceTokens.github ?? "";
    let linearApiKey = deviceTokens.linear ?? "";

    // Fallback: body tokens for dev/testing when Supabase isn't configured
    if (!githubApiKey && typeof body.githubApiKey === "string" && body.githubApiKey.trim()) {
      githubApiKey = body.githubApiKey.trim();
    }
    if (!linearApiKey && typeof body.linearApiKey === "string" && body.linearApiKey.trim()) {
      linearApiKey = body.linearApiKey.trim();
    }
    // Legacy { integration, apiKey } format
    if (!githubApiKey && body.integration === "github" && typeof body.apiKey === "string" && body.apiKey.trim()) {
      githubApiKey = (body.apiKey as string).trim();
    }
    if (!linearApiKey && body.integration === "linear" && typeof body.apiKey === "string" && body.apiKey.trim()) {
      linearApiKey = (body.apiKey as string).trim();
    }
    // Env var fallback
    if (!githubApiKey && process.env.GITHUB_TOKEN) githubApiKey = process.env.GITHUB_TOKEN;
    if (!linearApiKey && process.env.LINEAR_API_KEY) linearApiKey = process.env.LINEAR_API_KEY;

    const syncDays = parseSyncDays(body);

    const result: {
      githubContent: string;
      linearContent: string;
      githubError?: string;
      linearError?: string;
    } = { githubContent: "", linearContent: "" };

    const [githubResult, linearResult] = await Promise.allSettled([
      githubApiKey ? fetchGitHubContent(githubApiKey, syncDays) : Promise.resolve(""),
      linearApiKey ? fetchLinearContent(linearApiKey, syncDays) : Promise.resolve("")
    ]);

    if (githubResult.status === "fulfilled") {
      result.githubContent = githubResult.value;
    } else {
      result.githubError = githubResult.reason?.message ?? "GitHub fetch failed";
      console.error("[sync] GitHub error", githubResult.reason);
    }

    if (linearResult.status === "fulfilled") {
      result.linearContent = linearResult.value;
    } else {
      result.linearError = linearResult.reason?.message ?? "Linear fetch failed";
      console.error("[sync] Linear error", linearResult.reason);
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[sync]", err);
    return NextResponse.json(
      { githubContent: "", linearContent: "", error: "Sync failed" },
      { status: 500 }
    );
  }
}

async function fetchGitHubContent(apiKey: string, days: number): Promise<string> {
  const [owner, repo] = CADDY_REPO.split("/");
  if (!owner || !repo) {
    return "Invalid GITHUB_CADDY_REPO. Use owner/repo.";
  }

  const rangeMs = days * 24 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - rangeMs);
  const sinceIso = cutoff.toISOString();
  const dayLabel = days === 1 ? "last day" : `last ${days} days`;

  const octokit = new Octokit({ auth: apiKey });

  // Fetch merged PRs and commits in parallel
  const [pullsRes, commitsRes] = await Promise.all([
    octokit.rest.pulls.list({
      owner,
      repo,
      state: "closed",
      sort: "updated",
      direction: "desc",
      per_page: 100
    }),
    octokit.rest.repos.listCommits({
      owner,
      repo,
      since: sinceIso,
      per_page: 100
    })
  ]);

  const pulls = pullsRes.data;
  const commits = commitsRes.data;

  const prLines = pulls
    .filter(
      (pr): pr is typeof pr & { merged_at: string } =>
        pr.merged_at != null && new Date(pr.merged_at) >= cutoff
    )
    .map((pr) => {
      const title = pr.title ?? "";
      const desc = (pr.body ?? "").trim().replace(/\s+/g, " ");
      return `${title}: ${desc}`;
    });

  // commit.commit.message is "Subject\n\nBody" or just "Subject"
  const commitLines = commits.map((c) => {
    const msg = c.commit?.message ?? "";
    const firstNewline = msg.indexOf("\n\n");
    const subject = firstNewline === -1 ? msg.trim() : msg.slice(0, firstNewline).trim();
    const body = firstNewline === -1 ? "" : msg.slice(firstNewline + 2).trim().replace(/\s+/g, " ");
    return body ? `${subject}: ${body}` : subject;
  });

  const sections: string[] = [];
  if (prLines.length > 0) {
    sections.push(`Merged PRs (${dayLabel}):\n` + prLines.join("\n"));
  }
  if (commitLines.length > 0) {
    sections.push(`Commits (${dayLabel}):\n` + commitLines.join("\n"));
  }

  if (sections.length === 0) {
    return `No merged PRs or commits in the ${dayLabel}.`;
  }
  return sections.join("\n\n");
}

async function fetchLinearContent(apiKey: string, days: number): Promise<string> {
  const rangeMs = days * 24 * 60 * 60 * 1000;
  const since = new Date(Date.now() - rangeMs).toISOString();
  const dayLabel = days === 1 ? "last day" : `last ${days} days`;

  const query = `
    query SyncDoneIssues($since: DateTime!) {
      issues(
        filter: {
          or: [
            { state: { name: { eq: "Done" } } }
            { state: { name: { eq: "Completed" } } }
          ]
          updatedAt: { gte: $since }
        }
        first: 100
      ) {
        nodes {
          title
          description
          state { name }
          updatedAt
        }
      }
    }
  `;

  const authHeader = apiKey.startsWith("lin_") ? apiKey : `Bearer ${apiKey}`;

  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader
    },
    body: JSON.stringify({ query, variables: { since } })
  });

  const rawText = await res.text();
  let json: {
    data?: { issues?: { nodes?: Array<{ title: string; description?: string | null; state?: { name: string }; updatedAt?: string }> } };
    errors?: Array<{ message: string }>;
  };
  try {
    json = rawText ? (JSON.parse(rawText) as typeof json) : {};
  } catch {
    json = {};
  }

  if (!res.ok) {
    console.error("[sync] Linear API error", res.status, rawText.slice(0, 200));
    if (res.status === 401) {
      throw new Error("Linear: Unauthorized. Check that your API key or OAuth token is valid and not expired.");
    }
    if (res.status === 403) {
      throw new Error("Linear: Forbidden. Your token may not have permission to read issues.");
    }
    const msg = (json.errors?.[0]?.message ?? rawText.slice(0, 100)) || `HTTP ${res.status}`;
    throw new Error(`Linear: ${msg}`);
  }

  if (json.errors?.length) {
    console.error("[sync] Linear GraphQL errors", json.errors);
    const msg = json.errors[0]?.message ?? "GraphQL error";
    throw new Error(`Linear: ${msg}`);
  }

  const nodes = json.data?.issues?.nodes ?? [];
  const lines = nodes.map((issue) => {
    const title = issue.title ?? "";
    const desc = issue.description ?? "";
    return `${title}: ${desc}`;
  });

  if (lines.length === 0) {
    return `No completed issues updated in the ${dayLabel}.`;
  }
  return lines.join("\n");
}
