/**
 * Publie le digest construit par `lib/chat-digest.js`.
 *
 * Ce script ne fait plus que l'écriture. Il appelait `buildDigest()` puis
 * journalisait **au chargement du module**, donc l'importer depuis un test
 * aurait créé `dist/content.json` et écrit sur la sortie standard. La
 * construction du digest — troncature, ordre des sections, exclusions
 * volontaires — est partie dans `lib/chat-digest.js`, où elle s'importe et se
 * teste. Voir ce module pour pourquoi le digest existe.
 *
 * Sortie : `dist/content.json` (un objet `{ "digest": "…" }`), écrit après
 * `next build` — voir le script `postbuild`.
 */

import { writeFile, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

import { buildDigest } from "../lib/chat-digest.js";

const DIST = path.resolve(import.meta.dirname, "..", "dist");
const OUT = path.join(DIST, "content.json");

const digest = buildDigest();

// `dist/` n'existe qu'après `next build`. En dev, ou si le build a échoué, on
// écrit à côté plutôt que de faire échouer le script : un digest absent doit
// dégrader le chat, pas casser la construction du site.
const target = existsSync(DIST) ? OUT : path.resolve(import.meta.dirname, "..", "content.json");

await mkdir(path.dirname(target), { recursive: true });
await writeFile(target, JSON.stringify({ digest }) + "\n", "utf8");

// Le fichier est relu pour rapporter sa taille *sur disque*. `digest.length`
// compte des caractères, et un accent en UTF-8 occupe plusieurs octets : les
// deux chiffres affichés n'ont pas la même unité, et le seul qui décrive ce que
// le navigateur va télécharger est le second.
const written = await readFile(target, "utf8");
console.log(
  `content.json : ${written.length} octets, ${digest.length} caractères de digest -> ${target}`
);