"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageSquarePlus, Settings } from "lucide-react";

import { AnimatedMesh } from "./components/AnimatedMesh";
import { ChatbotIsland } from "./components/ChatbotIsland";
import { DraftPreview } from "./components/DraftPreview";
import type { LoopsList } from "./components/RecipientSelector";
import { SettingsPanel } from "./components/SettingsPanel";
import { SuggestionChips } from "./components/SuggestionChips";
import type { Mode, Persona } from "./components/types";
import {
  mapSuggestionToVibe
} from "./lib/constants";
import { runPreflightCheck } from "./lib/preflight";

type TokenStatus = {
  github: { connected: boolean; scopes: string } | null;
  linear: { connected: boolean; scopes: string } | null;
  loops: { connected: boolean; scopes: string } | null;
};

type User = { id: string; email: string };

type ChatHistoryItem = {
  id: string;
  prompt: string;
  vibe: string | null;
  subject: string | null;
  preheader: string | null;
  body: string | null;
  created_at: string;
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const [activeMode, setActiveMode] = useState<Mode>("Manual");
  const [inputValue, setInputValue] = useState("");
  const [hasStartedConversation, setHasStartedConversation] = useState(false);
  const [firstUserMessage, setFirstUserMessage] = useState<string | null>(null);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);

  // Connection status from server (replaces client-side token state)
  const [githubConnected, setGithubConnected] = useState(false);
  const [linearConnected, setLinearConnected] = useState(false);
  const [loopsConnected, setLoopsConnected] = useState(false);
  const [githubScopes, setGithubScopes] = useState("");
  const [linearScopes, setLinearScopes] = useState("");
  const [loopsScopes, setLoopsScopes] = useState("");

  const [loopsConfigured, setLoopsConfigured] = useState(false);
  const [loopsDefaultRecipient, setLoopsDefaultRecipient] = useState("");
  const [draft, setDraft] = useState<{ subject: string; preheader: string; body: string } | null>(null);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncDays, setSyncDays] = useState<number>(7);
  const [githubRepo, setGithubRepo] = useState("");
  const [lastSyncedGithubContent, setLastSyncedGithubContent] = useState("");
  const [lastSyncedLinearContent, setLastSyncedLinearContent] = useState("");
  const [sendLoading, setSendLoading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [directShipLoading, setDirectShipLoading] = useState(false);
  const [directShipError, setDirectShipError] = useState<string | null>(null);
  const [directShipSuccess, setDirectShipSuccess] = useState(false);

  // Mailing lists state
  const [loopsLists, setLoopsLists] = useState<LoopsList[]>([]);
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [listsLoading, setListsLoading] = useState(false);

  const tokenFetchRef = useRef(0);

  const loadUserSettings = useCallback(async () => {
    const res = await fetch("/api/settings");
    if (!res.ok) return;
    const data = await res.json() as {
      githubRepo?: string;
      personas?: Persona[] | null;
      selectedPersonaId?: string | null;
    };
    if (typeof data.githubRepo === "string") setGithubRepo(data.githubRepo);
    if (Array.isArray(data.personas) && data.personas.length > 0) setPersonas(data.personas);
    if (typeof data.selectedPersonaId === "string" || data.selectedPersonaId === null) {
      setSelectedPersonaId(data.selectedPersonaId);
    }
    setSettingsLoaded(true);
  }, []);

  const loadChatHistory = useCallback(async () => {
    const res = await fetch("/api/chats?limit=50");
    if (!res.ok) return;
    const data = await res.json() as { chats?: ChatHistoryItem[] };
    setChatHistory(data.chats ?? []);
  }, []);

  const fetchTokenStatus = useCallback(async () => {
    const id = ++tokenFetchRef.current;
    try {
      const res = await fetch("/api/tokens");
      if (res.status === 401) {
        setGithubConnected(false);
        setLinearConnected(false);
        setLoopsConnected(false);
        return;
      }
      if (id !== tokenFetchRef.current) return;
      const data = (await res.json()) as TokenStatus;
      setGithubConnected(!!data.github?.connected);
      setLinearConnected(!!data.linear?.connected);
      setLoopsConnected(!!data.loops?.connected);
      setGithubScopes(data.github?.scopes ?? "");
      setLinearScopes(data.linear?.scopes ?? "");
      setLoopsScopes(data.loops?.scopes ?? "");
    } catch {
      // keep existing state
    }
  }, []);

  // Handle post-OAuth redirect: open settings and refresh connection status
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected")) {
      setSettingsOpen(true);
      window.history.replaceState({}, "", "/");
    }
  }, []);

  // Check auth session on mount
  useEffect(() => {
    fetch("/api/auth/session")
      .then(async (res) => {
        if (!res.ok) {
          setUser(null);
          setAuthLoading(false);
          return;
        }
        const data = await res.json() as { user?: User };
        if (data.user) setUser(data.user);
        setAuthLoading(false);
      })
      .catch(() => {
        setUser(null);
        setAuthLoading(false);
      });
  }, []);

  // Bootstrap user-scoped data after login
  useEffect(() => {
    if (!user) return;
    setSettingsLoaded(false);
    Promise.all([fetchTokenStatus(), loadUserSettings(), loadChatHistory()])
      .catch(() => { })
      .finally(() => setSettingsLoaded(true));
  }, [user, fetchTokenStatus, loadUserSettings, loadChatHistory]);

  // Background sync: fetch GitHub/Linear data on login so generation is instant when switching mode
  useEffect(() => {
    if (!user || !settingsLoaded) return;
    const canSyncGitHub = githubConnected && githubRepo.trim();
    const canSyncLinear = linearConnected;
    if (!canSyncGitHub && !canSyncLinear) return;

    let cancelled = false;
    fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days: syncDays, repo: githubRepo.trim() || undefined })
    })
      .then(async (res) => {
        if (cancelled) return;
        const data = await res.json() as {
          githubContent?: string;
          linearContent?: string;
        };
        if (res.ok) {
          setLastSyncedGithubContent(data.githubContent ?? "");
          setLastSyncedLinearContent(data.linearContent ?? "");
        }
      })
      .catch(() => { });

    return () => {
      cancelled = true;
    };
  }, [user, settingsLoaded, githubConnected, linearConnected, syncDays, githubRepo]);

  useEffect(() => {
    if (!user || !settingsLoaded) return;
    fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        githubRepo,
        personas,
        selectedPersonaId
      })
    }).catch(() => { });
  }, [user, settingsLoaded, githubRepo, personas, selectedPersonaId]);

  // Fetch server config (Loops availability and default recipient)
  useEffect(() => {
    if (!user) return;
    fetch("/api/config")
      .then((res) => res.json())
      .then((data: { loopsConfigured?: boolean; loopsDefaultRecipient?: string }) => {
        if (data.loopsConfigured != null) setLoopsConfigured(data.loopsConfigured || loopsConnected);
        if (data.loopsDefaultRecipient != null) setLoopsDefaultRecipient(data.loopsDefaultRecipient ?? "");
      })
      .catch(() => { });
  }, [user, loopsConnected]);

  // Fetch mailing lists from Loops when configured
  useEffect(() => {
    if (!user || !loopsConfigured) return;
    setListsLoading(true);
    fetch("/api/lists")
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json() as { lists?: LoopsList[] };
        const lists = data.lists ?? [];
        setLoopsLists(lists);
        // Auto-select all lists on first load
        setSelectedListIds(lists.map((l) => l.id));
      })
      .catch(() => { })
      .finally(() => setListsLoading(false));
  }, [user, loopsConfigured]);

  // Auto-sync when switching to GitHub/Linear mode
  useEffect(() => {
    if (activeMode === "Manual") {
      setSyncError(null);
      setSyncLoading(false);
      return;
    }

    const isConnected = activeMode === "GitHub" ? githubConnected : linearConnected;

    if (!isConnected) {
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

    if (activeMode === "GitHub" && !githubRepo.trim()) {
      setSyncError("Select a repository in Settings (e.g. owner/repo).");
      return;
    }

    let cancelled = false;
    setSyncLoading(true);
    setSyncError(null);

    fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days: syncDays, repo: githubRepo.trim() || undefined })
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
  }, [activeMode, githubConnected, linearConnected, syncDays, githubRepo]);

  const savePersonas = (next: Persona[]) => setPersonas(next);

  const saveSelectedPersonaId = (id: string | null) => {
    setSelectedPersonaId(id);
  };

  const addPersona = () => {
    const id = `persona-${Date.now()}`;
    const next = [...personas, { id, name: "New persona", content: "" }];
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
    setInputValue("");
    setGenerateError(null);
    setGenerateLoading(true);
    setSendSuccess(false);
    setSendError(null);
    setDirectShipSuccess(false);
    setDirectShipError(null);
    const vibe = mapSuggestionToVibe(selectedSuggestion);

    const isRefinement = !!draft && value.trim().length > 0;

    if (!isRefinement) {
      setFirstUserMessage(value);
      setHasStartedConversation(true);
      setDraft(null);
    }

    let chatId = currentChatId;
    if (!isRefinement && !chatId) {
      try {
        const chatRes = await fetch("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: value, vibe })
        });
        if (chatRes.ok) {
          const chatData = await chatRes.json() as { chat?: ChatHistoryItem };
          if (chatData.chat) {
            chatId = chatData.chat.id;
            setCurrentChatId(chatData.chat.id);
            setChatHistory((prev) => [chatData.chat!, ...prev.filter((c) => c.id !== chatData.chat!.id)]);
          }
        }
      } catch {
        // keep generating even if chat persistence fails
      }
    }

    try {
      const body: Record<string, unknown> = isRefinement
        ? {
          refinementInstruction: value.trim(),
          currentDraft: { subject: draft!.subject, preheader: draft!.preheader, body: draft!.body }
        }
        : {
          manualNotes: value,
          githubData: lastSyncedGithubContent ?? "",
          linearData: lastSyncedLinearContent ?? "",
          vibe
        };
      if (!isRefinement && activePersonaContent) (body as Record<string, unknown>).systemPersona = activePersonaContent;
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) {
        setGenerateError(data?.error ?? (isRefinement ? "Failed to refine draft" : "Failed to generate email"));
        return;
      }
      const nextDraft = { subject: data.subject, preheader: data.preheader, body: data.body };
      setDraft(nextDraft);
      if (chatId) {
        fetch("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: chatId,
            prompt: isRefinement ? firstUserMessage : value,
            vibe,
            subject: nextDraft.subject,
            preheader: nextDraft.preheader,
            body: nextDraft.body
          })
        })
          .then(async (chatRes) => {
            if (!chatRes.ok) return;
            const chatData = await chatRes.json() as { chat?: ChatHistoryItem };
            if (!chatData.chat) return;
            setChatHistory((prev) => [
              chatData.chat!,
              ...prev.filter((item) => item.id !== chatData.chat!.id)
            ]);
          })
          .catch(() => { });
      }
    } catch {
      setGenerateError(isRefinement ? "Failed to refine draft" : "Failed to generate email");
    } finally {
      setGenerateLoading(false);
    }
  };

  const handleNewChat = () => {
    setHasStartedConversation(false);
    setFirstUserMessage(null);
    setCurrentChatId(null);
    setInputValue("");
    setSelectedSuggestion(null);
    setDraft(null);
    setGenerateError(null);
    setSendSuccess(false);
    setSendError(null);
    setDirectShipSuccess(false);
    setDirectShipError(null);
  };

  const handleSuggestionClick = (label: string) => {
    const isDeselecting = selectedSuggestion === label;
    setSelectedSuggestion(isDeselecting ? null : label);
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

  const handleToggleList = (id: string) => {
    setSelectedListIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllLists = () => {
    setSelectedListIds(loopsLists.map((l) => l.id));
  };

  const handleDeselectAllLists = () => {
    setSelectedListIds([]);
  };

  const handleSendViaLoops = async (recipientEmail: string) => {
    if (!draft || !recipientEmail) return;
    setSendLoading(true);
    setSendError(null);
    setSendSuccess(false);
    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: draft.subject,
          preheader: draft.preheader,
          htmlBody: draft.body,
          recipientEmail,
          selectedListIds
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

  const handleDirectShip = async () => {
    if (!draft || selectedListIds.length === 0) return;
    setDirectShipLoading(true);
    setDirectShipError(null);
    setDirectShipSuccess(false);
    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: draft.subject,
          preheader: draft.preheader,
          htmlBody: draft.body,
          selectedListIds
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

  const preflight = useMemo(
    () => runPreflightCheck(draft ?? {}),
    [draft?.subject, draft?.preheader, draft?.body]
  );

  const handleAuthSubmit = async () => {
    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError("Email and password are required.");
      return;
    }
    setAuthSubmitting(true);
    setAuthError(null);
    try {
      const endpoint = authMode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail.trim(), password: authPassword })
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data?.error ?? "Authentication failed.");
        return;
      }
      setUser(data.user);
      setAuthPassword("");
      setAuthError(null);
    } catch {
      setAuthError("Could not reach the server.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => { });
    setUser(null);
    setChatHistory([]);
    setHasStartedConversation(false);
    setFirstUserMessage(null);
    setDraft(null);
  };

  const openChat = (chat: ChatHistoryItem) => {
    setCurrentChatId(chat.id);
    setHasStartedConversation(true);
    setFirstUserMessage(chat.prompt);
    setSelectedSuggestion(chat.vibe ?? null);
    if (chat.subject && chat.preheader && chat.body) {
      setDraft({ subject: chat.subject, preheader: chat.preheader, body: chat.body });
    } else {
      setDraft(null);
    }
    setGenerateError(null);
  };

  if (authLoading) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden text-slate-900">
        <AnimatedMesh />
        <div className="glass-card bg-white/40 backdrop-blur-xl relative z-10 w-full max-w-md rounded-2xl border border-white/50 p-6">
          <p className="text-sm text-slate-600">Loading session...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden text-slate-900">
        <AnimatedMesh />
        <div className="glass-card bg-white/40 backdrop-blur-xl relative z-10 w-full max-w-md rounded-2xl border border-white/50 p-6">
          <h1 className="text-xl font-semibold text-slate-900">
            {authMode === "signup" ? "Create account" : "Log in"}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {authMode === "signup" ? "Sign up to save integrations and chat history." : "Log in to continue."}
          </p>
          <div className="mt-5 space-y-3">
            <input
              type="email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full rounded-xl border border-white/70 bg-white/50 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none"
            />
            <input
              type="password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full rounded-xl border border-white/70 bg-white/50 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAuthSubmit();
              }}
            />
            {authError && <p className="text-xs text-red-600">{authError}</p>}
            <button
              type="button"
              onClick={handleAuthSubmit}
              disabled={authSubmitting}
              className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {authSubmitting ? "Please wait..." : authMode === "signup" ? "Sign up" : "Log in"}
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setAuthMode((prev) => (prev === "signup" ? "login" : "signup"));
              setAuthError(null);
            }}
            className="mt-4 text-xs text-slate-600 underline decoration-dotted"
          >
            {authMode === "signup" ? "Already have an account? Log in" : "Need an account? Sign up"}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen overflow-hidden text-slate-900">
      <AnimatedMesh />

      {/* Left sidebar */}
      <aside className="glass-card bg-white/30 backdrop-blur-xl relative z-10 hidden h-screen w-[260px] shrink-0 flex-col overflow-hidden border-r border-white/50 md:flex">
        <div className="flex items-center gap-2 px-4 py-5 shrink-0">
          <div className="font-brand text-xl text-slate-900">Foreword</div>
        </div>
        <button
          type="button"
          onClick={handleNewChat}
          className="mx-3 mb-2 shrink-0 flex cursor-pointer items-center gap-2 rounded-xl border border-white/60 bg-white/40 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-white/60"
        >
          <MessageSquarePlus size={18} strokeWidth={1.6} />
          New chat
        </button>
        <div className="px-3 pb-1 text-xs text-slate-500">{user.email}</div>
        <div className="flex-1 overflow-y-auto px-2 py-2">
          <p className="px-2 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">
            Recent
          </p>
          {chatHistory.length === 0 ? (
            <p className="px-2 text-sm text-slate-400">No conversations yet</p>
          ) : (
            <div className="space-y-1">
              {chatHistory.map((chat) => (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => openChat(chat)}
                  className={`w-full truncate rounded-lg px-2 py-2 text-left text-sm transition ${currentChatId === chat.id
                    ? "bg-white/70 text-slate-900"
                    : "text-slate-600 hover:bg-white/50"
                    }`}
                >
                  {chat.prompt}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="shrink-0 border-t border-white/40 p-3">
          <button
            type="button"
            aria-label="Settings"
            onClick={() => setSettingsOpen((prev) => !prev)}
            className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-600 transition hover:bg-white/50"
          >
            <Settings size={18} strokeWidth={1.6} />
            Settings
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-2 w-full rounded-xl border border-white/60 bg-white/40 px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-white/60"
          >
            Log out
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
        githubConnected={githubConnected}
        linearConnected={linearConnected}
        loopsConnected={loopsConnected}
        githubScopes={githubScopes}
        linearScopes={linearScopes}
        loopsScopes={loopsScopes}
        onConnectionChange={fetchTokenStatus}
        githubRepo={githubRepo}
        onGithubRepoChange={(v) => setGithubRepo(v)}
      />

      {/* Main chat column */}
      <div className="relative z-10 flex flex-1 flex-col min-h-0">
        {!hasStartedConversation ? (
          <div className="flex flex-1 flex-col overflow-y-auto scrollbar-hide">
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
                  syncDays={syncDays}
                  setSyncDays={setSyncDays}
                  refinementMode={!!draft}
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
              className="flex-1 overflow-y-auto scrollbar-hide"
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
                  loopsLists={loopsLists}
                  listsLoading={listsLoading}
                  selectedListIds={selectedListIds}
                  onToggleList={handleToggleList}
                  onSelectAllLists={handleSelectAllLists}
                  onDeselectAllLists={handleDeselectAllLists}
                  onDirectShip={handleDirectShip}
                  directShipLoading={directShipLoading}
                  directShipError={directShipError}
                  directShipSuccess={directShipSuccess}
                  preflightOk={preflight.ok}
                  preflightIssues={preflight.issues}
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
              syncDays={syncDays}
              setSyncDays={setSyncDays}
              refinementMode={!!draft}
            />
          </>
        )}
      </div>
    </main>
  );
}
