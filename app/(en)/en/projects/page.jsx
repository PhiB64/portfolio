/**
 * Page `/en/projects` — le pendant anglais de `/projects`.
 *
 * Elle appelle le même composant que la version française : le contenu des six
 * rubriques existe déjà dans `lib/content/en.js`, et le réécrire ici garantirait
 * que les deux pages divergeraient dès la prochaine modification.
 */

import { ProjectsPage } from "../../../../components/projects-page";
import { siteMetadata } from "../../../../lib/site-metadata";

export const metadata = siteMetadata("en", "/projects");

export default function EnglishProjects() {
  return <ProjectsPage lang="en" />;
}