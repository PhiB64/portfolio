/** @type {import('next').NextConfig} */
const BASE = process.env.GITHUB_PAGES === "true" ? "/portfolio" : "";

const nextConfig = {
  output: "export",
  // basePath only applied during GitHub Pages build to avoid changing local dev URL.
  basePath: BASE,
  env: { NEXT_PUBLIC_BASE_PATH: BASE },
  distDir: "dist",
  images: {
    unoptimized: true,
  },
  experimental: {
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
