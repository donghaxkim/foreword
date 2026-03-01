"use client";

import { vibeChips } from "@/app/lib/constants";

type SuggestionChipsProps = {
  selectedSuggestion: string | null;
  onSuggestionClick: (label: string) => void;
};

export function SuggestionChips({ selectedSuggestion, onSuggestionClick }: SuggestionChipsProps) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {vibeChips.map((label) => {
        const isActive = selectedSuggestion === label;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onSuggestionClick(label)}
            className={`cursor-pointer rounded-full px-4 py-2 text-sm transition ${
              isActive
                ? "bg-slate-900 text-white shadow-sm"
                : "border border-white/70 bg-white/45 text-slate-600 hover:bg-white/65"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
