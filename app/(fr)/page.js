/**
 * Accueil en français, à la racine du site.
 *
 * Le français est la langue par défaut : il reste à `/` et non sous `/fr`, parce
 * que le portfolio s'ouvre en français. L'anglais est passé sous `/en` — voir
 * `lib/content/locales.js` pour la définition de la langue par défaut et
 * `lib/site-routes.js` pour le calcul des préfixes.
 *
 * Le groupe `(fr)` qui enveloppe ce fichier ne produit rien dans le chemin :
 * c'est lui qui permet d'avoir `/` en français et `/en` en anglais sans que
 * l'arborescence n'impose l'un ou l'autre.
 */

import { HomePage } from "../../components/home-page";

export default function FrenchHome() {
  return <HomePage lang="fr" />;
}