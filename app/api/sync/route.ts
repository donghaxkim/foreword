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
      return NextResponse.json({ error: "Missing integration or apiKey" }, { status: 400 });
    }

    const { integration, apiKey } = body as Record<string, unknown>;

    if (integration !== "github" && integration !== "linear") {
      return NextResponse.json({ error: "integration must be 'github' or 'linear'" }, { status: 400 });
    }

    if (typeof apiKey !== "string" || apiKey.trim() === "") {
      return NextResponse.json({ error: "Missing or empty apiKey" }, { status: 400 });
    }

    const token = apiKey.trim();

    if (integration === "github") {
      const ships = await fetchGitHubShips(token);
      return NextResponse.json({ ships });
    }

    const ships = await fetchLinearShips(token);
    return NextResponse.json({ ships });
  } catch (err) {
    console.error("[sync]", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}

async function fetchGitHubShips(apiKey: string): Promise<string> {
  const [owner, repo] = CADDY_REPO.split("/");
  if (!owner || !repo) {
    return "Invalid GITHUB_CADDY_REPO. Use owner/repo.";
  }

  const since = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=100`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${apiKey}`,
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[sync] GitHub API error", res.status, text);
    throw new Error("GitHub fetch failed");
  }

  const data = (await res.json()) as Array<{ closed_at: string | null; title: string; body: string | null }>;
  const cutoff = Date.now() - SEVEN_DAYS_MS;
  const lines = data
    .filter((pr) => pr.closed_at && new Date(pr.closed_at).getTime() >= cutoff)
    .map((pr) => {
      const title = pr.title ?? "";
      const desc = (pr.body ?? "").trim().replace(/\s+/g, " ").slice(0, 300);
      return `PR Title: ${title} - ${desc}`;
    });

  if (lines.length === 0) {
    return "No closed PRs in the last 7 days.";
  }
  return lines.join("\n");
}

async function fetchLinearShips(apiKey: string): Promise<string> {
  const query = `
    query SyncDoneIssues {
      issues(
        filter: {
          state: { name: { eq: "Done" } }
          cycle: { isActive: { eq: true } }
        }
        first: 100
      ) {
        nodes {
          title
          state { name }
        }
      }
    }
  `;

  // Personal API keys (lin_api_*) work bare; OAuth tokens need Bearer prefix
  const authHeader = apiKey.startsWith("lin_") ? apiKey : `Bearer ${apiKey}`;

  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader
    },
    body: JSON.stringify({ query })
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[sync] Linear API error", res.status, text);
    throw new Error("Linear fetch failed");
  }

  const json = (await res.json()) as {
    data?: { issues?: { nodes?: Array<{ title: string; state?: { name: string } }> } };
    errors?: Array<{ message: string }>;
  };

  if (json.errors?.length) {
    console.error("[sync] Linear GraphQL errors", json.errors);
    throw new Error("Linear query failed");
  }

  const nodes = json.data?.issues?.nodes ?? [];
  const lines = nodes.map((issue) => {
    const title = issue.title ?? "";
    const status = issue.state?.name ?? "Done";
    return `Task: ${title} - ${status}`;
  });

  if (lines.length === 0) {
    return "No issues in Done state for the current cycle.";
  }
  return lines.join("\n");
}
