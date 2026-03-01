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
): Promise<{ valid: boolean; scopes: string[]; scopeWarning?: string; error?: string }> {
  try {
    const octokit = new Octokit({ auth: apiKey });
    const res = await octokit.rest.users.getAuthenticated();
    const headers = res.headers as Record<string, string | undefined>;
    const oauthScopes = headers["x-oauth-scopes"];

    let scopes: string[];
    if (oauthScopes !== undefined && oauthScopes !== "") {
      scopes = oauthScopes.split(",").map((s) => s.trim()).filter(Boolean);
    } else if (apiKey.startsWith("github_pat_")) {
      scopes = ["fine-grained"];
    } else {
      scopes = ["valid"];
    }

    const broadScopes = ["admin:org", "admin:repo_hook", "delete_repo", "admin:gpg_key"];
    const hasBroad = scopes.filter((s) => broadScopes.includes(s));
    const scopeWarning = hasBroad.length > 0
      ? `Token has broad scopes (${hasBroad.join(", ")}). Consider using a fine-grained PAT with only repo:read.`
      : undefined;

    return { valid: true, scopes, scopeWarning };
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    if (status === 401) {
      return { valid: false, scopes: [], error: "Token rejected (401). It may be expired or revoked." };
    }
    if (status === 403) {
      return { valid: false, scopes: [], error: "Token forbidden (403). It may lack required permissions." };
    }
    return { valid: false, scopes: [], error: (err as Error)?.message ?? "Verification failed" };
  }
}

async function verifyLinear(
  apiKey: string
): Promise<{ valid: boolean; scopes: string[]; error?: string }> {
  try {
    const authHeader = apiKey.startsWith("lin_") ? apiKey : `Bearer ${apiKey}`;
    const res = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({ query: "query { viewer { id } }" }),
    });

    if (res.status === 401 || res.status === 403) {
      return { valid: false, scopes: [], error: `Linear rejected token (${res.status}).` };
    }
    if (!res.ok) {
      return { valid: false, scopes: [], error: `Linear API status ${res.status}.` };
    }

    const json = (await res.json()) as {
      data?: { viewer?: { id: string } };
      errors?: Array<{ message?: string }>;
    };

    if (json.errors?.length) {
      return { valid: false, scopes: [], error: json.errors[0]?.message ?? "GraphQL error" };
    }

    const valid = !!json.data?.viewer?.id;
    return { valid, scopes: valid ? ["read"] : [] };
  } catch (err: unknown) {
    return { valid: false, scopes: [], error: (err as Error)?.message ?? "Network error" };
  }
}
