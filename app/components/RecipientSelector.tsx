"use client";

import { motion } from "framer-motion";
import { Check, ListChecks, Loader2 } from "lucide-react";

export type LoopsList = {
    id: string;
    name: string;
    description: string | null;
    isPublic: boolean;
};

type RecipientSelectorProps = {
    lists: LoopsList[];
    selectedIds: string[];
    onToggle: (id: string) => void;
    onSelectAll: () => void;
    onDeselectAll: () => void;
    loading: boolean;
};

export function RecipientSelector({
    lists,
    selectedIds,
    onToggle,
    onSelectAll,
    onDeselectAll,
    loading,
}: RecipientSelectorProps) {
    const allSelected = lists.length > 0 && selectedIds.length === lists.length;

    if (loading) {
        return (
            <div className="flex items-center gap-2 py-3">
                <Loader2 size={14} className="animate-spin text-slate-400" />
                <span className="text-xs text-slate-500">Loading mailing lists...</span>
            </div>
        );
    }

    if (lists.length === 0) {
        return (
            <div className="py-3">
                <p className="text-xs text-slate-500">
                    No mailing lists found.{" "}
                    <a
                        href="https://app.loops.so"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline decoration-dotted hover:text-slate-700"
                    >
                        Create them in Loops
                    </a>
                </p>
            </div>
        );
    }

    return (
        <div>
            <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    <ListChecks size={12} className="mr-1 inline" />
                    Ship to
                </p>
                <button
                    type="button"
                    onClick={allSelected ? onDeselectAll : onSelectAll}
                    className="cursor-pointer text-xs font-medium text-slate-500 transition hover:text-slate-700"
                >
                    {allSelected ? "Deselect all" : "Select all"}
                </button>
            </div>
            <div className="flex flex-wrap gap-2">
                {lists.map((list) => {
                    const isSelected = selectedIds.includes(list.id);
                    return (
                        <motion.button
                            key={list.id}
                            type="button"
                            onClick={() => onToggle(list.id)}
                            whileTap={{ scale: 0.96 }}
                            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${isSelected
                                    ? "bg-slate-900 text-white"
                                    : "border border-white/60 bg-white/50 text-slate-600 hover:bg-white/70"
                                }`}
                        >
                            {isSelected && <Check size={13} strokeWidth={2.5} />}
                            {list.name}
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
}
