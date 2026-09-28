/** @type {import('next').NextConfig} */
const BASE = process.env.GITHUB_PAGES === "true" ? "/portfolio" : "";

const nextConfig = {
  output: "export",
  // basePath only applied during GitHub Pages build to avoid changing local dev URL.
  basePath: BASE,
  env: { NEXT_PUBLIC_BASE_PATH: BASE },
  // The production export goes to `dist/` (the CI uploads it). Dev mode keeps
  // Next's default `.next/dev` so `next build` never wipes a running dev server.
  distDir: process.env.NODE_ENV === "production" ? "dist" : ".next",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;