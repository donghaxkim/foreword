import { NextRequest, NextResponse } from "next/server";
import { Octokit } from "octokit";
import { getSessionUser } from "@/app/lib/auth";
import { encrypt } from "@/app/lib/crypto";
import { getSupabase } from "@/app/lib/supabase";

async function verifyGitHub(
  token: string
): Promise<{ valid: boolean; scopes: string; error?: string }> {
  try {
    const octokit = new Octokit({ auth: token });
    const res = await octokit.rest.users.getAuthenticated();

    // Classic PATs / OAuth tokens expose scopes via x-oauth-scopes.
    // Fine-grained PATs don't — that's expected.
    const headers = res.headers as Record<string, string | undefined>;
    const oauthScopes = headers["x-oauth-scopes"];

    let scopes: string;
    if (oauthScopes !== undefined && oauthScopes !== "") {
      scopes = oauthScopes;
    } else if (token.startsWith("github_pat_")) {
      scopes = "fine-grained";
    } else {
      scopes = "valid";
    }

    return { valid: true, scopes };
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    if (status === 401) {
      return { valid: false, scopes: "", error: "GitHub rejected this token (401 Unauthorized). Check that the token hasn't expired or been revoked." };
    }
    if (status === 403) {
      return { valid: false, scopes: "", error: "GitHub rejected this token (403 Forbidden). The token may lack permissions — try a classic PAT with 'repo' scope, or a fine-grained PAT with 'Contents: Read' permission." };
    }
    return {
      valid: false,
      scopes: "",
      error: `GitHub verification failed: ${(err as Error)?.message ?? "unknown error"}`,
    };
  }
}

async function verifyLinear(
  token: string
): Promise<{ valid: boolean; scopes: string; error?: string }> {
  try {
    const authHeader = token.startsWith("lin_") ? token : `Bearer ${token}`;
    const res = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({ query: "query { viewer { id } }" }),
    });

    if (res.status === 401 || res.status === 403) {
      return { valid: false, scopes: "", error: `Linear rejected this token (${res.status}). Check that the API key is correct and hasn't been revoked.` };
    }
    if (!res.ok) {
      return { valid: false, scopes: "", error: `Linear API returned status ${res.status}. Try again or check your token.` };
    }

    const json = (await res.json()) as {
      data?: { viewer?: { id: string } };
      errors?: Array<{ message?: string }>;
    };

    if (json.errors?.length) {
      const msg = json.errors[0]?.message ?? "unknown GraphQL error";
      return { valid: false, scopes: "", error: `Linear API error: ${msg}` };
    }

    if (!json.data?.viewer?.id) {
      return { valid: false, scopes: "", error: "Linear token is valid but could not retrieve user info." };
    }

    return { valid: true, scopes: "read" };
  } catch (err: unknown) {
    return {
      valid: false,
      scopes: "",
      error: `Linear verification failed: ${(err as Error)?.message ?? "network error"}`,
    };
  }
}

function verifyLoops(
  token: string
): { valid: boolean; scopes: string; error?: string } {
  if (!token.trim()) {
    return { valid: false, scopes: "", error: "Loops API key is required." };
  }
  return { valid: true, scopes: "events:send" };
}

function checkServerConfig(): string | null {
  if (!process.env.TOKEN_ENCRYPTION_KEY || process.env.TOKEN_ENCRYPTION_KEY.length !== 64) {
    return "Server configuration error: TOKEN_ENCRYPTION_KEY is missing or invalid. The admin needs to set a 64-char hex string in the environment.";
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return "Server configuration error: Supabase is not configured. The admin needs to set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.";
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const configError = checkServerConfig();
    if (configError) {
      return NextResponse.json({ github: null, linear: null, loops: null });
    }

    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabase();
    const { data: rows, error } = await supabase
      .from("tokens")
      .select("provider, scopes")
      .eq("user_id", user.id);

    if (error) {
      console.error("[tokens] Supabase select error:", error.code, error.message);
      return NextResponse.json({ github: null, linear: null, loops: null });
    }

    const github = rows?.find((r) => r.provider === "github");
    const linear = rows?.find((r) => r.provider === "linear");
    const loops = rows?.find((r) => r.provider === "loops");

    return NextResponse.json({
      github: github ? { connected: true, scopes: github.scopes ?? "" } : null,
      linear: linear ? { connected: true, scopes: linear.scopes ?? "" } : null,
      loops: loops ? { connected: true, scopes: loops.scopes ?? "" } : null,
    });
  } catch (err) {
    console.error("[tokens] GET error:", err);
    return NextResponse.json({ github: null, linear: null, loops: null });
  }
}

