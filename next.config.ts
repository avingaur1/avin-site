import type { NextConfig } from "next";

/**
 * Static export for GitHub Pages.
 * The deploy workflow sets NEXT_PUBLIC_BASE_PATH automatically:
 * "/<repo-name>" on username.github.io/<repo-name>, and "" once a custom domain is set.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
