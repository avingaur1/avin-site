/**
 * Editor settings. Nothing in here is secret.
 * The GitHub sign-in secret lives only in the Cloudflare Worker (see admin-auth/).
 */
import data from "@/content/site.json";

export const REPO = {
  owner: "avingaur1",
  name: "avin-site",
  branch: "main",
};

/** The only GitHub account allowed to publish. */
export const ALLOWED_USER = "avingaur1";

/** Where the site's data and photos live inside the repo. */
export const SITE_JSON = "content/site.json";
export const IMAGES_DIR = "public/images";
/** How pages refer to photos (public/images/x.webp → /images/x.webp). */
export const PUBLIC_IMAGES = "/images";

/**
 * Address of the sign-in helper (Cloudflare Worker).
 * Set once as a repository variable called ADMIN_AUTH_URL; the deploy workflow passes it in.
 * While empty, the editor offers access-token sign-in only.
 */
export const AUTH_URL = (process.env.NEXT_PUBLIC_ADMIN_AUTH_URL || "").replace(/\/$/, "");

/** Only overridden for local testing against a stand-in GitHub. */
export const API = (process.env.NEXT_PUBLIC_ADMIN_API_URL || "https://api.github.com").replace(/\/$/, "");
export const RAW =
  (process.env.NEXT_PUBLIC_ADMIN_RAW_URL || `https://raw.githubusercontent.com/${REPO.owner}/${REPO.name}`).replace(
    /\/$/,
    "",
  );

export const LIVE_URL = ((data as { url?: string }).url || "https://avingaur1.github.io/avin-site").replace(/\/$/, "");
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** Photo optimisation: longest side and WebP quality. */
export const IMAGE_MAX_EDGE = 2000;
export const IMAGE_QUALITY = 0.82;