export async function POST(request: NextRequest) {
  // Step 0: Check server config before doing any work
  const configError = checkServerConfig();
  if (configError) {
    return NextResponse.json({ error: configError }, { status: 503 });
  }

  // Step 1: Parse input
  let provider: "github" | "linear" | "loops";
  let trimmedToken: string;
  try {
    const body = await request.json();
    const { provider: p, token: t } = body as Record<string, unknown>;

    if (p !== "github" && p !== "linear" && p !== "loops") {
      return NextResponse.json(
        { error: "provider must be 'github', 'linear', or 'loops'" },
        { status: 400 }
      );
    }
    if (typeof t !== "string" || !t.trim()) {
      return NextResponse.json(
        { error: "Token is required." },
        { status: 400 }
      );
    }
    provider = p as "github" | "linear" | "loops";
    trimmedToken = t.trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Step 2: Verify token with the provider
  const verification =
    provider === "github"
      ? await verifyGitHub(trimmedToken)
      : provider === "linear"
        ? await verifyLinear(trimmedToken)
        : verifyLoops(trimmedToken);

  if (!verification.valid) {
    return NextResponse.json(
      { error: verification.error ?? `Invalid ${provider} token.` },
      { status: 400 }
    );
  }

  // Step 3: Encrypt
  let encrypted: { ciphertext: string; iv: string; authTag: string };
  try {
    encrypted = encrypt(trimmedToken);
  } catch (err) {
    console.error("[tokens] Encryption error:", (err as Error)?.message);
    return NextResponse.json(
      { error: "Server error: token encryption failed. Check TOKEN_ENCRYPTION_KEY." },
      { status: 500 }
    );
  }

  // Step 4: Save to Supabase
  let supabase: ReturnType<typeof getSupabase>;
  try {
    supabase = getSupabase();
  } catch (err) {
    return NextResponse.json(
      { error: `Supabase client error: ${(err as Error)?.message ?? "unknown"}` },
      { status: 500 }
    );
  }

  // Pre-flight: verify we can reach Supabase and the table exists
  const { error: probeError } = await supabase
    .from("tokens")
    .select("id")
    .limit(0);

  if (probeError) {
    console.error("[tokens] Supabase probe error:", probeError.code, probeError.message, probeError.details);
    if (probeError.code === "42P01" || probeError.message?.includes("does not exist")) {
      return NextResponse.json(
        { error: "The 'tokens' table does not exist in Supabase. Run the SQL in supabase/migrations/001_tokens.sql in your Supabase SQL Editor." },
        { status: 500 }
      );
    }
    if (probeError.code === "PGRST301" || probeError.message?.includes("JWT")) {
      return NextResponse.json(
        { error: `Supabase auth error: ${probeError.message}. Check that SUPABASE_SERVICE_ROLE_KEY is correct.` },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: `Supabase error (${probeError.code ?? "unknown"}): ${probeError.message}` },
      { status: 500 }
    );
  }

  // Upsert the encrypted token
  const response = NextResponse.json({
    provider,
    scopes: verification.scopes,
    connected: true,
  });

  const { error: upsertError } = await supabase.from("tokens").upsert(
    {
      user_id: user.id,
      provider,
      encrypted_token: encrypted.ciphertext,
      iv: encrypted.iv,
      auth_tag: encrypted.authTag,
      scopes: verification.scopes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" }
  );

  if (upsertError) {
    console.error("[tokens] Supabase upsert error:", upsertError.code, upsertError.message, upsertError.details);
    return NextResponse.json(
      { error: `Database write failed (${upsertError.code ?? "unknown"}): ${upsertError.message}` },
      { status: 500 }
    );
  }

  return response;
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider } = body as Record<string, unknown>;

    if (provider !== "github" && provider !== "linear" && provider !== "loops") {
      return NextResponse.json(
        { error: "provider must be 'github', 'linear', or 'loops'" },
        { status: 400 }
      );
    }

    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabase();
    const { error } = await supabase
      .from("tokens")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", provider);

    if (error) {
      console.error("[tokens] Supabase delete error:", error.code, error.message);
      return NextResponse.json(
        { error: "Failed to delete token." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[tokens] DELETE error:", err);
    return NextResponse.json(
      { error: "Failed to delete token." },
      { status: 500 }
    );
  }
}
