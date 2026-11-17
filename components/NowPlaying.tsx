"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Music2 } from "lucide-react";
import { NOW_PLAYING_URL } from "@/lib/nowPlaying";

/**
 * Live "Now playing" card for the Music row in Beyond the Resume.
 *
 * The site is static, so the card asks a small Cloudflare Worker (spotify-now-playing/worker.js)
 * what's playing. The Worker holds the Spotify keys; nothing secret is in this file.
 * Display only: it shows the current track, or the last one played, and links to it on Spotify.
 *
 * Hidden entirely until NEXT_PUBLIC_SPOTIFY_NOW_PLAYING_URL is set, so the page looks exactly
 * as before while setup isn't finished.
 */

const ENDPOINT = NOW_PLAYING_URL;
const POLL_PLAYING_MS = 30_000;
const POLL_IDLE_MS = 60_000;
const TIMEOUT_MS = 8_000;

type Track = {
  id: string;
  name: string;
  artists: string[];
  album?: string;
  albumArt: string | null;
  url: string | null;
  /** ISO time the song was last played (only for "last played"). */
  playedAt?: string | null;
};

type State =
  | { status: "loading" }
  | { status: "idle" }
  | { status: "playing"; track: Track }
  | { status: "recent"; track: Track };

function cleanTrack(t: Partial<Track> | undefined): Track | null {
  // Only trust what the card needs, in the shape it expects.
  if (!t || typeof t.name !== "string") return null;
  const url = typeof t.url === "string" && t.url.startsWith("https://open.spotify.com/") ? t.url : null;
  const art = typeof t.albumArt === "string" && t.albumArt.startsWith("https://") ? t.albumArt : null;
  return {
    id: String(t.id || t.name),
    name: t.name,
    artists: Array.isArray(t.artists) ? t.artists.filter((a) => typeof a === "string") : [],
    album: typeof t.album === "string" ? t.album : "",
    albumArt: art,
    url,
    playedAt: typeof t.playedAt === "string" ? t.playedAt : null,
  };
}

function clean(data: unknown): State {
  const d = data as { isPlaying?: boolean; track?: Partial<Track>; lastPlayed?: Partial<Track> } | null;
  const playing = d?.isPlaying ? cleanTrack(d.track) : null;
  if (playing) return { status: "playing", track: playing };
  const recent = cleanTrack(d?.lastPlayed);
  return recent ? { status: "recent", track: recent } : { status: "idle" };
}

/** "just now", "5 minutes ago", "3 hours ago", "2 days ago". */
function ago(iso?: string | null): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "just now";
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (s < 3600) return rtf.format(-Math.round(s / 60), "minute");
  if (s < 86400) return rtf.format(-Math.round(s / 3600), "hour");
  return rtf.format(-Math.round(s / 86400), "day");
}

