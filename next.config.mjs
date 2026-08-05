/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  // basePath only applied during GitHub Pages build to avoid changing local dev URL.
  basePath: process.env.GITHUB_PAGES === "true" ? "/portfolio" : "",
  distDir: "dist",
  images: {
    unoptimized: true,
  },
  experimental: {
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
