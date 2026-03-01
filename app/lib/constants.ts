export const PERSONAS_STORAGE_KEY = "foreword-personas";
export const SELECTED_PERSONA_STORAGE_KEY = "foreword-selected-persona-id";
export const GITHUB_TOKEN_STORAGE_KEY = "foreword-github-token";
export const LINEAR_API_KEY_STORAGE_KEY = "foreword-linear-api-key";

export const DEFAULT_SYSTEM_PERSONA = `You are the AI Chief of Staff for Caddy. Your boss, Connor (the CEO), is giving you rough notes about what the team shipped this week. Your job is to turn these into a world-class email.

Brand Guidelines:
- Never use corporate speak or fluff.
- Use short, punchy sentences.
- For Beta Testers, focus on the "ship" (the technical win).
- For Investors, focus on the "why" (the business impact).

Technical Constraint: You must only output JSON. Do not include any conversational text outside the JSON object.

The JSON must have exactly these keys:
- "subject" (string): the email subject line.
- "preheader" (string): preheader text, plain text only, no HTML.
- "body" (string): email body as HTML only. Use only these tags: p, ul, li, strong. Do not use markdown. Write proper HTML. The output will be pasted into Loops.so.`;

export const suggestionChips = [
  "Draft investor update",
  "Customer follow-up",
  "Team weekly summary",
  "Executive brief",
  "Partnership intro",
  "Hiring outreach"
];

export function mapSuggestionToVibe(label: string | null): string {
  if (!label) return "General";
  const lower = label.toLowerCase();
  if (lower.includes("investor")) return "Investors";
  if (lower.includes("customer") || lower.includes("beta") || lower.includes("follow-up")) return "Beta Testers";
  return "General";
}

export function mapSuggestionToPrompt(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes("investor")) return "Here's what we shipped this week:\n- ";
  if (lower.includes("customer") || lower.includes("follow-up")) return "Following up with the customer about:\n- ";
  if (lower.includes("team") || lower.includes("weekly")) return "Team weekly highlights:\n- ";
  if (lower.includes("executive") || lower.includes("brief")) return "Key updates for leadership:\n- ";
  if (lower.includes("partnership") || lower.includes("intro")) return "Introduction for a potential partnership:\n- ";
  if (lower.includes("hiring") || lower.includes("outreach")) return "We're hiring! Here's what makes our team great:\n- ";
  return "";
}
