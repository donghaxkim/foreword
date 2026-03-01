import { NextRequest, NextResponse } from "next/server";
import { encrypt } from "@/app/lib/crypto";
import { getOrCreateDeviceId } from "@/app/lib/device";
import { getSupabase } from "@/app/lib/supabase";

function htmlPage(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f8fc;color:#0f172a}
.card{text-align:center;padding:2rem;border-radius:1rem;background:rgba(255,255,255,.6);border:1px solid rgba(255,255,255,.55);box-shadow:0 8px 24px rgba(15,23,42,.06)}</style>
</head><body><div class="card">${body}</div></body></html>`;
}

function errorPage(message: string) {
  return htmlPage("Connection Failed", `
    <h2>Connection failed</h2>
    <p>${message}</p>
    <p><a href="/">Back to Foreword</a></p>
  `);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  if (provider !== "github" && provider !== "linear") {
    return new NextResponse(errorPage("Invalid provider."), {
      status: 400,
      headers: { "Content-Type": "text/html" }
    });
  }

  // Check if the user denied access
  const error = request.nextUrl.searchParams.get("error");
  if (error) {
    const desc = request.nextUrl.searchParams.get("error_description") ?? "Access was denied.";
    return new NextResponse(errorPage(desc), {
      status: 400,
      headers: { "Content-Type": "text/html" }
    });
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (!code || !state) {
    return new NextResponse(errorPage("Missing authorization code or state."), {
      status: 400,
      headers: { "Content-Type": "text/html" }
    });
  }

  // Verify CSRF state
  const storedState = request.cookies.get(`oauth_state_${provider}`)?.value;
  if (!storedState || state !== storedState) {
    return new NextResponse(errorPage("Invalid state. Please try connecting again."), {
      status: 400,
      headers: { "Content-Type": "text/html" }
    });
  }

  const origin = request.nextUrl.origin;
  const redirectUri = `${origin}/api/auth/${provider}/callback`;

  let accessToken: string;

  try {
    if (provider === "github") {
      accessToken = await exchangeGitHub(code, redirectUri);
    } else {
      accessToken = await exchangeLinear(code, redirectUri);
    }
  } catch (err) {
    console.error(`[auth/${provider}] Token exchange failed:`, err);
    return new NextResponse(errorPage("Token exchange failed. Please try again."), {
      status: 500,
      headers: { "Content-Type": "text/html" }
    });
  }

  // Encrypt and save token to Supabase
  const { ciphertext, iv, authTag } = encrypt(accessToken);

  const redirectUrl = `${origin}/?connected=${provider}`;
  const response = NextResponse.redirect(redirectUrl);

  const deviceId = getOrCreateDeviceId(request, response);

  // Determine scopes for display
  const scopes = provider === "github" ? "repo" : "read";

  try {
    const supabase = getSupabase();
    await supabase.from("tokens").upsert(
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
  } catch (err) {
    console.error(`[auth/${provider}] Failed to save token to Supabase:`, err);
    return new NextResponse(errorPage("Failed to save credentials. Please try again."), {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  }

  // Clear the state cookie
  response.cookies.delete(`oauth_state_${provider}`);
  return response;
}

async function exchangeGitHub(code: string, redirectUri: string): Promise<string> {
  const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("GitHub OAuth credentials not configured");
  }

  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri
    })
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[auth/github] Exchange error:", res.status, text);
    throw new Error("GitHub token exchange failed");
  }

  const data = await res.json();

  if (data.error) {
    console.error("[auth/github] OAuth error:", data.error, data.error_description);
    throw new Error(data.error_description ?? data.error);
  }

  return data.access_token;
}

async function exchangeLinear(code: string, redirectUri: string): Promise<string> {
  const clientId = process.env.NEXT_PUBLIC_LINEAR_CLIENT_ID;
  const clientSecret = process.env.LINEAR_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Linear OAuth credentials not configured");
  }

  const res = await fetch("https://api.linear.app/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret
    })
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[auth/linear] Exchange error:", res.status, text);
    throw new Error("Linear token exchange failed");
  }

  const data = await res.json();
  return data.access_token;
}
