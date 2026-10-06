/**
 * Accueil en français, sous `/fr`.
 *
 * Le français n'est plus la langue par défaut : il est préfixé par son code,
 * comme toute langue qui ne sert pas à la racine. `app/(fr)/fr/page.js` produit
 * donc l'URL `/fr`, le segment `/fr` étant réel — c'est ce qui rend la page
 * indexable et partageable.
 *
 * Le groupe `(fr)` qui enveloppe ce fichier ne produit rien dans le chemin :
 * c'est lui qui permet d'avoir `/` en anglais et `/fr` en français sans que
 * l'arborescence n'impose l'un ou l'autre.
 */

import { HomePage } from "../../../components/home-page";

export default function FrenchHome() {
  return <HomePage lang="fr" />;
}