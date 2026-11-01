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
          {/* The full domain needs ~390px of width beside the links; narrower phones keep the short mark. */}
          <span className="min-[390px]:hidden">avin.</span>
          <span className="hidden text-[14px] min-[390px]:inline sm:text-[15px]">avingaur.com</span>
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
