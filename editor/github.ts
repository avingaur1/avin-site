/**
 * The few GitHub calls the editor needs.
 * Publishing writes every changed file (site.json + new photos) as ONE commit,
 * so the live site never sees half a change.
 */
import { API, IMAGES_DIR, REPO, SITE_JSON } from "./config";

export class GitHubError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const repoPath = `/repos/${REPO.owner}/${REPO.name}`;

async function gh<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      msg = (await res.json()).message || msg;
    } catch {}
    throw new GitHubError(res.status, msg);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

function decodeBase64Utf8(b64: string) {
  const bin = atob(b64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export async function getUser(token: string) {
  return gh<{ login: string; avatar_url: string; name: string | null }>(token, "/user");
}

export async function canPublish(token: string) {
  const r = await gh<{ permissions?: { push?: boolean } }>(token, repoPath);
  // GitHub itself refuses the commit if the key can't write, so a missing field isn't treated as "no".
  return r.permissions?.push !== false;
}

export async function getHead(token: string) {
  const ref = await gh<{ object: { sha: string } }>(token, `${repoPath}/git/ref/heads/${REPO.branch}`);
  return ref.object.sha;
}

/** site.json as it is at a given commit, with its blob sha (used to spot outside edits). */
export async function getSiteJson(token: string, ref: string) {
  const f = await gh<{ content: string; sha: string }>(
    token,
    `${repoPath}/contents/${SITE_JSON}?ref=${encodeURIComponent(ref)}`,
  );
  return { data: JSON.parse(decodeBase64Utf8(f.content)), sha: f.sha };
}

/** File names in public/images at a given commit. */
export async function listImages(token: string, ref: string): Promise<string[]> {
  try {
    const items = await gh<{ name: string; type: string }[]>(
      token,
      `${repoPath}/contents/${IMAGES_DIR}?ref=${encodeURIComponent(ref)}`,
    );
    return items
      .filter((i) => i.type === "file" && /\.(webp|jpe?g|png|gif|avif)$/i.test(i.name))
      .map((i) => i.name);
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) return [];
    throw e;
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export type PublishFile = { path: string; text: string } | { path: string; blob: Blob };

/**
 * Commit files on top of `parent` and move the branch to it.
 * Fails (without changing anything) if the branch moved since `parent`.
 */
export async function commitFiles(
  token: string,
  parent: string,
  files: PublishFile[],
  message: string,
  onStep?: (label: string) => void,
) {
  const base = await gh<{ tree: { sha: string } }>(token, `${repoPath}/git/commits/${parent}`);

  const tree: { path: string; mode: "100644"; type: "blob"; sha?: string; content?: string }[] = [];
  const photos = files.filter((f) => "blob" in f);
  let n = 0;
  for (const f of files) {
    if ("blob" in f) {
      n++;
      onStep?.(photos.length > 1 ? `Uploading photos (${n} of ${photos.length})` : "Uploading photo");
      const b = await gh<{ sha: string }>(token, `${repoPath}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({ content: await blobToBase64(f.blob), encoding: "base64" }),
      });
      tree.push({ path: f.path, mode: "100644", type: "blob", sha: b.sha });
    } else {
      tree.push({ path: f.path, mode: "100644", type: "blob", content: f.text });
    }
  }

  onStep?.("Saving to your site");
  const t = await gh<{ sha: string }>(token, `${repoPath}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: base.tree.sha, tree }),
  });
  const c = await gh<{ sha: string }>(token, `${repoPath}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message, tree: t.sha, parents: [parent] }),
  });
  await gh(token, `${repoPath}/git/refs/heads/${REPO.branch}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: c.sha, force: false }),
  });
  return c.sha;
}

export type DeployState =
  | { kind: "waiting" }
  | { kind: "building" }
  | { kind: "live" }
  | { kind: "failed"; url: string }
  | { kind: "unknown" };

/** Status of the GitHub Pages deploy started by a commit. */
export async function deployStatus(token: string, sha: string): Promise<DeployState> {
  try {
    const r = await gh<{
      workflow_runs: { status: string; conclusion: string | null; html_url: string; path?: string; name?: string }[];
    }>(token, `${repoPath}/actions/runs?head_sha=${sha}&per_page=10`);
    const run =
      r.workflow_runs.find((w) => (w.path || "").endsWith("deploy.yml") || /pages/i.test(w.name || "")) ??
      r.workflow_runs[0];
    if (!run) return { kind: "waiting" };
    if (run.status !== "completed") return { kind: "building" };
    return run.conclusion === "success" ? { kind: "live" } : { kind: "failed", url: run.html_url };
  } catch (e) {
    // The token may not be allowed to read Actions. Publishing still worked.
    if (e instanceof GitHubError && (e.status === 403 || e.status === 404)) return { kind: "unknown" };
    throw e;
  }
}
