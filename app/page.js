import fs from "fs";
import path from "path";
import { HeroCube } from "../components/hero-cube";

export const dynamic = 'force-dynamic';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Home() {
  const publicDir = path.join(process.cwd(), "public");
  const allFiles = fs.readdirSync(publicDir);
  const videoExt = /\.(mp4|webm|mov|avi|mkv)$/i;
  const imageExt = /\.(jpg|jpeg|png|gif|webp|avif|svg)$/i;
  const cubeImages = [
    ...shuffle(allFiles.filter(f => videoExt.test(f))).map(f => `/${f}`),
    ...shuffle(allFiles.filter(f => imageExt.test(f))).map(f => `/${f}`),
  ].slice(0, 6);
  return (
    <main>
      <HeroCube
        title="Mon Portfolio"
        subtitle="Créatif & Développeur"
        images={cubeImages}
      />
    </main>
  );
}
