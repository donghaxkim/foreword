import { NextRequest, NextResponse } from "next/server";
import { Octokit } from "octokit";
import { encrypt } from "@/app/lib/crypto";
import { getDeviceId, getOrCreateDeviceId } from "@/app/lib/device";
import { getSupabase } from "@/app/lib/supabase";

async function verifyAndGetScopes(
  provider: string,
  token: string
): Promise<{ valid: boolean; scopes: string }> {
  if (provider === "github") {
    try {
      const octokit = new Octokit({ auth: token });
      const res = await octokit.rest.users.getAuthenticated();
      const scopeHeader =
        (res.headers as Record<string, string | undefined>)["x-oauth-scopes"] ?? "";
      return { valid: true, scopes: scopeHeader || "unknown" };
    } catch {
      return { valid: false, scopes: "" };
    }
  }

  // Linear
  const authHeader = token.startsWith("lin_") ? token : `Bearer ${token}`;
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({ query: "query { viewer { id } }" }),
  });

  if (!res.ok) return { valid: false, scopes: "" };

  const json = (await res.json()) as {
    data?: { viewer?: { id: string } };
    errors?: unknown[];
  };
  const valid = !json.errors?.length && !!json.data?.viewer?.id;
  return { valid, scopes: valid ? "read" : "" };
}

export async function GET(request: NextRequest) {
  try {
    const deviceId = getDeviceId(request);
    if (!deviceId) {
      return NextResponse.json({ github: null, linear: null });
    }

    const supabase = getSupabase();
    const { data: rows, error } = await supabase
      .from("tokens")
      .select("provider, scopes")
      .eq("device_id", deviceId);

    if (error) {
      console.error("[tokens] Supabase select error", error.code);
      return NextResponse.json({ github: null, linear: null });
    }

    const github = rows?.find((r) => r.provider === "github");
    const linear = rows?.find((r) => r.provider === "linear");

    return NextResponse.json({
      github: github ? { connected: true, scopes: github.scopes ?? "" } : null,
      linear: linear ? { connected: true, scopes: linear.scopes ?? "" } : null,
    });
  } catch (err) {
    console.error("[tokens] GET error", err);
    return NextResponse.json({ github: null, linear: null });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, token } = body as Record<string, unknown>;

    if (provider !== "github" && provider !== "linear") {
      return NextResponse.json(
        { error: "provider must be 'github' or 'linear'" },
        { status: 400 }
      );
    }
    if (typeof token !== "string" || !token.trim()) {
      return NextResponse.json(
        { error: "token is required" },
        { status: 400 }
      );
    }

    const trimmed = token.trim();

    const { valid, scopes } = await verifyAndGetScopes(provider, trimmed);
    if (!valid) {
      return NextResponse.json(
        { error: `Invalid ${provider} token. Please check and try again.` },
        { status: 400 }
      );
    }

    const { ciphertext, iv, authTag } = encrypt(trimmed);

    const response = NextResponse.json({ provider, scopes, connected: true });
    const deviceId = getOrCreateDeviceId(request, response);

    const supabase = getSupabase();
    const { error: upsertError } = await supabase.from("tokens").upsert(
      {
        device_id: deviceId,
        provider,
        encrypted_token: ciphertext,
        iv,
        auth_tag: authTag,
        scopes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "device_id,provider" }
    );

    if (upsertError) {
      console.error("[tokens] Supabase upsert error", upsertError.code);
      return NextResponse.json(
        { error: "Failed to save token" },
        { status: 500 }
      );
    }

    return response;
  } catch (err) {
    console.error("[tokens] POST error", err);
    return NextResponse.json(
      { error: "Failed to save token" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider } = body as Record<string, unknown>;

    if (provider !== "github" && provider !== "linear") {
      return NextResponse.json(
        { error: "provider must be 'github' or 'linear'" },
        { status: 400 }
      );
    }

    const deviceId = getDeviceId(request);
    if (!deviceId) {
      return NextResponse.json({ success: true });
    }

    const supabase = getSupabase();
    const { error } = await supabase
      .from("tokens")
      .delete()
      .eq("device_id", deviceId)
      .eq("provider", provider);

    if (error) {
      console.error("[tokens] Supabase delete error", error.code);
      return NextResponse.json(
        { error: "Failed to delete token" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[tokens] DELETE error", err);
    return NextResponse.json(
      { error: "Failed to delete token" },
      { status: 500 }
    );
  }
}
