import { NextRequest } from "next/server";
import { getSessionUser } from "./auth";
import { decrypt } from "./crypto";
import { getSupabase } from "./supabase";

type TokenRow = {
  provider: string;
  encrypted_token: string;
  iv: string;
  auth_tag: string;
};

/**
 * Load and decrypt tokens for the signed-in user from Supabase.
 * Returns { github?: string; linear?: string; loops?: string } with plain-text tokens
 * ready for API calls. Missing providers are undefined.
 */
export async function loadTokensForDevice(
  request: NextRequest
): Promise<{ github?: string; linear?: string; loops?: string }> {
  const user = await getSessionUser(request);
  if (!user) return {};

  const supabase = getSupabase();
  const { data: rows, error } = await supabase
    .from("tokens")
    .select("provider, encrypted_token, iv, auth_tag")
    .eq("user_id", user.id);

  if (error || !rows) return {};

  const result: { github?: string; linear?: string; loops?: string } = {};

  for (const row of rows as TokenRow[]) {
    try {
      const plain = decrypt(row.encrypted_token, row.iv, row.auth_tag);
      if (row.provider === "github") result.github = plain;
      else if (row.provider === "linear") result.linear = plain;
      else if (row.provider === "loops") result.loops = plain;
    } catch {
      // Decryption failed (key rotated, etc.) — skip silently
    }
  }

  return result;
}
