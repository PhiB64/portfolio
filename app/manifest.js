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
    // `standalone` plutôt que `fullscreen` : ce dernier masque toute la
    // chrome du navigateur, y compris la barre d'adresse, ce qui sur un
    // portfolio n'apporte rien et prive l'utilisateur du retour arrière.
    display: "standalone",
    // Volontairement `portrait` : l'application affiche un verrou « Tournez
    // votre appareil » sur mobile en paysage (hero-cube.jsx). Autoriser le
    // paysage en PWA mènerait à cet écran plein écran sur un écran large.
    orientation: "portrait",
    background_color: "#0a0f1c",
    theme_color: "#0a0f1c",
    icons: [
      { src: `${BASE}/icon.webp`, sizes: "512x512", type: "image/webp", purpose: "any" },
      { src: `${BASE}/favicon.webp`, sizes: "any", type: "image/webp" },
    ],
  };
}