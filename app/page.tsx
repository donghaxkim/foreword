"use client";

import { MessageSquarePlus, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AnimatedMesh } from "./components/AnimatedMesh";
import { ChatbotIsland } from "./components/ChatbotIsland";
import { DraftPreview } from "./components/DraftPreview";
import { SettingsPanel } from "./components/SettingsPanel";
import { SuggestionChips } from "./components/SuggestionChips";
import type { Mode, Persona } from "./components/types";
import {
  DEFAULT_SYSTEM_PERSONA,
  GITHUB_TOKEN_STORAGE_KEY,
  LINEAR_API_KEY_STORAGE_KEY,
  PERSONAS_STORAGE_KEY,
  SELECTED_PERSONA_STORAGE_KEY,
  mapSuggestionToPrompt,
  mapSuggestionToVibe
} from "./lib/constants";

export default function Home() {
  const [activeMode, setActiveMode] = useState<Mode>("Manual");
  const [inputValue, setInputValue] = useState("");
  const [hasStartedConversation, setHasStartedConversation] = useState(false);
  const [firstUserMessage, setFirstUserMessage] = useState<string | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [personas, setPersonas] = useState<Persona[]>(() => [
    { id: "default", name: "Caddy Chief of Staff", content: DEFAULT_SYSTEM_PERSONA }
  ]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>("default");
  const [githubToken, setGithubToken] = useState("");
  const [linearApiKey, setLinearApiKey] = useState("");
  const [githubVerified, setGithubVerified] = useState<boolean | null>(null);
  const [linearVerified, setLinearVerified] = useState<boolean | null>(null);
  const githubVerifyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const linearVerifyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loopsConfigured, setLoopsConfigured] = useState(false);
  const [loopsDefaultRecipient, setLoopsDefaultRecipient] = useState("");
  const [draft, setDraft] = useState<{ subject: string; preheader: string; body: string } | null>(null);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedGithubContent, setLastSyncedGithubContent] = useState("");
  const [lastSyncedLinearContent, setLastSyncedLinearContent] = useState("");
  const [sendLoading, setSendLoading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [directShipLoading, setDirectShipLoading] = useState(false);
  const [directShipError, setDirectShipError] = useState<string | null>(null);
  const [directShipSuccess, setDirectShipSuccess] = useState(false);

  // Handle post-OAuth redirect: open settings and clean URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected")) {
      setSettingsOpen(true);
      window.history.replaceState({}, "", "/");
    }
  }, []);

  // Load persisted state from localStorage
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
    const github = localStorage.getItem(GITHUB_TOKEN_STORAGE_KEY);
    if (github != null) setGithubToken(github);
    const linear = localStorage.getItem(LINEAR_API_KEY_STORAGE_KEY);
    if (linear != null) setLinearApiKey(linear);
  }, []);

  // Verify GitHub token when it changes
  useEffect(() => {
    if (!githubToken.trim()) {
      setGithubVerified(false);
      return;
    }
    setGithubVerified(null);
    if (githubVerifyTimeoutRef.current) clearTimeout(githubVerifyTimeoutRef.current);
    githubVerifyTimeoutRef.current = setTimeout(() => {
      githubVerifyTimeoutRef.current = null;
      fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integration: "github", apiKey: githubToken.trim() })
      })
        .then((res) => res.json())
        .then((data: { valid?: boolean }) => setGithubVerified(!!data?.valid))
        .catch(() => setGithubVerified(false));
    }, 600);
    return () => {
      if (githubVerifyTimeoutRef.current) clearTimeout(githubVerifyTimeoutRef.current);
    };
  }, [githubToken]);

  // Verify Linear token when it changes
  useEffect(() => {
    if (!linearApiKey.trim()) {
      setLinearVerified(false);
      return;
    }
    setLinearVerified(null);
    if (linearVerifyTimeoutRef.current) clearTimeout(linearVerifyTimeoutRef.current);
    linearVerifyTimeoutRef.current = setTimeout(() => {
      linearVerifyTimeoutRef.current = null;
      fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integration: "linear", apiKey: linearApiKey.trim() })
      })
        .then((res) => res.json())
        .then((data: { valid?: boolean }) => setLinearVerified(!!data?.valid))
        .catch(() => setLinearVerified(false));
    }, 600);
    return () => {
      if (linearVerifyTimeoutRef.current) clearTimeout(linearVerifyTimeoutRef.current);
    };
  }, [linearApiKey]);

  // Fetch server config (Loops availability and default recipient)
  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((data: { loopsConfigured?: boolean; loopsDefaultRecipient?: string }) => {
        if (data.loopsConfigured != null) setLoopsConfigured(data.loopsConfigured);
        if (data.loopsDefaultRecipient != null) setLoopsDefaultRecipient(data.loopsDefaultRecipient ?? "");
      })
      .catch(() => {});
  }, []);

  // Phase 1: Auto-sync when switching to GitHub/Linear mode
  useEffect(() => {
    if (activeMode === "Manual") {
      setSyncError(null);
      return;
    }

    const apiKey = activeMode === "GitHub" ? githubToken : linearApiKey;

    if (!apiKey) {
      const githubOAuth = !!process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
      const linearOAuth = !!process.env.NEXT_PUBLIC_LINEAR_CLIENT_ID;
      const useConnectCopy =
        (activeMode === "GitHub" && githubOAuth) || (activeMode === "Linear" && linearOAuth);
      setSyncError(
        useConnectCopy
          ? `Connect ${activeMode} in Settings to sync.`
          : `Add your ${activeMode} ${activeMode === "GitHub" ? "token" : "API key"} in Settings to sync.`
      );
      return;
    }

    let cancelled = false;
    setSyncLoading(true);
    setSyncError(null);

    fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        githubApiKey: githubToken || undefined,
        linearApiKey: linearApiKey || undefined
      })
    })
      .then(async (res) => {
        if (cancelled) return;
        const data = await res.json() as {
          githubContent?: string;
          linearContent?: string;
          error?: string;
          githubError?: string;
          linearError?: string;
        };
        if (!res.ok) {
          setSyncError(data?.error ?? "Sync failed");
          return;
        }
        setLastSyncedGithubContent(data.githubContent ?? "");
        setLastSyncedLinearContent(data.linearContent ?? "");
        const content =
          activeMode === "GitHub"
            ? (data.githubContent ?? "")
            : activeMode === "Linear"
              ? (data.linearContent ?? "")
              : "";
        setInputValue(content);
        if (activeMode === "GitHub" && data.githubError) setSyncError(data.githubError);
        else if (activeMode === "Linear" && data.linearError) setSyncError(data.linearError);
      })
      .catch(() => {
        if (!cancelled) setSyncError("Sync failed — check your connection and try again.");
      })
      .finally(() => {
        if (!cancelled) setSyncLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeMode, githubToken, linearApiKey]);

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

  const handleSubmit = async (value: string) => {
    setFirstUserMessage(value);
    setInputValue("");
    setHasStartedConversation(true);
    setDraft(null);
    setGenerateError(null);
    setGenerateLoading(true);
    setSendSuccess(false);
    setSendError(null);
    setDirectShipSuccess(false);
    setDirectShipError(null);
    try {
      const vibe = mapSuggestionToVibe(selectedSuggestion);
      const body: Record<string, unknown> = {
        manualNotes: value,
        githubData: lastSyncedGithubContent ?? "",
        linearData: lastSyncedLinearContent ?? "",
        vibe
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
    setSendSuccess(false);
    setSendError(null);
    setDirectShipSuccess(false);
    setDirectShipError(null);
  };

  // Phase 3: Suggestion chips seed the textarea
  const handleSuggestionClick = (label: string) => {
    const isDeselecting = selectedSuggestion === label;
    setSelectedSuggestion(isDeselecting ? null : label);
    if (!isDeselecting) {
      setInputValue(mapSuggestionToPrompt(label));
    }
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

  const vibeToTargetGroup = (vibe: string): string => {
    const lower = vibe.toLowerCase();
    if (lower.includes("investor")) return "investors";
    if (lower.includes("beta") || lower.includes("tester")) return "private-beta";
    return "general";
  };

  // Phase 4: Loops send handler (uses server-side Loops config)
  const handleSendViaLoops = async (recipientEmail: string) => {
    if (!draft || !recipientEmail) return;
    setSendLoading(true);
    setSendError(null);
    setSendSuccess(false);
    try {
      const vibe = mapSuggestionToVibe(selectedSuggestion);
      const targetGroup = vibeToTargetGroup(vibe);
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: draft.subject,
          preheader: draft.preheader,
          htmlBody: draft.body,
          recipientEmail,
          targetGroup
        })
      });
      if (!res.ok) {
        const data = await res.json();
        setSendError(data?.error ?? "Failed to send via Loops");
        return;
      }
      setSendSuccess(true);
      setTimeout(() => {
        setDraft(null);
        setHasStartedConversation(false);
        setFirstUserMessage(null);
        setSendSuccess(false);
      }, 2500);
    } catch {
      setSendError("Failed to send via Loops");
    } finally {
      setSendLoading(false);
    }
  };

  const vibeToGroupLabel = (vibe: string): string => {
    const lower = vibe.toLowerCase();
    if (lower.includes("investor")) return "Investors";
    if (lower.includes("beta") || lower.includes("tester")) return "Private Beta";
    return "General";
  };

  const handleDirectShip = async () => {
    if (!draft) return;
    setDirectShipLoading(true);
    setDirectShipError(null);
    setDirectShipSuccess(false);
    try {
      const vibe = mapSuggestionToVibe(selectedSuggestion);
      const targetGroup = vibeToTargetGroup(vibe);
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: draft.subject,
          preheader: draft.preheader,
          htmlBody: draft.body,
          targetGroup
        })
      });
      if (!res.ok) {
        const data = await res.json();
        setDirectShipError(data?.error ?? "Failed to broadcast via Loops");
        return;
      }
      setDirectShipSuccess(true);
      setTimeout(() => {
        setDraft(null);
        setHasStartedConversation(false);
        setFirstUserMessage(null);
        setDirectShipSuccess(false);
      }, 2500);
    } catch {
      setDirectShipError("Failed to broadcast via Loops");
    } finally {
      setDirectShipLoading(false);
    }
  };

  const vibeLabel = selectedSuggestion ? mapSuggestionToVibe(selectedSuggestion) : null;

  return (
    <main className="relative flex min-h-screen overflow-hidden text-slate-900">
      <AnimatedMesh />

      {/* Left sidebar */}
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

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        personas={personas}
        selectedPersonaId={selectedPersonaId}
        onSelectPersona={(id) => saveSelectedPersonaId(id)}
        onAddPersona={addPersona}
        onUpdatePersona={updatePersona}
        onRemovePersona={removePersona}
        githubToken={githubToken}
        onGithubTokenChange={(v) => { setGithubToken(v); persist(GITHUB_TOKEN_STORAGE_KEY, v); }}
        linearApiKey={linearApiKey}
        onLinearApiKeyChange={(v) => { setLinearApiKey(v); persist(LINEAR_API_KEY_STORAGE_KEY, v); }}
        githubVerified={githubVerified}
        linearVerified={linearVerified}
      />

      {/* Main chat column */}
      <div className="relative z-10 flex flex-1 flex-col min-h-0">
        {!hasStartedConversation ? (
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
                  syncLoading={syncLoading}
                  syncError={syncError}
                />
                <SuggestionChips
                  selectedSuggestion={selectedSuggestion}
                  onSuggestionClick={handleSuggestionClick}
                />
              </div>
            </div>
          </div>
        ) : (
          <>
            <div
              className="flex-1 overflow-y-auto"
              style={{ paddingBottom: "220px" }}
            >
              <div className="mx-auto max-w-3xl px-4 py-8">
                {/* User message */}
                <div className="mb-6 flex justify-end">
                  <div className="flex flex-col items-end gap-1">
                    {vibeLabel && (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                        Vibe: {vibeLabel}
                      </span>
                    )}
                    <div className="glass-card bg-white/30 backdrop-blur-xl max-w-[85%] rounded-2xl border border-white/50 px-4 py-3">
                      <p className="text-sm font-medium text-slate-800 whitespace-pre-wrap">{firstUserMessage}</p>
                    </div>
                  </div>
                </div>
                <DraftPreview
                  draft={draft}
                  generateLoading={generateLoading}
                  generateError={generateError}
                  copySuccess={copySuccess}
                  onCopyHtml={handleCopyHtml}
                  loopsConfigured={loopsConfigured}
                  defaultRecipientEmail={loopsDefaultRecipient}
                  onSendViaLoops={handleSendViaLoops}
                  sendLoading={sendLoading}
                  sendError={sendError}
                  sendSuccess={sendSuccess}
                  targetGroupLabel={vibeToGroupLabel(mapSuggestionToVibe(selectedSuggestion))}
                  onDirectShip={handleDirectShip}
                  directShipLoading={directShipLoading}
                  directShipError={directShipError}
                  directShipSuccess={directShipSuccess}
                />
              </div>
            </div>
            <ChatbotIsland
              activeMode={activeMode}
              setActiveMode={setActiveMode}
              inputValue={inputValue}
              setInputValue={setInputValue}
              onSubmit={handleSubmit}
              fixed={true}
              syncLoading={syncLoading}
              syncError={syncError}
            />
          </>
        )}
      </div>
    </main>
  );
}
