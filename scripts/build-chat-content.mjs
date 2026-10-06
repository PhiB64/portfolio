/**
 * Publie les digests construits par `lib/chat-digest.js`, un par langue.
 *
 * Ce script ne fait plus que l'écriture. Il appelait `buildDigest()` puis
 * journalisait **au chargement du module**, donc l'importer depuis un test
 * aurait créé `dist/content.json` et écrit sur la sortie standard. La
 * construction du digest — troncature, ordre des sections, exclusions
 * volontaires — est partie dans `lib/chat-digest.js`, où elle s'importe et se
 * teste. Voir ce module pour pourquoi le digest existe.
 *
 * Sortie : `dist/content.json`, écrit après `next build` — voir le script
 * `postbuild`.
 *
 * Deux clés, et pourquoi. `digests` porte une entrée par langue et porte la
 * logique. `digest` reste le digest de la langue par défaut, pour deux raisons
 * qui sont la même : le Worker déjà déployé ne lit que cette clé, et continuer à
 * la publier lui permet de fonctionner contre un site déployé avant lui. Un
 * site et un Worker sont déployés séparément — le Worker à la main, le site à
 * chaque push — et la période entre les deux est réelle. `digest` et
 * `digests[DEFAULT_LOCALE]` sont donc volontairement redondants : le redondant
 * est le cas de repli, celui où un ancien lecteur et un nouveau rédacteur
 * doivent s'entendre.
 *
 * `DEFAULT_LOCALE` doit rester la même constante que `WORKER_DEFAULT_LANG` dans
 * `worker/src/index.js` : c'est la condition sous laquelle le Worker lit cette
 * clé. Diverger entre les deux ne casse rien tout de suite, mais désactive le
 * chemin de repli sans lever la moindre erreur.
 */

import { writeFile, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

import { buildDigest } from "../lib/chat-digest.js";
import { getContent, DEFAULT_LOCALE, SUPPORTED_LOCALES } from "../lib/content/index.js";

const DIST = path.resolve(import.meta.dirname, "..", "dist");
const OUT = path.join(DIST, "content.json");

/**
 * Les sources d'une langue, prises du même point d'entrée que l'interface.
 *
 * Passé par `getContent` plutôt que par un import de `fr.js` / `en.js` : c'est
 * le même objet que celui que rendent les pages, donc le digest ne peut pas
 * diverger de ce que le visiteur lit. Une langue déclarée dans
 * `SUPPORTED_LOCALES` mais absente du contenu produirait un digest vide, et le
 * test de parité le voit avant le build.
 */
function sourcesFor(lang) {
  const { CAREER_CONTENT, USAGE_CONTENT, STACK_CONTENT, PROJECT_CONTENT } =
    getContent(lang);
  return {
    career: CAREER_CONTENT,
    usage: USAGE_CONTENT,
    stack: STACK_CONTENT,
    projects: PROJECT_CONTENT,
  };
}

const digests = {};
for (const lang of SUPPORTED_LOCALES) {
  digests[lang] = buildDigest({ lang, sources: sourcesFor(lang) });
}

const payload = {
  digest: digests[DEFAULT_LOCALE],
  digests,
};

// `dist/` n'existe qu'après `next build`. En dev, ou si le build a échoué, on
// écrit à côté plutôt que de faire échouer le script : un digest absent doit
// dégrader le chat, pas casser la construction du site.
const target = existsSync(DIST) ? OUT : path.resolve(import.meta.dirname, "..", "content.json");

await mkdir(path.dirname(target), { recursive: true });
await writeFile(target, JSON.stringify(payload) + "\n", "utf8");

// Le fichier est relu pour rapporter sa taille *sur disque*. `payload.length`
// compterait des caractères, et un accent en UTF-8 occupe plusieurs octets : les
// deux chiffres affichés n'ont pas la même unité, et le seul qui décrive ce que
// le navigateur va télécharger est le second. Le nombre de caractères de digest
// est journalisé à part : c'est lui qui renseigne sur le coût du prompt.
const written = await readFile(target, "utf8");
const total = Object.values(digests).reduce((sum, d) => sum + d.length, 0);
const perLang = SUPPORTED_LOCALES.map((l) => `${l} ${digests[l].length}`).join(", ");
console.log(
  `content.json : ${written.length} octets, ${total} caractères de digest (${perLang}) -> ${target}`
);