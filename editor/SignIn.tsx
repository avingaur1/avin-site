"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { REPO } from "./config";
import { githubSignInAvailable, startGitHubSignIn, storeToken } from "./auth";
import { Button, inputCls } from "./ui";

export function SignIn({ message, onToken }: { message?: string; onToken: (t: string) => void }) {
  const oauth = githubSignInAvailable();
  const [showToken, setShowToken] = useState(!oauth);
  const [token, setToken] = useState("");
  const [remember, setRemember] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex h-14 items-center justify-end px-4">
        <ThemeToggle />
      </div>
      <div className="flex flex-1 items-start justify-center px-4 pb-16 pt-[8vh]">
        <div className="w-full max-w-[380px]">
          <p className="text-[15px] font-semibold tracking-tight">avin.</p>
          <h1 className="mt-6 text-[28px] font-semibold leading-tight tracking-[-0.02em]">Edit your website</h1>
          <p className="mt-2 text-muted">Sign in to update your work, photos and homepage.</p>

          {message && (
            <p role="alert" className="mt-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[14px]">
              {message}
            </p>
          )}

          {oauth && (
            <Button kind="primary" className="mt-8 h-12 w-full text-[15px]" onClick={startGitHubSignIn}>
              <GitHubMark /> Sign in with GitHub
            </Button>
          )}

          <div className={oauth ? "mt-8 border-t border-line pt-5" : "mt-8"}>
            {oauth && (
              <button
                type="button"
                onClick={() => setShowToken((s) => !s)}
                aria-expanded={showToken}
                className="flex w-full items-center justify-between text-[14px] text-muted hover:text-fg"
              >
                Use an access key instead
                <ChevronDown size={16} aria-hidden className={`transition-transform ${showToken ? "rotate-180" : ""}`} />
              </button>
            )}
            {showToken && (
              <form
                className="mt-4 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const t = token.trim();
                  if (!t) return;
                  storeToken(t, remember);
                  onToken(t);
                }}
              >
                <input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="github_pat_…"
                  aria-label="GitHub access key"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className={inputCls}
                />
                <label className="flex items-center gap-2.5 text-[14px]">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-[18px] w-[18px] accent-[var(--accent)]"
                  />
                  Keep me signed in on this device
                </label>
                <Button kind={oauth ? "secondary" : "primary"} type="submit" className="w-full" disabled={!token.trim()}>
                  Continue
                </Button>
                <p className="text-[12.5px] leading-relaxed text-muted">
                  Make one at{" "}
                  <a
                    className="text-accent underline-offset-2 hover:underline"
                    href="https://github.com/settings/personal-access-tokens/new"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    GitHub → Fine-grained tokens
                  </a>
                  : only the <b>{REPO.name}</b> repository, with <b>Contents: Read and write</b> and <b>Actions: Read</b>.
                  It stays in this browser only.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function GitHubMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
