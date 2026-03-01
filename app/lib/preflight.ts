/**
 * Pre-flight check for email draft before Ship.
 * Scans for placeholders and suspicious/broken links so the Ship button can be gated.
 */
export type PreflightResult = {
  ok: boolean;
  issues: string[];
};

const PLACEHOLDER_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\{\{[^}]*\}\}/g, label: "Mustache placeholder (e.g. {{ name }})" },
  { pattern: /\[PLACEHOLDER\]/gi, label: "[PLACEHOLDER]" },
  { pattern: /\[TODO\]/gi, label: "[TODO]" },
  { pattern: /\bTODO\b/gi, label: "TODO" },
  { pattern: /\[.*example\.com.*\]/gi, label: "Example link text" },
];

const SUSPICIOUS_HREF = [
  { pattern: /href\s*=\s*["']\s*["']/gi, label: "Empty link (href=\"\")" },
  { pattern: /href\s*=\s*["']#\s*["']/gi, label: "Placeholder link (href=\"#\")" },
  { pattern: /href\s*=\s*["'][^"']*example\.com[^"']*["']/gi, label: "Example.com link" },
  { pattern: /href\s*=\s*["'][^"']*placeholder[^"']*["']/gi, label: "Placeholder URL" },
];

function findInText(text: string, patterns: { pattern: RegExp; label: string }[]): string[] {
  const issues: string[] = [];
  for (const { pattern, label } of patterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      const unique = [...new Set(matches)].slice(0, 3);
      issues.push(`${label}: ${unique.join(", ")}${matches.length > 3 ? " …" : ""}`);
    }
  }
  return issues;
}

export function runPreflightCheck(draft: {
  subject?: string | null;
  preheader?: string | null;
  body?: string | null;
}): PreflightResult {
  const issues: string[] = [];
  const combined = [
    draft.subject ?? "",
    draft.preheader ?? "",
    draft.body ?? ""
  ].join(" ");

  if (!combined.trim()) {
    return { ok: true, issues: [] };
  }

  issues.push(...findInText(combined, PLACEHOLDER_PATTERNS));
  issues.push(...findInText(draft.body ?? "", SUSPICIOUS_HREF));

  return {
    ok: issues.length === 0,
    issues: [...new Set(issues)],
  };
}
