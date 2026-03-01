"use client";

import { AnimatePresence } from "framer-motion";
import { Check, CheckCircle, Eye, Rocket, Send } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const GENERATING_PHRASES = [
  "Generating...",
  "Cooking...",
  "Drafting...",
  "Writing...",
  "Polishing...",
  "Almost there..."
];

type Draft = {
  subject: string;
  preheader: string;
  body: string;
};

type DraftPreviewProps = {
  draft: Draft | null;
  generateLoading: boolean;
  generateError: string | null;
  copySuccess: boolean;
  onCopyHtml: () => void;
  loopsConfigured: boolean;
  defaultRecipientEmail: string;
  onSendViaLoops: (recipientEmail: string) => Promise<void>;
  sendLoading: boolean;
  sendError: string | null;
  sendSuccess: boolean;
  targetGroupLabel?: string;
  onDirectShip: () => Promise<void>;
  directShipLoading: boolean;
  directShipError: string | null;
  directShipSuccess: boolean;
};

export function DraftPreview({
  draft,
  generateLoading,
  generateError,
  copySuccess,
  onCopyHtml,
  loopsConfigured,
  defaultRecipientEmail,
  onSendViaLoops,
  sendLoading,
  sendError,
  sendSuccess,
  targetGroupLabel = "General",
  onDirectShip,
  directShipLoading,
  directShipError,
  directShipSuccess
}: DraftPreviewProps) {
  const [recipientEmail, setRecipientEmail] = useState(defaultRecipientEmail);
  const [confirmShip, setConfirmShip] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [generatingPhraseIndex, setGeneratingPhraseIndex] = useState(0);
  const hasAppliedDefault = useRef(false);

  useEffect(() => {
    if (!generateLoading) return;
    const id = setInterval(() => {
      setGeneratingPhraseIndex((i) => (i + 1) % GENERATING_PHRASES.length);
    }, 2000);
    return () => clearInterval(id);
  }, [generateLoading]);

  useEffect(() => {
    if (defaultRecipientEmail && !hasAppliedDefault.current) {
      hasAppliedDefault.current = true;
      setRecipientEmail(defaultRecipientEmail);
    }
  }, [defaultRecipientEmail]);

  useEffect(() => {
    if (!directShipLoading && !directShipSuccess) {
      setConfirmShip(false);
    }
  }, [directShipLoading, directShipSuccess]);

  const canSend = loopsConfigured && recipientEmail.trim();

  const handleDirectShipClick = () => {
    if (!confirmShip) {
      setConfirmShip(true);
      return;
    }
    onDirectShip();
    setConfirmShip(false);
  };

  return (
    <div className="flex justify-start">
      <div className="glass-card bg-white/30 backdrop-blur-xl w-full max-w-3xl rounded-2xl border border-white/50 px-5 py-5">
        {generateLoading && (
          <motion.p
            key={generatingPhraseIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm font-light text-slate-500"
          >
            {GENERATING_PHRASES[generatingPhraseIndex]}
          </motion.p>
        )}
        {generateError && !generateLoading && (
          <p className="text-sm text-red-600">{generateError}</p>
        )}
        {draft && !generateLoading && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Draft</p>
              <button
                type="button"
                onClick={() => setPreviewMode((p) => !p)}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                  previewMode
                    ? "bg-slate-700 text-white"
                    : "border border-white/60 bg-white/50 text-slate-600 hover:bg-white/70"
                }`}
              >
                <Eye size={14} />
                {previewMode ? "Preview on" : "Email preview"}
              </button>
            </div>

            {previewMode ? (
              <div className="rounded-xl border border-white/60 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-slate-200/80 bg-slate-50/80 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900 truncate">{draft.subject}</p>
                  <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{draft.preheader}</p>
                </div>
                <div
                  className="max-w-[600px] mx-auto bg-white p-5 text-[15px] leading-relaxed text-slate-700 [&_p]:my-3 [&_ul]:my-3 [&_li]:my-1"
                  dangerouslySetInnerHTML={{ __html: draft.body }}
                />
              </div>
            ) : (
              <>
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
                </div>
              </>
            )}

            <div className="mt-3 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onCopyHtml}
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

                {/* Direct Ship section */}
                <div className="border-t border-white/40 pt-3">
                  <AnimatePresence mode="wait">
                    {directShipSuccess ? (
                      <motion.div
                        key="ship-success"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                        className="flex flex-col items-center justify-center gap-2 py-6"
                      >
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: [0, 1.2, 1] }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                        >
                          <CheckCircle size={36} className="text-green-600" />
                        </motion.div>
                        <p className="text-lg font-semibold text-green-700">Newsletter Sent to {targetGroupLabel}</p>
                        <p className="text-xs text-slate-500">Broadcast via Loops successfully</p>
                      </motion.div>
                    ) : directShipLoading ? (
                      <motion.div
                        key="ship-loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center gap-3 py-5"
                      >
                        <p className="text-sm font-medium text-slate-600">Broadcasting via Loops...</p>
                        <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-slate-200">
                          <motion.div
                            className="h-full rounded-full bg-slate-700"
                            initial={{ width: "0%" }}
                            animate={{ width: "100%" }}
                            transition={{ duration: 3, ease: "easeInOut" }}
                          />
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="ship-form"
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                          Direct Ship to {targetGroupLabel}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={!loopsConfigured}
                            onClick={handleDirectShipClick}
                            className={`inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                              confirmShip
                                ? "bg-amber-600 text-white hover:bg-amber-700"
                                : "bg-slate-900 text-white hover:bg-slate-800"
                            }`}
                          >
                            <Rocket size={14} />
                            <span>{confirmShip ? "Confirm Ship?" : "Direct Ship"}</span>
                          </button>
                          {confirmShip && (
                            <button
                              type="button"
                              onClick={() => setConfirmShip(false)}
                              className="cursor-pointer rounded-lg border border-white/60 bg-white/50 px-3 py-2 text-sm text-slate-600 transition hover:bg-white/70"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                        {directShipError && (
                          <p className="mt-1 text-xs text-red-600">{directShipError}</p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Individual send via Loops */}
                <div className="border-t border-white/40 pt-3">
                  <AnimatePresence mode="wait">
                    {sendSuccess ? (
                      <motion.div
                        key="shipped"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                        className="flex flex-col items-center justify-center gap-2 py-6"
                      >
                        <motion.div
                          animate={{ y: [0, -8, 0] }}
                          transition={{ duration: 0.6, repeat: 2, ease: "easeInOut" }}
                        >
                          <Rocket size={28} className="text-green-600" />
                        </motion.div>
                        <p className="text-lg font-semibold text-green-700">Email Shipped!</p>
                        <p className="text-xs text-slate-500">Sent successfully via Loops</p>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="send-form"
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Send to Individual</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="email"
                            value={recipientEmail}
                            onChange={(e) => setRecipientEmail(e.target.value)}
                            placeholder="recipient@example.com"
                            className="flex-1 rounded-lg border border-white/60 bg-white/50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none"
                          />
                          <button
                            type="button"
                            disabled={!canSend || sendLoading}
                            onClick={() => onSendViaLoops(recipientEmail.trim())}
                            className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {sendLoading ? (
                              <motion.span
                                animate={{ opacity: [0.5, 1, 0.5] }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                              >
                                Sending...
                              </motion.span>
                            ) : (
                              <>
                                <Send size={14} />
                                <span>Ship to Loops</span>
                              </>
                            )}
                          </button>
                        </div>
                        {!loopsConfigured && (
                          <p className="mt-1 text-xs text-amber-700">Loops is not configured on the server.</p>
                        )}
                        {sendError && (
                          <p className="mt-1 text-xs text-red-600">{sendError}</p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
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
  );
}
