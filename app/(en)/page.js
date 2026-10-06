/**
 * Accueil en anglais, à la racine du site.
 *
 * L'anglais est la langue par défaut : il reste à `/` et non sous `/en`, parce que
 * le portfolio s'ouvre en anglais et qu'une redirection à chaque entrée sur le
 * domaine serait un saut inutile. Le français est passé sous `/fr` — voir
 * `lib/content/locales.js` pour la définition de la langue par défaut et
 * `lib/site-routes.js` pour le calcul des préfixes.
 *
 * `public/en.html` porte la redirection des anciennes URL `/en` vers la racine,
 * pour que les liens déjà diffusés — dont ceux du CV — continuent d'aboutir.
 *
 * Le composant partagé est dans `components/home-page.jsx` ; cette route ne fait
 * que choisir la langue.
 */

import { HomePage } from "../../components/home-page";

export default function EnglishHome() {
  return <HomePage lang="en" />;
}