import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { subject, preheader, htmlBody, loopsApiKey, transactionalId, recipientEmail } =
      await request.json();

    if (!loopsApiKey || !transactionalId || !recipientEmail || !htmlBody) {
      return NextResponse.json(
        { error: "Missing required fields: loopsApiKey, transactionalId, recipientEmail, htmlBody" },
        { status: 400 }
      );
    }

    const res = await fetch("https://app.loops.so/api/v1/transactional", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loopsApiKey}`
      },
      body: JSON.stringify({
        email: recipientEmail,
        transactionalId,
        addToAudience: false,
        dataVariables: {
          subject,
          preheader,
          body: htmlBody
        }
      })
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[send] Loops API error", res.status, text);
      return NextResponse.json(
        { error: `Loops API error: ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[send]", err);
    return NextResponse.json({ error: "Send failed" }, { status: 500 });
  }
}
