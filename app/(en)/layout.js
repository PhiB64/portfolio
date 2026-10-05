/**
 * Layout racine de l'anglais.
 *
 * Le pendant exact de `app/(fr)/layout.js`. Tout ce qu'il exporte passe par la
 * même fabrique `siteMetadata` et le même `SiteShell` : deux layouts qui
 * construiraient leurs métadonnées séparément finiraient par diverger, et c'est
 * le défaut invisible par excellence — la page anglaise garderait la canonique
 * française ou un `og:locale` de `fr_FR` sans qu'aucun test ne le voie.
 *
 * Ce fichier ne contient donc volontairement que le nom de la langue. Toute la
 * différence est dans `components/site-shell.jsx` et `lib/site-metadata.js`.
 */

import "../globals.css";
import { SiteShell } from "../../components/site-shell";
import { siteMetadata, siteViewport } from "../../lib/site-metadata";

export const metadata = siteMetadata("en", "/");

export const viewport = siteViewport;

export default function EnglishLayout({ children }) {
  return <SiteShell lang="en">{children}</SiteShell>;
}