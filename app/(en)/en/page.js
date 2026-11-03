/**
 * Accueil en anglais, sous `/en`.
 *
 * L'anglais n'est plus la langue par défaut : il est préfixé par son code,
 * comme toute langue qui ne sert pas à la racine. `app/(en)/en/page.js` produit
 * donc l'URL `/en`, le segment `/en` étant réel — c'est ce qui rend la page
 * indexable et partageable.
 *
 * Le composant partagé est dans `components/home-page.jsx` ; cette route ne fait
 * que choisir la langue.
 */

import { HomePage } from "../../../components/home-page";

export default function EnglishHome() {
  return <HomePage lang="en" />;
}