import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

/**
 * These constraints are appended to every request to ensure the AI
 * doesn't break the frontend or use incompatible formatting.
 */
const TECHNICAL_CONSTRAINTS = `
### OUTPUT RULES:
1. You MUST respond with valid JSON only.
2. JSON Keys: "subject", "preheader", "body".
3. "body" MUST be HTML. Use ONLY <p>, <ul>, <li>, and <strong> tags.
4. NEVER use Markdown (no **bold**, no # headers, no \`code\`).
5. Ensure the tone is premium, professional, and ready for Loops.so.`;

function buildDefaultPersona(vibe: string): string {
  const vibeFocus = vibe.toLowerCase().includes("investor")
    ? "Investors. Focus on ROI, strategic milestones, and business growth."
    : "Beta Testers. Focus on technical shipping velocity and technical wins.";

  return `You are Foreword, the AI Chief of Staff for Caddy (a YC-backed startup).
Your boss, Connor (the CEO), is giving you rough notes. Transform them into a world-class email.
Tone: Minimalist, direct, and zero-fluff.
Audience: ${vibeFocus}`;
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return codeBlock[1].trim();
  return trimmed;
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, vibe, isManual, systemPersona } = await request.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("[Foreword] Missing API Key");
      return NextResponse.json(
        { error: "Anthropic API key not configured. Set ANTHROPIC_API_KEY in your server environment." },
        { status: 500 }
      );
    }

    if (!prompt || !vibe) {
      return NextResponse.json({ error: "Prompt and Vibe are required" }, { status: 400 });
    }

    const anthropic = new Anthropic({ apiKey });

    const activePersona = systemPersona?.trim()
      ? systemPersona
      : buildDefaultPersona(vibe);

    const fullSystemPrompt = `${activePersona}\n\n${TECHNICAL_CONSTRAINTS}`;

    const userMessage = isManual
      ? `Notes from Connor: "${prompt}"\n\nTask: Turn these notes into a high-end email for the ${vibe} group.`
      : `You are receiving a raw technical feed from GitHub/Linear. Your job is to translate these technical PRs and tasks into high-level, benefit-driven product updates for the ${vibe} group. Do not just list the titles; explain why they matter.\n\nRaw feed:\n${prompt}`;

    const message = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: fullSystemPrompt,
      messages: [{ role: "user", content: userMessage }],
      temperature: 0.7,
    });

    const textBlock = message.content.find((b) => b.type === "text");
    const rawContent = textBlock && "text" in textBlock ? (textBlock as { text: string }).text : null;
    if (!rawContent) throw new Error("AI returned no content");

    const jsonStr = extractJson(rawContent);
    let result = JSON.parse(jsonStr);

    if (result.body && result.body.includes("**")) {
      result.body = result.body.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Foreword API Error]:", message);
    return NextResponse.json(
      { error: "Generation failed. Please try again." },
      { status: 500 }
    );
  }
}
