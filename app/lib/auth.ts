import { randomBytes, scryptSync, timingSafeEqual, createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "./supabase";

const SESSION_COOKIE_NAME = "foreword-session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const SESSION_TTL_MS = SESSION_MAX_AGE_SECONDS * 1000;

type SessionRow = {
  user_id: string;
  expires_at: string;
};

type UserRow = {
  id: string;
  email: string;
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, encoded: string): boolean {
  const [salt, expectedHex] = encoded.split(":");
  if (!salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(actual, expected);
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/"
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.delete(SESSION_COOKIE_NAME);
}

export async function createSession(response: NextResponse, userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  const supabase = getSupabase();
  const { error } = await supabase.from("sessions").insert({
    user_id: userId,
    session_token_hash: tokenHash,
    expires_at: expiresAt
  });
  if (error) {
    throw new Error(`Failed to create session: ${error.message}`);
  }

  setSessionCookie(response, token);
}

export async function revokeSession(request: NextRequest): Promise<void> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return;
  const tokenHash = hashSessionToken(token);
  const supabase = getSupabase();
  await supabase.from("sessions").delete().eq("session_token_hash", tokenHash);
}

export async function getSessionUser(request: NextRequest): Promise<UserRow | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const tokenHash = hashSessionToken(token);
  const supabase = getSupabase();

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("user_id, expires_at")
    .eq("session_token_hash", tokenHash)
    .maybeSingle<SessionRow>();

  if (sessionError || !session) return null;

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await supabase.from("sessions").delete().eq("session_token_hash", tokenHash);
    return null;
  }

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, email")
    .eq("id", session.user_id)
    .maybeSingle<UserRow>();

  if (userError || !user) return null;
  return user;
}
