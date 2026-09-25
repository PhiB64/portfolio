export const dynamic = "force-static";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function manifest() {
  return {
    name: "Philippe Barbosa — Concepteur Développeur",
    short_name: "Portfolio",
    description:
      "Portfolio de Philippe Barbosa, concepteur développeur full stack (React, Next.js, Node.js, TypeScript).",
    start_url: `${BASE}/`,
    scope: `${BASE}/`,
    display: "fullscreen",
    orientation: "portrait",
    background_color: "#0a0f1c",
    theme_color: "#0a0f1c",
    icons: [
      { src: `${BASE}/icon.webp`, sizes: "512x512", type: "image/webp", purpose: "any" },
      { src: `${BASE}/favicon.webp`, sizes: "any", type: "image/webp" },
    ],
  };
}