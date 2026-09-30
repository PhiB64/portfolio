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
