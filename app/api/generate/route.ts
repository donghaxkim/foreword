import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const ANTHROPIC_MODEL = "claude-3-5-sonnet-20241022";

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

function getVibeToneInstructions(vibe: string): string {
  const lower = vibe.toLowerCase();
  if (lower.includes("investor")) {
    return "Tone: Strategic, growth-focused, milestone-oriented. Emphasize business impact, traction, and ROI. Speak to investors.";
  }
  if (lower.includes("beta") || lower.includes("private beta") || lower.includes("tester")) {
    return "Tone: Technical, raw, ship-focused. Emphasize what shipped and how. Speak to beta testers and technical users.";
  }
  return "Tone: Professional, balanced, and clear. Suited for a general audience.";
}

function buildDefaultPersona(vibe: string): string {
  const vibeTone = getVibeToneInstructions(vibe);

  return `You are Foreword, the YC Chief of Staff for Caddy (a YC-backed startup). Your boss, Connor (the CEO), gives you three inputs:

1. **Manual notes** — Connor's own notes: tone, context, and narrative direction. Prioritize these for TONE.
2. **GitHub data** — Merged PRs and commits (title: description or subject: body). Use for FACTS and technical accuracy.
3. **Linear data** — Completed issues (title: description). Use for FACTS and what got done.

Your job: Cross-reference the GitHub/Linear data with Connor's manual notes to create a unified narrative. Use manual notes for tone and voice; use the technical data for facts. Do not just list items—explain why they matter for the audience.

Audience / vibe for this email: ${vibe}.
${vibeTone}`;
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return codeBlock[1].trim();
  return trimmed;
}

/**
 * Strip inadvertent Markdown from a string (e.g. inside HTML or plain text).
 * Converts **bold** to <strong> and strips other Markdown; avoids damaging existing HTML.
 */
function stripInadvertentMarkdown(str: string): string {
  if (!str || typeof str !== "string") return str;
  let out = str;
  // **text** or __text__ → <strong>text</strong> (only when not already inside HTML)
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  // `code` → code (strip backticks)
  out = out.replace(/`([^`]+)`/g, "$1");
  // # Header, ## Header, etc. → Header (strip leading # and optional space)
  out = out.replace(/^#{1,6}\s*/gm, "");
  // *italic* or _italic_ (single) → italic (strip, avoid matching list markers by being conservative)
  out = out.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "$1");
  out = out.replace(/(?<!_)_([^_]+)_(?!_)/g, "$1");
  return out;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const {
      manualNotes: rawManualNotes,
      githubData: rawGithubData,
      linearData: rawLinearData,
      prompt: legacyPrompt,
      vibe,
      systemPersona
    } = body;

    // Backward compatibility: if new fields missing, use prompt as manualNotes
    const manualNotes =
      typeof rawManualNotes === "string"
        ? rawManualNotes.trim()
        : typeof legacyPrompt === "string"
          ? (legacyPrompt as string).trim()
          : "";
    const githubData = typeof rawGithubData === "string" ? rawGithubData.trim() : "";
    const linearData = typeof rawLinearData === "string" ? rawLinearData.trim() : "";

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("[Foreword] Missing API Key");
      return NextResponse.json(
        { error: "Anthropic API key not configured. Set ANTHROPIC_API_KEY in your server environment." },
        { status: 500 }
      );
    }

    const vibeStr = typeof vibe === "string" && vibe.trim() ? vibe.trim() : "General";
    if (!manualNotes && !githubData && !linearData) {
      return NextResponse.json(
        { error: "At least one of manualNotes, githubData, or linearData is required." },
        { status: 400 }
      );
    }

    const anthropic = new Anthropic({ apiKey });

    const activePersona = systemPersona && typeof systemPersona === "string" && systemPersona.trim()
      ? systemPersona.trim()
      : buildDefaultPersona(vibeStr);

    const fullSystemPrompt = `${activePersona}\n\n${TECHNICAL_CONSTRAINTS}`;

    const parts: string[] = [];
    if (manualNotes) parts.push(`Connor's manual notes:\n${manualNotes}`);
    if (githubData) parts.push(`GitHub (merged PRs and commits):\n${githubData}`);
    if (linearData) parts.push(`Linear (completed issues):\n${linearData}`);
    parts.push(`\nTarget audience / vibe: ${vibeStr}. Match the tone described in the system prompt for this vibe. Produce a single JSON object with "subject", "preheader", and "body" (HTML only).`);

    const userMessage = parts.join("\n\n---\n\n");

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
    const parsed = JSON.parse(jsonStr) as { subject?: string; preheader?: string; body?: string };

    const result = {
      subject: stripInadvertentMarkdown(parsed.subject ?? ""),
      preheader: stripInadvertentMarkdown(parsed.preheader ?? ""),
      body: stripInadvertentMarkdown(parsed.body ?? ""),
    };

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
