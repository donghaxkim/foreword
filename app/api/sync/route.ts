import { Octokit } from "octokit";
import { NextRequest, NextResponse } from "next/server";

const CADDY_REPO = process.env.GITHUB_CADDY_REPO ?? "getcaddy/caddy";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        { githubContent: "", linearContent: "" },
        { status: 200 }
      );
    }

    const b = body as Record<string, unknown>;
    // Support legacy { integration, apiKey } for backward compatibility
    let githubApiKey = typeof b.githubApiKey === "string" ? b.githubApiKey.trim() : "";
    let linearApiKey = typeof b.linearApiKey === "string" ? b.linearApiKey.trim() : "";
    if (b.integration === "github" && typeof b.apiKey === "string" && b.apiKey.trim()) {
      githubApiKey = (b.apiKey as string).trim();
    }
    if (b.integration === "linear" && typeof b.apiKey === "string" && b.apiKey.trim()) {
      linearApiKey = (b.apiKey as string).trim();
    }
    // Optional server-side fallback
    if (!githubApiKey && process.env.GITHUB_TOKEN) githubApiKey = process.env.GITHUB_TOKEN;
    if (!linearApiKey && process.env.LINEAR_API_KEY) linearApiKey = process.env.LINEAR_API_KEY;

    const result: {
      githubContent: string;
      linearContent: string;
      githubError?: string;
      linearError?: string;
    } = { githubContent: "", linearContent: "" };

    const [githubResult, linearResult] = await Promise.allSettled([
      githubApiKey ? fetchGitHubContent(githubApiKey) : Promise.resolve(""),
      linearApiKey ? fetchLinearContent(linearApiKey) : Promise.resolve("")
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

async function fetchGitHubContent(apiKey: string): Promise<string> {
  const [owner, repo] = CADDY_REPO.split("/");
  if (!owner || !repo) {
    return "Invalid GITHUB_CADDY_REPO. Use owner/repo.";
  }

  const octokit = new Octokit({ auth: apiKey });
  const cutoff = new Date(Date.now() - SEVEN_DAYS_MS);

  const { data: pulls } = await octokit.rest.pulls.list({
    owner,
    repo,
    state: "closed",
    sort: "updated",
    direction: "desc",
    per_page: 100
  });

  const lines = pulls
    .filter(
      (pr): pr is typeof pr & { merged_at: string } =>
        pr.merged_at != null && new Date(pr.merged_at) >= cutoff
    )
    .map((pr) => {
      const title = pr.title ?? "";
      const desc = (pr.body ?? "").trim().replace(/\s+/g, " ");
      return `${title}: ${desc}`;
    });

  if (lines.length === 0) {
    return "No merged PRs in the last 7 days.";
  }
  return lines.join("\n");
}

async function fetchLinearContent(apiKey: string): Promise<string> {
  const since = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();
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

  if (!res.ok) {
    const text = await res.text();
    console.error("[sync] Linear API error", res.status, text);
    throw new Error("Linear fetch failed");
  }

  const json = (await res.json()) as {
    data?: { issues?: { nodes?: Array<{ title: string; description?: string | null; state?: { name: string }; updatedAt?: string }> } };
    errors?: Array<{ message: string }>;
  };

  if (json.errors?.length) {
    console.error("[sync] Linear GraphQL errors", json.errors);
    throw new Error("Linear query failed");
  }

  const nodes = json.data?.issues?.nodes ?? [];
  const lines = nodes.map((issue) => {
    const title = issue.title ?? "";
    const desc = issue.description ?? "";
    return `${title}: ${desc}`;
  });

  if (lines.length === 0) {
    return "No completed issues updated in the last 7 days.";
  }
  return lines.join("\n");
}
