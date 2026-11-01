"use client";

import { useEffect } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

function current(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function apply(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

export function ThemeToggle() {
  // Follow system changes until the visitor picks a theme themselves.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem("theme");
      } catch {}
      if (saved !== "light" && saved !== "dark") apply(e.matches ? "dark" : "light");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function toggle() {
    const next: Theme = current() === "dark" ? "light" : "dark";
    apply(next);
    try {
      localStorage.setItem("theme", next);
    } catch {}
  }

  // Both icons are rendered; CSS shows the right one, so there is no
  // hydration mismatch and no flicker.
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle light and dark theme"
      title="Toggle theme"
      className="-mr-1.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-fg"
    >
      <Moon size={15} strokeWidth={1.75} aria-hidden className="dark:hidden" />
      <Sun size={15} strokeWidth={1.75} aria-hidden className="hidden dark:block" />
    </button>
  );
}
