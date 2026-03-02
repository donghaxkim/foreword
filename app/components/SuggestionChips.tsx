"use client";

import { vibeChips } from "@/app/lib/constants";
import type { LoopsList } from "./RecipientSelector";

type SuggestionChipsProps = {
  selectedSuggestion: string | null;
  onSuggestionClick: (label: string) => void;
  loopsLists?: LoopsList[];
  listsLoading?: boolean;
};

export function SuggestionChips({ selectedSuggestion, onSuggestionClick, loopsLists, listsLoading }: SuggestionChipsProps) {
  const chips: string[] =
    loopsLists && loopsLists.length > 0
      ? loopsLists.map((l) => l.name)
      : [...vibeChips];

  if (listsLoading) return null;

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {chips.map((label) => {
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
