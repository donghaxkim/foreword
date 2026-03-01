import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, revokeSession } from "@/app/lib/auth";

export async function POST(request: NextRequest) {
  await revokeSession(request);
  const response = NextResponse.json({ success: true });
  clearSessionCookie(response);
  return response;
}