export function NowPlaying({ playlistHref }: { playlistHref?: string }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const failures = useRef(0);

  useEffect(() => {
    if (!ENDPOINT) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let stopped = false;

    const schedule = (ms: number) => {
      clearTimeout(timer);
      if (!stopped && document.visibilityState === "visible") timer = setTimeout(load, ms);
    };

    async function load() {
      controller?.abort();
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), TIMEOUT_MS);
      let next: State | null = null;
      try {
        const res = await fetch(`${ENDPOINT}/now-playing`, { signal: controller.signal, cache: "no-store" });
        // 503 still carries a body that says "not playing", which is the right thing to show.
        next = clean(await res.json());
        failures.current = 0;
      } catch {
        // Network hiccup or offline: keep what's on screen once, then fall back to "not listening".
        failures.current += 1;
        if (failures.current >= 2) next = { status: "idle" };
        else setState((s) => (s.status === "loading" ? { status: "idle" } : s));
      } finally {
        clearTimeout(timeout);
      }
      if (stopped) return;
      if (next) setState(next);
      schedule(next?.status === "playing" ? POLL_PLAYING_MS : POLL_IDLE_MS);
    }

    // Don't poll in background tabs; catch up as soon as the tab is visible again.
    const onVisibility = () => {
      if (document.visibilityState === "visible") load();
      else clearTimeout(timer);
    };
    const onOnline = () => load();

    load();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  if (!ENDPOINT) return null;

  if (state.status === "playing" || state.status === "recent") {
    const { track } = state;
    const playing = state.status === "playing";
    const artists = track.artists.join(", ");
    const href = track.url || playlistHref;
    const when = playing ? "" : ago(track.playedAt);
    const prefix = playing ? "Now playing on Spotify" : `Last played on Spotify${when ? `, ${when}` : ""}`;
    return (
      <CardShell href={href} label={`${prefix}: ${track.name}${artists ? ` by ${artists}` : ""}`}>
        {/* Keyed by track, so a new song fades in gently instead of snapping. */}
        <div key={track.id} className="np-in flex min-w-0 flex-1 items-center gap-3.5">
          <Art src={track.albumArt} alt={track.album ? `Album art for ${track.album}` : ""} />
          <div className="min-w-0 flex-1">
            <Label kind={playing ? "playing" : "recent"} when={when} />
            <p className="truncate text-[14px] font-medium leading-[1.45] text-fg" title={track.name}>
              {track.name}
            </p>
            {artists && (
              <p className="truncate text-[13px] leading-[1.45] text-muted" title={artists}>
                {artists}
              </p>
            )}
          </div>
        </div>
      </CardShell>
    );
  }

  if (state.status === "idle") {
    return (
      <CardShell href={playlistHref} label="Not listening right now. Open my Spotify playlist">
        <div className="np-in flex min-w-0 flex-1 items-center gap-3.5">
          <Art src={null} alt="" />
          <div className="min-w-0 flex-1">
            <Label />
            <p className="truncate text-[14px] font-medium leading-[1.45] text-fg">Not listening right now</p>
            <p className="truncate text-[13px] leading-[1.45] text-muted">My playlist on Spotify</p>
          </div>
        </div>
      </CardShell>
    );
  }

  // Loading: same size as the real card, so nothing below it moves when the answer arrives.
  return (
    <CardShell label="Checking Spotify">
      <div className="flex min-w-0 flex-1 items-center gap-3.5" aria-hidden>
        <Art src={null} alt="" />
        <div className="min-w-0 flex-1">
          <Label />
          <div className="flex h-[20px] items-center">
            <div className="h-[11px] w-32 max-w-full rounded-[3px] bg-placeholder" />
          </div>
          <div className="flex h-[19px] items-center">
            <div className="h-[10px] w-20 max-w-full rounded-[3px] bg-placeholder" />
          </div>
        </div>
      </div>
    </CardShell>
  );
}

function CardShell({ href, label, children }: { href?: string; label: string; children: React.ReactNode }) {
  const cls =
    "group flex w-full min-w-0 items-center gap-3 rounded-[10px] border border-line p-2 pr-4 text-left";
  if (!href) {
    return (
      <div className={cls} role="status" aria-label={label}>
        {children}
      </div>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label} (opens in a new tab)`}
      className={`${cls} hover:border-muted/40`}
    >
      {children}
      <ArrowUpRight
        size={15}
        strokeWidth={1.75}
        aria-hidden
        className="ml-auto shrink-0 text-muted transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent"
      />
    </a>
  );
}

function Label({ kind = "plain", when = "" }: { kind?: "playing" | "recent" | "plain"; when?: string }) {
  const text = kind === "playing" ? "Now playing" : kind === "recent" ? "Last played" : "Spotify";
  const extra = kind === "playing" ? "Spotify" : kind === "recent" ? when : "";
  return (
    <p className="flex min-w-0 items-center gap-1.5 text-[10.5px] font-medium uppercase leading-[1.5] tracking-[0.08em] text-muted">
      <span
        aria-hidden
        className={`inline-block h-[6px] w-[6px] shrink-0 rounded-full ${kind === "playing" ? "np-dot bg-spotify" : "bg-line"}`}
      />
      <span className="shrink-0">{text}</span>
      {extra && <span className="truncate font-normal normal-case tracking-normal opacity-70">· {extra}</span>}
    </p>
  );
}

function Art({ src, alt }: { src: string | null; alt: string }) {
  const [broken, setBroken] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const show = src && !broken;
  return (
    <div className="relative h-[60px] w-[60px] shrink-0 overflow-hidden rounded-[6px] bg-placeholder">
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          width={60}
          height={60}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => setBroken(true)}
          className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted/70">
          <Music2 size={20} strokeWidth={1.5} aria-hidden />
        </div>
      )}
    </div>
  );
}
