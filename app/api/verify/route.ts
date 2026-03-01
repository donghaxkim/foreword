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
      const valid = await verifyGitHub(token);
      return NextResponse.json({ valid });
    }

    const valid = await verifyLinear(token);
    return NextResponse.json({ valid });
  } catch (err) {
    console.error("[verify]", err);
    return NextResponse.json({ valid: false }, { status: 200 });
  }
}

async function verifyGitHub(apiKey: string): Promise<boolean> {
  try {
    const octokit = new Octokit({ auth: apiKey });
    await octokit.rest.users.getAuthenticated();
    return true;
  } catch {
    return false;
  }
}

async function verifyLinear(apiKey: string): Promise<boolean> {
  const authHeader = apiKey.startsWith("lin_") ? apiKey : `Bearer ${apiKey}`;
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader
    },
    body: JSON.stringify({ query: "query { viewer { id } }" })
  });

  if (!res.ok) return false;

  const json = (await res.json()) as { data?: { viewer?: { id: string } }; errors?: unknown[] };
  return !json.errors?.length && !!json.data?.viewer?.id;
}
