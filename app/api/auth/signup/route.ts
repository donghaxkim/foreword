import { NextRequest, NextResponse } from "next/server";
import { createSession, hashPassword, normalizeEmail } from "@/app/lib/auth";
import { getSupabase } from "@/app/lib/supabase";

function validateCredentials(email: unknown, password: unknown): string | null {
  if (typeof email !== "string" || typeof password !== "string") {
    return "Email and password are required.";
  }
  if (!email.trim() || !password.trim()) {
    return "Email and password are required.";
  }
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const email = body.email;
    const password = body.password;

    const validationError = validateCredentials(email, password);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(email as string);
    const supabase = getSupabase();

    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    const passwordHash = hashPassword(password as string);
    const { data: user, error: insertError } = await supabase
      .from("users")
      .insert({ email: normalizedEmail, password_hash: passwordHash })
      .select("id, email")
      .single();

    if (insertError || !user) {
      return NextResponse.json({ error: "Could not create account." }, { status: 500 });
    }

    const response = NextResponse.json({ user: { id: user.id, email: user.email } });
    await createSession(response, user.id);
    return response;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
