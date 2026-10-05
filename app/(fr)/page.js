/**
 * Accueil en français, à la racine du site.
 *
 * Le français est la langue d'origine : il reste à `/` et non sous `/fr`. Toutes
 * les URL déjà partagées, indexées et présentes dans le CV pointent ici, et
 * changer cela les aurait cassées. Voir `lib/site-routes.js`.
 *
 * Le composant partagé est dans `components/home-page.jsx` ; cette route ne fait
 * que choisir la langue.
 */

import { HomePage } from "../../components/home-page";

export default function FrenchHome() {
  return <HomePage lang="fr" />;
}