import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/app/lib/auth";
import { getSupabase } from "@/app/lib/supabase";

type ChatPayload = {
  id?: string;
  prompt?: string;
  vibe?: string | null;
  subject?: string | null;
  preheader?: string | null;
  body?: string | null;
};

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limitParam = request.nextUrl.searchParams.get("limit");
  const parsedLimit = Number(limitParam);
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 50;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("chat_history")
    .select("id, prompt, vibe, subject, preheader, body, created_at, updated_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: "Failed to load chats." }, { status: 500 });
  }

  return NextResponse.json({ chats: data ?? [] });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as ChatPayload;
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }

    const supabase = getSupabase();
    const payload = {
      user_id: user.id,
      prompt,
      vibe: typeof body.vibe === "string" ? body.vibe : null,
      subject: typeof body.subject === "string" ? body.subject : null,
      preheader: typeof body.preheader === "string" ? body.preheader : null,
      body: typeof body.body === "string" ? body.body : null,
      updated_at: new Date().toISOString()
    };

    if (typeof body.id === "string" && body.id) {
      const { data, error } = await supabase
        .from("chat_history")
        .update(payload)
        .eq("id", body.id)
        .eq("user_id", user.id)
        .select("id, prompt, vibe, subject, preheader, body, created_at, updated_at")
        .single();

      if (error) {
        return NextResponse.json({ error: "Failed to update chat." }, { status: 500 });
      }
      return NextResponse.json({ chat: data });
    }

    const { data, error } = await supabase
      .from("chat_history")
      .insert(payload)
      .select("id, prompt, vibe, subject, preheader, body, created_at, updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to save chat." }, { status: 500 });
    }

    return NextResponse.json({ chat: data });
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
