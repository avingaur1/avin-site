import Link from "next/link";
import { site } from "@/content/site";
import { ThemeToggle } from "./ThemeToggle";

export function Nav({ home = true }: { home?: boolean }) {
  return (
    <header className="theme-fade sticky top-0 z-40 bg-bg">
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-[780px] items-center justify-between gap-3 px-5 md:px-6"
      >
        <Link
          href={home ? "#top" : "/"}
          className="text-[15px] font-semibold tracking-tight text-fg hover:text-accent"
        >
          avin.
        </Link>
        <div className="flex items-center gap-2 text-[13px] min-[360px]:gap-4 sm:gap-6 sm:text-[14px]">
          <ul className="flex items-center gap-2.5 min-[360px]:gap-4 sm:gap-6">
            {site.nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={home ? item.href : `/${item.href}`}
                  className="text-muted hover:text-fg"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
