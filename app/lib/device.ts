import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

const COOKIE_NAME = "foreword-device-id";
const MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export function getDeviceId(request: NextRequest): string | null {
  return request.cookies.get(COOKIE_NAME)?.value ?? null;
}

export function getOrCreateDeviceId(
  request: NextRequest,
  response: NextResponse
): string {
  const existing = request.cookies.get(COOKIE_NAME)?.value;
  if (existing) return existing;

  const id = randomUUID();
  response.cookies.set(COOKIE_NAME, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: MAX_AGE,
    path: "/",
  });
  return id;
}

export function setDeviceIdCookie(
  response: NextResponse,
  deviceId: string
): void {
  response.cookies.set(COOKIE_NAME, deviceId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: MAX_AGE,
    path: "/",
  });
}
