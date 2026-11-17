/** Address of the Spotify "now playing" Worker (spotify-now-playing/worker.js), set at build time. */
export const NOW_PLAYING_URL = (process.env.NEXT_PUBLIC_SPOTIFY_NOW_PLAYING_URL || "").replace(/\/$/, "");
