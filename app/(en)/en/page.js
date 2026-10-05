/**
 * Accueil en anglais, sous `/en`.
 *
 * Le segment `/en` est réel, donc il apparaît dans l'URL : c'est ce qui rend la
 * page indexable et partageable, là où un `?lang=en` ne l'aurait pas été. Le
 * groupe `(en)` qui l'enveloppe, lui, ne produit rien dans le chemin.
 */

import { HomePage } from "../../../components/home-page";

export default function EnglishHome() {
  return <HomePage lang="en" />;
}