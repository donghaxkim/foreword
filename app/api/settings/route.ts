import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/app/lib/auth";
import { getSupabase } from "@/app/lib/supabase";

type SettingsPayload = {
  githubRepo?: string | null;
  personas?: unknown;
  selectedPersonaId?: string | null;
};

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("user_settings")
    .select("github_repo, personas_json, selected_persona_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Failed to load settings." }, { status: 500 });
  }

  return NextResponse.json({
    githubRepo: data?.github_repo ?? "",
    personas: Array.isArray(data?.personas_json) ? data?.personas_json : null,
    selectedPersonaId: data?.selected_persona_id ?? null
  });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as SettingsPayload;
    const githubRepo = typeof body.githubRepo === "string" ? body.githubRepo : null;
    const personas = body.personas ?? [];
    const selectedPersonaId =
      typeof body.selectedPersonaId === "string" || body.selectedPersonaId === null
        ? body.selectedPersonaId
        : null;

    const supabase = getSupabase();
    const { error } = await supabase.from("user_settings").upsert(
      {
        user_id: user.id,
        github_repo: githubRepo,
        personas_json: personas,
        selected_persona_id: selectedPersonaId,
        updated_at: new Date().toISOString()
      },
      { onConflict: "user_id" }
    );

    if (error) {
      return NextResponse.json({ error: "Failed to save settings." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
