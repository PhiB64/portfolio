/**
 * Page `/projects` en anglais.
 *
 * Les métadonnées viennent de la même fabrique que celles du layout, avec le
 * chemin de cette page. Il faut les redéclarer ici : sans cela la page
 * hériterait de la canonique de l'accueil, et se déclarerait canonique d'une
 * autre page — ce que les moteurs lisent comme une instruction de désindexer
 * l'URL réelle.
 */

import { ProjectsPage } from "../../../components/projects-page";
import { siteMetadata } from "../../../lib/site-metadata";

export const metadata = siteMetadata("en", "/projects");

export default function EnglishProjects() {
  return <ProjectsPage lang="en" />;
}