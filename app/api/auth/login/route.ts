import { NextRequest, NextResponse } from "next/server";
import { createSession, normalizeEmail, verifyPassword } from "@/app/lib/auth";
import { getSupabase } from "@/app/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const email = body.email;
    const password = body.password;

    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password.trim()) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(email);
    const supabase = getSupabase();
    const { data: user, error } = await supabase
      .from("users")
      .select("id, email, password_hash")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (error || !user || !verifyPassword(password, user.password_hash)) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const response = NextResponse.json({ user: { id: user.id, email: user.email } });
    await createSession(response, user.id);
    return response;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
