/**
 * Layout racine du français.
 *
 * Pourquoi un layout racine par langue. `<html lang>` est un attribut du
 * document : il ne peut pas être posé plus bas, et il ne peut pas changer sans
 * que le document entier change. Un seul layout racine aurait donc une seule
 * balise `<html>`, une seule langue — figée à « fr » pour `/en` compris.
 *
 * Next.js permet d'avoir plusieurs layouts racines en segmentation le `app/` en
 * groupes de routes. `app/layout.js` disparaît alors au profit de ce fichier et
 * de `app/(en)/layout.js`, tous deux rendus par `components/site-shell.jsx`.
 *
 * Pourquoi le groupe s'appelle `(fr)` alors que le français est à la racine.
 * Le nom du groupe n'apparaît jamais dans l'URL : c'est ce qui permet d'avoir
 * `/` en français et `/en` en anglais sans que l'arborescence n'impose l'un ou
 * l'autre. Le segment réel `/en` vit à l'intérieur du groupe anglais.
 *
 * Ce que ce layout exporte : les métadonnées de l'accueil, complétées ou
 * remplacées par celles de chaque page. La page `/projects` y ajoute les siennes
 * via `siteMetadata("fr", "/projects")`.
 */

import "../globals.css";
import { SiteShell } from "../../components/site-shell";
import { siteMetadata, siteViewport } from "../../lib/site-metadata";

export const metadata = siteMetadata("fr", "/");

export const viewport = siteViewport;

export default function FrenchLayout({ children }) {
  return <SiteShell lang="fr">{children}</SiteShell>;
}