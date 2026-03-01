export const PERSONAS_STORAGE_KEY = "foreword-personas";
export const SELECTED_PERSONA_STORAGE_KEY = "foreword-selected-persona-id";
export const GITHUB_REPO_STORAGE_KEY = "foreword-github-repo";
export const GITHUB_TOKEN_STORAGE_KEY = "foreword-github-token";
export const LINEAR_API_KEY_STORAGE_KEY = "foreword-linear-api-key";

/** Vibe chips shown below the input; they only set tone, not prompt text. */
export const vibeChips = ["Investors", "Beta Testers", "General"] as const;

export function mapSuggestionToVibe(label: string | null): string {
  if (!label) return "General";
  const lower = label.toLowerCase();
  if (lower.includes("investor")) return "Investors";
  if (lower.includes("beta") || lower.includes("tester")) return "Beta Testers";
  return "General";
}
