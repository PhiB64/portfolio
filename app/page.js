import { HeroCube } from "../components/hero-cube";

// Stable reference: avoids re-running the animation useEffect on every re-render.
const HERO_IMAGES = [];

export default function Home() {
  return (
    <main>
      <HeroCube
        title="Mon Portfolio"
        subtitle="Créatif & Développeur"
        images={HERO_IMAGES}
      />
    </main>
  );
}
