"use client";

import { Check, Send } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

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
  // Loops send (server-configured)
  loopsConfigured: boolean;
  defaultRecipientEmail: string;
  onSendViaLoops: (recipientEmail: string) => Promise<void>;
  sendLoading: boolean;
  sendError: string | null;
  sendSuccess: boolean;
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
  sendSuccess
}: DraftPreviewProps) {
  const [recipientEmail, setRecipientEmail] = useState(defaultRecipientEmail);
  const hasAppliedDefault = useRef(false);

  useEffect(() => {
    if (defaultRecipientEmail && !hasAppliedDefault.current) {
      hasAppliedDefault.current = true;
      setRecipientEmail(defaultRecipientEmail);
    }
  }, [defaultRecipientEmail]);

  const canSend = loopsConfigured && recipientEmail.trim();

  return (
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

                {/* Loops send section */}
                <div className="border-t border-white/40 pt-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Send via Loops</p>
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
                      ) : sendSuccess ? (
                        <>
                          <Check size={16} className="text-green-400" />
                          <span>Sent</span>
                        </>
                      ) : (
                        <>
                          <Send size={14} />
                          <span>Send</span>
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
                </div>
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
