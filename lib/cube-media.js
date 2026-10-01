// Source unique des médias des six faces du cube, dans l'ordre de
// `FACE_LABELS` (lib/cube-math.js) : [WEB, REACT, BACKEND, DATABASE, MOBILE,
// PROJETS].
//
// Elle était dupliquée à l'identique dans `app/page.js` (HERO_IMAGES) et dans
// `components/hero-cube.jsx` (DEFAULT_FACE_MEDIA) — deux listes à tenir à jour,
// où la page d'accueil servait la première et le cube retombait sur la seconde.
// Le module est volontairement sans "use client" : il est importé des deux
// côtés, et une simple constante ne peut pas devenir une référence client
// lorsqu'un composant serveur la reçoit en prop.
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const FACE_MEDIA = [
  `${BASE}/web.webm`,
  `${BASE}/react.webp`,
  `${BASE}/backend.webm`,
  `${BASE}/database.webp`,
  `${BASE}/mobile.webm`,
  `${BASE}/projets.webp`,
];

export default FACE_MEDIA;

// Largeurs (px) des variantes générées pour chaque image de face, dans
// `public/`. La gamme couvre la face au repos (≈ 343 px rendus, 300 × 8/7 de
// projection perspective) jusqu'au plein écran : les vidéos n'en ont pas besoin,
// `srcset` ne s'applique qu'aux .webp.
//
// Le nom de fichier est dérivé : `react.webp` → `react-768.webp`. La variante
// d'origine reste la dernière entrée du `srcset`, comme repli pour le plein
// écran — le zoom étant un `transform: scale` du parent, l'image ne quitte jamais
// sa boîte 300×300 et le recadrage `object-cover` est identique au repos et en zoom.
const VARIANT_WIDTHS = [480, 768, 1152];

// Renvoie l'attribut `srcset` d'une image de face, ou `undefined` pour les
// vidéos et les médias qui n'ont pas de variantes (pas de requête inutile).
export function faceSrcSet(url) {
  if (!url || typeof url !== "string") return undefined;
  const dot = url.lastIndexOf(".");
  const slash = url.lastIndexOf("/");
  if (dot < 0 || dot < slash) return undefined;
  if (!url.slice(dot).toLowerCase().endsWith(".webp")) return undefined;

  const stem = url.slice(0, dot);
  const candidates = VARIANT_WIDTHS.map((w) => `${stem}-${w}.webp ${w}w`);
  candidates.push(`${url} 9999w`); // l'originale, en dernier
  return candidates.join(", ");
}
