import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/app/lib/auth";

const GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize";
const LINEAR_AUTH_URL = "https://linear.app/oauth/authorize";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { provider } = await params;

  if (provider !== "github" && provider !== "linear") {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const state = crypto.randomUUID();
  const origin = request.nextUrl.origin;
  const redirectUri = `${origin}/api/auth/${provider}/callback`;

  let authUrl: string;

  if (provider === "github") {
    const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json({ error: "GitHub OAuth not configured on server" }, { status: 500 });
    }
    const qs = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "repo",
      state
    });
    authUrl = `${GITHUB_AUTH_URL}?${qs}`;
  } else {
    const clientId = process.env.NEXT_PUBLIC_LINEAR_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json({ error: "Linear OAuth not configured on server" }, { status: 500 });
    }
    const qs = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "read",
      state
    });
    authUrl = `${LINEAR_AUTH_URL}?${qs}`;
  }

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(`oauth_state_${provider}`, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/"
  });
  return response;
}
