import { NextResponse } from "next/server";

export async function GET() {
  const loopsApiKey = process.env.LOOPS_API_KEY;
  const loopsTransactionalId = process.env.LOOPS_TRANSACTIONAL_ID;
  const loopsDefaultRecipient = process.env.LOOPS_RECIPIENT_EMAIL ?? "";

  const loopsConfigured = !!(loopsApiKey && loopsTransactionalId);

  return NextResponse.json({
    loopsConfigured,
    loopsDefaultRecipient
  });
}
