"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, MessageSquarePlus, Settings } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const PERSONAS_STORAGE_KEY = "foreword-personas";
const SELECTED_PERSONA_STORAGE_KEY = "foreword-selected-persona-id";
const OPENAI_KEY_STORAGE_KEY = "foreword-openai-key";
const GITHUB_TOKEN_STORAGE_KEY = "foreword-github-token";
const LINEAR_API_KEY_STORAGE_KEY = "foreword-linear-api-key";
const LOOPS_API_KEY_STORAGE_KEY = "foreword-loops-api-key";

const DEFAULT_SYSTEM_PERSONA = `You are the AI Chief of Staff for Caddy. Your boss, Connor (the CEO), is giving you rough notes about what the team shipped this week. Your job is to turn these into a world-class email.

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

type Persona = { id: string; name: string; content: string };

const modes = ["Manual", "GitHub", "Linear"] as const;

const suggestionChips = [
  "Draft investor update",
  "Customer follow-up",
  "Team weekly summary",
  "Executive brief",
  "Partnership intro",
  "Hiring outreach"
];

type ChatbotIslandProps = {
  activeMode: (typeof modes)[number];
  setActiveMode: (m: (typeof modes)[number]) => void;
  inputValue: string;
  setInputValue: (v: string) => void;
  onSubmit: (value: string) => void;
  fixed?: boolean;
};

const MAX_TEXTAREA_ROWS = 5;
const LINE_HEIGHT_PX = 24;

function ChatbotIsland({
  activeMode,
  setActiveMode,
  inputValue,
  setInputValue,
  onSubmit,
  fixed = false
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
      <label className="block">
        <span className="sr-only">Describe your request</span>
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder={
            activeMode === "GitHub"
              ? "Searching recent PRs..."
              : activeMode === "Linear"
                ? "Fetching Linear tasks..."
                : "Compose your request..."
          }
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

export default function Home() {
  const [activeMode, setActiveMode] = useState<(typeof modes)[number]>("Manual");
  const [inputValue, setInputValue] = useState("");
  const [hasStartedConversation, setHasStartedConversation] = useState(false);
  const [firstUserMessage, setFirstUserMessage] = useState<string | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [personas, setPersonas] = useState<Persona[]>(() => [
    { id: "default", name: "Caddy Chief of Staff", content: DEFAULT_SYSTEM_PERSONA }
  ]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>("default");
  const [openaiKey, setOpenaiKey] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [linearApiKey, setLinearApiKey] = useState("");
  const [loopsApiKey, setLoopsApiKey] = useState("");
  const [draft, setDraft] = useState<{ subject: string; preheader: string; body: string } | null>(null);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedPersonas = localStorage.getItem(PERSONAS_STORAGE_KEY);
    const legacyPersona = localStorage.getItem("foreword-system-persona");
    if (storedPersonas != null) {
      try {
        const parsed = JSON.parse(storedPersonas) as Persona[];
        if (Array.isArray(parsed) && parsed.length > 0) setPersonas(parsed);
      } catch {
        // ignore
      }
    } else if (legacyPersona != null) {
      setPersonas([{ id: "default", name: "Caddy Chief of Staff", content: legacyPersona }]);
      localStorage.removeItem("foreword-system-persona");
    }
    const storedId = localStorage.getItem(SELECTED_PERSONA_STORAGE_KEY);
    if (storedId != null) setSelectedPersonaId(storedId);
    const openai = localStorage.getItem(OPENAI_KEY_STORAGE_KEY);
    if (openai != null) setOpenaiKey(openai);
    const github = localStorage.getItem(GITHUB_TOKEN_STORAGE_KEY);
    if (github != null) setGithubToken(github);
    const linear = localStorage.getItem(LINEAR_API_KEY_STORAGE_KEY);
    if (linear != null) setLinearApiKey(linear);
    const loops = localStorage.getItem(LOOPS_API_KEY_STORAGE_KEY);
    if (loops != null) setLoopsApiKey(loops);
  }, []);

  const persist = (key: string, value: string) => {
    if (typeof window !== "undefined") localStorage.setItem(key, value);
  };

  const savePersonas = (next: Persona[]) => {
    setPersonas(next);
    if (typeof window !== "undefined") localStorage.setItem(PERSONAS_STORAGE_KEY, JSON.stringify(next));
  };

  const saveSelectedPersonaId = (id: string | null) => {
    setSelectedPersonaId(id);
    if (typeof window !== "undefined") {
      if (id == null) localStorage.removeItem(SELECTED_PERSONA_STORAGE_KEY);
      else localStorage.setItem(SELECTED_PERSONA_STORAGE_KEY, id);
    }
  };

  const addPersona = () => {
    const id = `persona-${Date.now()}`;
    const next = [...personas, { id, name: "New persona", content: DEFAULT_SYSTEM_PERSONA }];
    savePersonas(next);
    saveSelectedPersonaId(id);
  };

  const updatePersona = (id: string, updates: Partial<Pick<Persona, "name" | "content">>) => {
    savePersonas(
      personas.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  const removePersona = (id: string) => {
    const next = personas.filter((p) => p.id !== id);
    savePersonas(next);
    if (selectedPersonaId === id) saveSelectedPersonaId(next[0]?.id ?? null);
  };

  const selectedPersona = personas.find((p) => p.id === selectedPersonaId);
  const activePersonaContent = selectedPersona?.content?.trim() ?? "";

  const mapSuggestionToVibe = (label: string | null): string => {
    if (!label) return "General";
    const lower = label.toLowerCase();
    if (lower.includes("investor")) return "Investors";
    if (lower.includes("customer") || lower.includes("beta") || lower.includes("follow-up")) return "Beta Testers";
    return "General";
  };

  const handleSubmit = async (value: string) => {
    setFirstUserMessage(value);
    setInputValue("");
    setHasStartedConversation(true);
    setDraft(null);
    setGenerateError(null);
    setGenerateLoading(true);
    try {
      const vibe = mapSuggestionToVibe(selectedSuggestion);
      const body: Record<string, unknown> = {
        prompt: value,
        vibe,
        isManual: activeMode === "Manual"
      };
      if (activePersonaContent) body.systemPersona = activePersonaContent;
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) {
        setGenerateError(data?.error ?? "Failed to generate email");
        return;
      }
      setDraft({ subject: data.subject, preheader: data.preheader, body: data.body });
    } catch {
      setGenerateError("Failed to generate email");
    } finally {
      setGenerateLoading(false);
    }
  };

  const handleNewChat = () => {
    setHasStartedConversation(false);
    setFirstUserMessage(null);
    setInputValue("");
    setSelectedSuggestion(null);
    setDraft(null);
    setGenerateError(null);
  };

  const handleSuggestionClick = (label: string) => {
    setSelectedSuggestion((prev) => (prev === label ? null : label));
  };

  const handleCopyHtml = async () => {
    if (!draft?.body) return;
    try {
      await navigator.clipboard.writeText(draft.body);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      setCopySuccess(false);
    }
  };

  return (
    <main className="relative flex min-h-screen overflow-hidden text-slate-900">
      <AnimatedMesh />

      {/* Left sidebar — chat list / nav (hidden on small screens) */}
      <aside className="glass-card bg-white/30 backdrop-blur-xl relative z-10 hidden w-[260px] shrink-0 flex-col border-r border-white/50 md:flex">
        <div className="flex items-center gap-2 px-4 py-5">
          <div className="font-brand text-xl text-slate-900">Foreword</div>
        </div>
        <button
          type="button"
          onClick={handleNewChat}
          className="mx-3 mb-2 flex cursor-pointer items-center gap-2 rounded-xl border border-white/60 bg-white/40 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-white/60"
        >
          <MessageSquarePlus size={18} strokeWidth={1.6} />
          New chat
        </button>
        <div className="flex-1 overflow-y-auto px-2 py-2">
          <p className="px-2 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">
            Recent
          </p>
          <p className="px-2 text-sm text-slate-400">No conversations yet</p>
        </div>
        <div className="border-t border-white/40 p-3">
          <button
            type="button"
            aria-label="Settings"
            onClick={() => setSettingsOpen((prev) => !prev)}
            className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-600 transition hover:bg-white/50"
          >
            <Settings size={18} strokeWidth={1.6} />
            Settings
          </button>
        </div>
      </aside>

      {/* Settings overlay — right-aligned slide-over */}
      <AnimatePresence>
        {settingsOpen && (
          <>
            <motion.button
              key="settings-backdrop"
              type="button"
              aria-label="Close settings"
              className="fixed inset-0 z-30 cursor-pointer bg-slate-900/25 backdrop-blur-2xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSettingsOpen(false)}
            />
            <motion.div
              key="settings-panel"
              className="fixed right-0 top-0 z-40 flex h-full w-full max-w-md flex-col border-l border-white/40 bg-white/60 shadow-2xl backdrop-blur-2xl"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
            >
              <div className="flex flex-1 flex-col overflow-y-auto p-6">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">Settings</h2>
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(false)}
                    className="cursor-pointer text-sm font-medium text-slate-600 transition hover:text-slate-900"
                  >
                    Close
                  </button>
                </div>

                <section className="mb-8">
                  <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">AI Personas</h3>
                  <p className="mb-4 text-sm text-slate-600">Choose which persona to use when generating drafts.</p>
                  <div className="space-y-4">
                    {personas.map((p) => (
                      <div
                        key={p.id}
                        className="rounded-xl border border-white/60 bg-white/40 p-4"
                      >
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <label className="flex cursor-pointer items-center gap-2">
                            <input
                              type="radio"
                              name="persona"
                              checked={selectedPersonaId === p.id}
                              onChange={() => saveSelectedPersonaId(p.id)}
                              className="h-4 w-4 accent-slate-800"
                            />
                            <input
                              type="text"
                              value={p.name}
                              onChange={(e) => updatePersona(p.id, { name: e.target.value })}
                              className="flex-1 rounded-lg border border-white/60 bg-white/50 px-3 py-1.5 text-sm font-medium text-slate-800 focus:border-slate-300 focus:outline-none"
                              placeholder="Persona name"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => removePersona(p.id)}
                            className="cursor-pointer text-xs text-slate-500 hover:text-red-600"
                          >
                            Remove
                          </button>
                        </div>
                        <textarea
                          value={p.content}
                          onChange={(e) => updatePersona(p.id, { content: e.target.value })}
                          rows={8}
                          className="w-full rounded-lg border border-white/60 bg-white/50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none"
                          placeholder="System prompt for this persona..."
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addPersona}
                    className="mt-3 cursor-pointer rounded-lg border border-dashed border-white/60 bg-white/30 px-4 py-2 text-sm text-slate-600 hover:bg-white/50"
                  >
                    Add persona
                  </button>
                </section>

                <section className="mb-8">
                  <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">API Keys</h3>
                  <div className="space-y-3">
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">OpenAI Key</span>
                      <input
                        type="password"
                        value={openaiKey}
                        onChange={(e) => {
                          setOpenaiKey(e.target.value);
                          persist(OPENAI_KEY_STORAGE_KEY, e.target.value);
                        }}
                        className="w-full rounded-xl border border-white/70 bg-white/50 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
                        placeholder="sk-..."
                        autoComplete="off"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">GitHub Token</span>
                      <input
                        type="password"
                        value={githubToken}
                        onChange={(e) => {
                          setGithubToken(e.target.value);
                          persist(GITHUB_TOKEN_STORAGE_KEY, e.target.value);
                        }}
                        className="w-full rounded-xl border border-white/70 bg-white/50 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
                        placeholder="ghp_..."
                        autoComplete="off"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">Linear API Key</span>
                      <input
                        type="password"
                        value={linearApiKey}
                        onChange={(e) => {
                          setLinearApiKey(e.target.value);
                          persist(LINEAR_API_KEY_STORAGE_KEY, e.target.value);
                        }}
                        className="w-full rounded-xl border border-white/70 bg-white/50 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
                        placeholder="lin_api_..."
                        autoComplete="off"
                      />
                    </label>
                  </div>
                </section>

                <section className="mb-6">
                  <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">Loops Config</h3>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">Loops API Key</span>
                    <input
                      type="password"
                      value={loopsApiKey}
                      onChange={(e) => {
                        setLoopsApiKey(e.target.value);
                        persist(LOOPS_API_KEY_STORAGE_KEY, e.target.value);
                      }}
                      className="w-full rounded-xl border border-white/70 bg-white/50 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
                      placeholder="Loops API key"
                      autoComplete="off"
                    />
                  </label>
                </section>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main chat column */}
      <div className="relative z-10 flex flex-1 flex-col min-h-0">
        {!hasStartedConversation ? (
          /* Phase 1: Initial — greeting, centered island, suggestion chips */
          <div className="flex flex-1 flex-col overflow-y-auto">
            <div className="mx-auto flex min-h-full w-full max-w-3xl flex-1 flex-col px-4 pt-10 pb-8">
              <div className="flex flex-1 flex-col items-center justify-center gap-8 py-8">
                <div className="mb-2 mt-16 text-center">
                  <p className="text-base font-medium text-slate-700">Hi there</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                    What should I write?
                  </p>
                </div>
                <ChatbotIsland
                  activeMode={activeMode}
                  setActiveMode={setActiveMode}
                  inputValue={inputValue}
                  setInputValue={setInputValue}
                  onSubmit={handleSubmit}
                  fixed={false}
                />
                <div className="flex flex-wrap justify-center gap-2">
                  {suggestionChips.map((label) => {
                    const isActive = selectedSuggestion === label;
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => handleSuggestionClick(label)}
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
              </div>
            </div>
          </div>
        ) : (
          /* Phase 2: Conversation — scrollable messages, fixed island */
          <>
            <div
              className="flex-1 overflow-y-auto"
              style={{ paddingBottom: "220px" }}
            >
              <div className="mx-auto max-w-3xl px-4 py-8">
                {/* User message */}
                <div className="mb-6 flex justify-end">
                  <div className="glass-card bg-white/30 backdrop-blur-xl max-w-[85%] rounded-2xl border border-white/50 px-4 py-3">
                    <p className="text-sm font-medium text-slate-800">{firstUserMessage}</p>
                  </div>
                </div>
                {/* Main glass card: user message + Results or loading */}
                <div className="flex justify-start">
                  <div className="glass-card bg-white/30 backdrop-blur-xl w-full max-w-3xl rounded-2xl border border-white/50 px-5 py-5">
                    {generateLoading && (
                      <div className="flex flex-col items-center justify-center py-12">
                        <motion.span
                          className="text-base font-light text-slate-500"
                          animate={{ opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                        >
                          Writing...
                        </motion.span>
                      </div>
                    )}
                    {generateError && !generateLoading && (
                      <p className="text-sm text-red-600">{generateError}</p>
                    )}
                    {draft && !generateLoading && (
                      <div className="space-y-5">
                        <div>
                          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">Subject</p>
                          <p className="text-sm font-medium text-slate-800">{draft.subject}</p>
                        </div>
                        <div>
                          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">Preheader</p>
                          <p className="text-sm text-slate-700">{draft.preheader}</p>
                        </div>
                        <div>
                          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Email Preview</p>
                          <div
                            className="min-h-[120px] rounded-xl border border-white/60 bg-white/40 p-4 text-sm text-slate-700 [&_p]:my-2 [&_ul]:my-2 [&_li]:my-0.5"
                            dangerouslySetInnerHTML={{ __html: draft.body }}
                          />
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleCopyHtml}
                              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/60 bg-white/50 px-3 py-2 text-sm text-slate-700 transition hover:bg-white/70"
                            >
                              {copySuccess ? (
                                <>
                                  <Check size={16} className="text-green-600" />
                                  <span>Copied</span>
                                </>
                              ) : (
                                <span>Copy HTML</span>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    {!draft && !generateLoading && !generateError && (
                      <>
                        <p className="text-sm text-slate-600">Email draft will appear here.</p>
                        <p className="mt-2 text-xs text-slate-400">Submit your request to generate a draft.</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <ChatbotIsland
              activeMode={activeMode}
              setActiveMode={setActiveMode}
              inputValue={inputValue}
              setInputValue={setInputValue}
              onSubmit={handleSubmit}
              fixed={true}
            />
          </>
        )}
      </div>
    </main>
  );
}

function AnimatedMesh() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <motion.div
        className="absolute -left-24 top-[-10%] h-[46vh] w-[46vh] rounded-full bg-sky-200/30 blur-3xl"
        animate={{
          x: [0, 40, -20, 0],
          y: [0, 28, 18, 0]
        }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute right-[-8%] top-[10%] h-[52vh] w-[52vh] rounded-full bg-slate-200/35 blur-3xl"
        animate={{
          x: [0, -35, 20, 0],
          y: [0, -18, 25, 0]
        }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[-16%] left-[28%] h-[44vh] w-[44vh] rounded-full bg-blue-100/35 blur-3xl"
        animate={{
          x: [0, 22, -24, 0],
          y: [0, -20, 12, 0]
        }}
        transition={{ duration: 34, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.65),rgba(245,248,252,0.9))]" />
    </div>
  );
}
