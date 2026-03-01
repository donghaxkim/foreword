"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ExternalLink, Loader2, XCircle } from "lucide-react";
import type { Persona } from "./types";

const githubOAuthAvailable = !!process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
const linearOAuthAvailable = !!process.env.NEXT_PUBLIC_LINEAR_CLIENT_ID;

type SettingsPanelProps = {
  open: boolean;
  onClose: () => void;
  personas: Persona[];
  selectedPersonaId: string | null;
  onSelectPersona: (id: string) => void;
  onAddPersona: () => void;
  onUpdatePersona: (id: string, updates: Partial<Pick<Persona, "name" | "content">>) => void;
  onRemovePersona: (id: string) => void;
  githubToken: string;
  onGithubTokenChange: (v: string) => void;
  linearApiKey: string;
  onLinearApiKeyChange: (v: string) => void;
  githubVerified?: boolean | null;
  linearVerified?: boolean | null;
};

function IntegrationBlock({
  label,
  token,
  onTokenChange,
  oauthAvailable,
  oauthUrl,
  placeholder,
  envHint,
  verified = null
}: {
  label: string;
  token: string;
  onTokenChange: (v: string) => void;
  oauthAvailable: boolean;
  oauthUrl: string;
  placeholder: string;
  envHint: string;
  verified?: boolean | null;
}) {
  const isConnected = !!token && verified === true;
  const isChecking = !!token && verified === null;
  const isInvalid = !!token && verified === false;

  return (
    <div className="rounded-xl border border-white/60 bg-white/40 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        {isConnected && (
          <span className="flex items-center gap-1 text-xs font-medium text-green-700">
            <Check size={14} /> Connected
          </span>
        )}
        {isChecking && (
          <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
            <Loader2 size={14} className="animate-spin" /> Checking…
          </span>
        )}
        {isInvalid && (
          <span className="flex items-center gap-1 text-xs font-medium text-amber-700">
            <XCircle size={14} /> Invalid token
          </span>
        )}
      </div>

      {oauthAvailable && !isConnected && (
        <a
          href={oauthUrl}
          className="mb-2 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white transition hover:bg-slate-800"
        >
          <ExternalLink size={14} />
          Connect {label}
        </a>
      )}

      {oauthAvailable && isConnected && (
        <button
          type="button"
          onClick={() => onTokenChange("")}
          className="mb-2 cursor-pointer rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100"
        >
          Disconnect
        </button>
      )}

      {!oauthAvailable && (
        <>
          <p className="mb-2 text-xs text-slate-500">{envHint}</p>
          <div className="mt-2">
            <input
              type="password"
              value={token}
              onChange={(e) => onTokenChange(e.target.value)}
              className="w-full rounded-xl border border-white/70 bg-white/50 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
              placeholder={placeholder}
              autoComplete="off"
            />
          </div>
        </>
      )}
    </div>
  );
}

export function SettingsPanel({
  open,
  onClose,
  personas,
  selectedPersonaId,
  onSelectPersona,
  onAddPersona,
  onUpdatePersona,
  onRemovePersona,
  githubToken,
  onGithubTokenChange,
  linearApiKey,
  onLinearApiKeyChange,
  githubVerified = null,
  linearVerified = null
}: SettingsPanelProps) {
  return (
    <AnimatePresence>
      {open && (
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
            onClick={onClose}
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
                  onClick={onClose}
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
                            onChange={() => onSelectPersona(p.id)}
                            className="h-4 w-4 accent-slate-800"
                          />
                          <input
                            type="text"
                            value={p.name}
                            onChange={(e) => onUpdatePersona(p.id, { name: e.target.value })}
                            className="flex-1 rounded-lg border border-white/60 bg-white/50 px-3 py-1.5 text-sm font-medium text-slate-800 focus:border-slate-300 focus:outline-none"
                            placeholder="Persona name"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => onRemovePersona(p.id)}
                          className="cursor-pointer text-xs text-slate-500 hover:text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                      <textarea
                        value={p.content}
                        onChange={(e) => onUpdatePersona(p.id, { content: e.target.value })}
                        rows={8}
                        className="w-full rounded-lg border border-white/60 bg-white/50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none"
                        placeholder="System prompt for this persona..."
                      />
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={onAddPersona}
                  className="mt-3 cursor-pointer rounded-lg border border-dashed border-white/60 bg-white/30 px-4 py-2 text-sm text-slate-600 hover:bg-white/50"
                >
                  Add persona
                </button>
              </section>

              <section className="mb-8">
                <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">Integrations</h3>
                <div className="space-y-3">
                  <IntegrationBlock
                    label="GitHub"
                    token={githubToken}
                    onTokenChange={onGithubTokenChange}
                    oauthAvailable={githubOAuthAvailable}
                    oauthUrl="/api/auth/github"
                    placeholder="ghp_..."
                    envHint="Set NEXT_PUBLIC_GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to connect via OAuth, or use a personal token below."
                    verified={githubVerified}
                  />
                  <IntegrationBlock
                    label="Linear"
                    token={linearApiKey}
                    onTokenChange={onLinearApiKeyChange}
                    oauthAvailable={linearOAuthAvailable}
                    oauthUrl="/api/auth/linear"
                    placeholder="lin_api_..."
                    envHint="Set NEXT_PUBLIC_LINEAR_CLIENT_ID and LINEAR_CLIENT_SECRET to connect via OAuth, or use a personal token below."
                    verified={linearVerified}
                  />
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Loops sending is managed by server configuration in this workspace.
                </p>
              </section>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
