import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/app/lib/auth";
import { getSupabase } from "@/app/lib/supabase";

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const envLoopsApiKey = process.env.LOOPS_API_KEY;
  const loopsTransactionalId = process.env.LOOPS_TRANSACTIONAL_ID;
  const loopsDefaultRecipient = process.env.LOOPS_RECIPIENT_EMAIL ?? "";
  let userHasLoopsKey = false;

  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("tokens")
      .select("id")
      .eq("user_id", user.id)
      .eq("provider", "loops")
      .maybeSingle();
    userHasLoopsKey = !!data?.id;
  } catch {
    userHasLoopsKey = false;
  }

  const loopsConfigured = !!((envLoopsApiKey || userHasLoopsKey) && loopsTransactionalId);

  return NextResponse.json({
    loopsConfigured,
    loopsDefaultRecipient
  });
}
