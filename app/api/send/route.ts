import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { subject, preheader, htmlBody, recipientEmail, targetGroup, loopsApiKey } =
      await request.json();

    if (!htmlBody || !subject) {
      return NextResponse.json(
        { error: "Missing required fields: subject, htmlBody" },
        { status: 400 }
      );
    }

    const apiKey =
      (typeof loopsApiKey === "string" && loopsApiKey.trim()) || process.env.LOOPS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Loops API key not configured. Provide it in the request or set LOOPS_API_KEY." },
        { status: 500 }
      );
    }

    const eventPayload: Record<string, unknown> = {
      eventName: "newsletter_ship",
      eventProperties: {
        subject: subject ?? "",
        preheader: preheader ?? "",
        htmlBody: htmlBody,
        targetGroup: typeof targetGroup === "string" ? targetGroup : "general"
      }
    };

    if (typeof recipientEmail === "string" && recipientEmail.trim()) {
      eventPayload.email = recipientEmail.trim();
    }

    const res = await fetch("https://app.loops.so/api/v1/events/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(eventPayload)
    });

    if (!res.ok) {
      const status = res.status;
      let errorMessage = `Loops API error: ${status}`;
      if (status === 401 || status === 403) {
        errorMessage = "Loops API Key Invalid";
      }
      console.error("[send] Loops Events API error", status);
      return NextResponse.json({ error: errorMessage }, { status });
    }

    const data = await res.json();
    return NextResponse.json({
      success: true,
      targetGroup: typeof targetGroup === "string" ? targetGroup : "general",
      ...data
    });
  } catch {
    console.error("[send] error");
    return NextResponse.json({ error: "Send failed" }, { status: 500 });
  }
}
