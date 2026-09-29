import { HeroCube } from "../components/hero-cube";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const HERO_IMAGES = [
  `${BASE}/web.webm`,
  `${BASE}/react.webp`,
  `${BASE}/backend.webm`,
  `${BASE}/database.webp`,
  `${BASE}/mobile.webm`,
  `${BASE}/projets.webp`,
];

export default function Home() {
  return (
    <main>
      <HeroCube
        title="Philippe Barbosa"
        subtitle="Concepteur Développeur"
        images={HERO_IMAGES}
      />
    </main>
  );
}
