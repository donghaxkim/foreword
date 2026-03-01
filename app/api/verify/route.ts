import { Octokit } from "octokit";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ valid: false, error: "Invalid JSON body" }, { status: 400 });
    }

    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ valid: false, error: "Missing integration or apiKey" }, { status: 400 });
    }

    const { integration, apiKey } = body as Record<string, unknown>;

    if (integration !== "github" && integration !== "linear") {
      return NextResponse.json({ valid: false, error: "integration must be 'github' or 'linear'" }, { status: 400 });
    }

    if (typeof apiKey !== "string" || apiKey.trim() === "") {
      return NextResponse.json({ valid: false, error: "Missing or empty apiKey" }, { status: 400 });
    }

    const token = apiKey.trim();

    if (integration === "github") {
      const result = await verifyGitHub(token);
      return NextResponse.json(result);
    }

    const result = await verifyLinear(token);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[verify]", err);
    return NextResponse.json({ valid: false, scopes: [] }, { status: 200 });
  }
}

async function verifyGitHub(
  apiKey: string
): Promise<{ valid: boolean; scopes: string[]; scopeWarning?: string }> {
  try {
    const octokit = new Octokit({ auth: apiKey });
    const res = await octokit.rest.users.getAuthenticated();
    const scopeHeader =
      (res.headers as Record<string, string | undefined>)["x-oauth-scopes"] ?? "";
    const scopes = scopeHeader
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const broadScopes = ["admin:org", "admin:repo_hook", "delete_repo", "admin:gpg_key"];
    const hasBroad = scopes.filter((s) => broadScopes.includes(s));
    const scopeWarning = hasBroad.length > 0
      ? `Token has broad scopes (${hasBroad.join(", ")}). Consider using a fine-grained PAT with only repo:read.`
      : undefined;

    return { valid: true, scopes, scopeWarning };
  } catch {
    return { valid: false, scopes: [] };
  }
}

async function verifyLinear(
  apiKey: string
): Promise<{ valid: boolean; scopes: string[] }> {
  const authHeader = apiKey.startsWith("lin_") ? apiKey : `Bearer ${apiKey}`;
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({ query: "query { viewer { id } }" }),
  });

  if (!res.ok) return { valid: false, scopes: [] };

  const json = (await res.json()) as {
    data?: { viewer?: { id: string } };
    errors?: unknown[];
  };
  const valid = !json.errors?.length && !!json.data?.viewer?.id;
  return { valid, scopes: valid ? ["read"] : [] };
}
