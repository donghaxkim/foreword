import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

const OPENAI_MODEL = "gpt-4o";

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

export async function POST(request: NextRequest) {
  try {
    const { prompt, vibe, isManual, systemPersona, openaiApiKey } = await request.json();

    const apiKey = process.env.OPENAI_API_KEY || openaiApiKey;
    if (!apiKey) {
      console.error("[Foreword] Missing API Key");
      return NextResponse.json({ error: "OpenAI Key not configured. Add it to .env or in Settings." }, { status: 500 });
    }

    if (!prompt || !vibe) {
      return NextResponse.json({ error: "Prompt and Vibe are required" }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey });

    // Combine user-defined persona with our strict technical formatting rules
    const activePersona = systemPersona?.trim() 
      ? systemPersona 
      : buildDefaultPersona(vibe);

    const fullSystemPrompt = `${activePersona}\n\n${TECHNICAL_CONSTRAINTS}`;

    const userMessage = isManual
      ? `Notes from Connor: "${prompt}"\n\nTask: Turn these notes into a high-end email for the ${vibe} group.`
      : `You are receiving a raw technical feed from GitHub/Linear. Your job is to translate these technical PRs and tasks into high-level, benefit-driven product updates for the ${vibe} group. Do not just list the titles; explain why they matter.\n\nRaw feed:\n${prompt}`;

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: fullSystemPrompt },
        { role: "user", content: userMessage }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("AI returned no content");

    let result = JSON.parse(content);

    // EMERGENCY CLEANUP: If the AI ignores instructions and uses Markdown bolding
    if (result.body && result.body.includes("**")) {
      result.body = result.body.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    }

    return NextResponse.json(result);

  } catch (err: any) {
    console.error("[Foreword API Error]:", err.message);
    return NextResponse.json(
      { error: "Generation failed. Please try again." }, 
      { status: 500 }
    );
  }
}