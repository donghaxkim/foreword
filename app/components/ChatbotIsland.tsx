"use client";

import { motion } from "framer-motion";
import { useLayoutEffect, useRef } from "react";
import { type Mode, modes } from "./types";

type ChatbotIslandProps = {
  activeMode: Mode;
  setActiveMode: (m: Mode) => void;
  inputValue: string;
  setInputValue: (v: string) => void;
  onSubmit: (value: string) => void;
  fixed?: boolean;
  syncLoading?: boolean;
  syncError?: string | null;
};

const MAX_TEXTAREA_ROWS = 5;
const LINE_HEIGHT_PX = 24;

export function ChatbotIsland({
  activeMode,
  setActiveMode,
  inputValue,
  setInputValue,
  onSubmit,
  fixed = false,
  syncLoading = false,
  syncError = null
}: ChatbotIslandProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = inputValue.trim();
    if (value) onSubmit(value);
  };

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const capped = Math.min(el.scrollHeight, MAX_TEXTAREA_ROWS * LINE_HEIGHT_PX);
    el.style.height = `${capped}px`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    adjustHeight();
  };

  useLayoutEffect(() => {
    adjustHeight();
  }, [inputValue]);

  const hasContent = inputValue.trim().length > 0;

  const placeholder = syncLoading
    ? activeMode === "GitHub"
      ? "Fetching recent PRs..."
      : "Fetching Linear tasks..."
    : activeMode === "GitHub"
      ? "GitHub PRs loaded — edit and submit"
      : activeMode === "Linear"
        ? "Linear tasks loaded — edit and submit"
        : "Compose your request...";

  const content = (
    <form ref={formRef} onSubmit={handleSubmit} className="mx-auto flex max-w-3xl flex-col gap-3">
      <div className="flex gap-2">
        {modes.map((mode) => {
          const isActive = activeMode === mode;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => setActiveMode(mode)}
              className={`cursor-pointer rounded-full px-3 py-1.5 text-sm transition ${
                isActive
                  ? "bg-slate-900 text-white shadow-sm"
                  : "border border-white/70 bg-white/45 text-slate-600 hover:bg-white/65"
              }`}
            >
              {mode}
            </button>
          );
        })}
      </div>
      {syncError && (
        <p className="text-sm text-amber-700">{syncError}</p>
      )}
      {syncLoading && (
        <div className="flex items-center gap-2">
          <motion.span
            className="text-sm font-light text-slate-500"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            Syncing {activeMode === "GitHub" ? "GitHub PRs" : "Linear tasks"}...
          </motion.span>
        </div>
      )}
      <label className="block">
        <span className="sr-only">Describe your request</span>
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
          className="min-h-[48px] w-full resize-none overflow-y-auto rounded-2xl border border-white/70 bg-white/60 px-5 py-3 text-[15px] font-light leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white/85 focus:ring-0"
          style={{ height: "auto", maxHeight: MAX_TEXTAREA_ROWS * LINE_HEIGHT_PX }}
        />
      </label>
      {hasContent && (
        <p className="text-right text-xs text-slate-500">
          Ready to ship
          <span className="ml-1.5 text-slate-400">· {inputValue.trim().length} characters</span>
        </p>
      )}
    </form>
  );

  if (fixed) {
    return (
      <section className="glass-card bg-white/30 backdrop-blur-xl fixed bottom-0 left-0 right-0 z-20 border-t border-white/50 px-4 py-4 sm:px-6 md:left-[260px]">
        {content}
      </section>
    );
  }

  return (
    <section className="glass-card bg-white/30 backdrop-blur-xl w-full max-w-3xl rounded-[2rem] border border-white/60 px-4 py-4 shadow-lg sm:px-6">
      {content}
    </section>
  );
}
