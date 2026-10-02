/**
 * Publie le contenu du portfolio sous forme de texte dense, destiné au system
 * prompt du Worker du chat.
 *
 * Pourquoi ne pas faire lire le site par le Worker : le site est un export
 * statique Next.js. Tout le texte vit dans les bundles JS, et le HTML servi ne
 * contient ni les projets ni les compétences — un Worker qui le lirait ne
 * trouverait rien à analyser. Ce script est donc le pont : il lit la même source
 * de vérité que l'interface (`lib/portfolio-content.js`) et en produit un digest
 * que `portfolio/content.json` expose publiquement.
 *
 * Le format est du texte, pas du JSON : un digest JSON imbriqué ferait exploser
 * le nombre de tokens pour rien, alors que le modèle comprend une liste à
 * puces bien mieux qu'une structure à lire.
 *
 * Sortie : `dist/content.json` (un objet `{ "digest": "…" }`), écrit après
 * `next build` — voir le script `postbuild`.
 */

import { writeFile, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

import { PROJECT_CONTENT, CAREER_CONTENT } from "../lib/portfolio-content.js";

const DIST = path.resolve(import.meta.dirname, "..", "dist");
const OUT = path.join(DIST, "content.json");

/**
 * Plafond de caractères sur le digest. Au-delà, le prompt devient coûteux à
 * chaque requête pour un gain marginal : les descriptions de projets font
 * chacune 200 à 400 caractères.
 * La troncature est signalée dans le texte pour ne pas faire croire au modèle
 * que la liste est exhaustive.
 *
 * Passé de 12 000 à 15 000 en ajoutant le parcours issu du CV : à 12 000 la
 * troncature mordait en plein milieu de la section « Méthode », et amputait
 * surtout les langues et le permis, qui se trouvent en fin de digest. Un digest
 * tronqué au milieu d'une liste est pire qu'un digest absent, parce qu'il donne
 * l'illusion d'être complet.
 *
 * Le coût reste marginal : 15 000 caractères font environ 3 750 tokens, contre
 * une allocation de 10 000 neurons par jour.
 */
const MAX_CHARS = 15000;

/**
 * Transforme une section de `PROJECT_CONTENT` en lignes de digest.
 *
 * Le format est volontairement « plat » : une ligne par projet, une ligne par
 * compétence. Les structures imbriquées de la source portent de l'information
 * utile à l'affichage (ordre, groupings) qui n'a pas de sens dans un prompt.
 *
 * @param {object} section
 * @returns {string[]}
 */
function sectionLines(section) {
  const lines = [`## ${section.label}`, section.title];

  for (const paragraph of section.presentation ?? []) lines.push(paragraph);

  for (const skill of section.skills ?? []) {
    lines.push(`- ${skill.title} : ${skill.desc}`);
  }

  if (section.features?.length) {
    lines.push(`Réalise : ${section.features.join(", ")}.`);
  }
  if (section.approach?.length) {
    lines.push(`Objectif : ${section.approach.join(", ")}.`);
  }
  if (section.philosophy) lines.push(`Philosophie : « ${section.philosophy} »`);

  if (section.profile) {
    lines.push(`CV : ${section.profile.cvUrl}`);
    for (const bio of section.profile.bio ?? []) lines.push(bio);
  }

  for (const project of section.projects ?? []) {
    lines.push(`- ${project.title} [${project.tags}] : ${project.desc} ${project.details}`);
    for (const link of project.links ?? []) lines.push(`  ${link.label} : ${link.href}`);
  }

  if (section.process?.length) {
    lines.push(`Méthode : ${section.process.join(" ; ")}.`);
  }

  return lines;
}

/**
 * Transforme `CAREER_CONTENT` en lignes de digest.
 *
 * Le parcours et le savoir-faire de gestion viennent du CV, pas du site : ces
 * informations n'ont pas de face de cube, mais ce sont les premières choses
 * qu'un visiteur demande. Elles sont publiées ici pour que l'assistant puisse
 * répondre à « d'où viens-tu ? » ou « comment es-tu arrivé au développement ? ».
 *
 * La reconversion est placée en tête, et non à la fin, parce qu'elle est la
 * réponse à la question la plus probable. Les formations viennent ensuite,
 * puis les compétences de management.
 *
 * @returns {string[]}
 */
function careerLines() {
  const c = CAREER_CONTENT;
  return [
    "## Parcours professionnel",
    c.reconversion,
    "",
    "Formations :",
    ...c.formation.map((line) => `- ${line}`),
    "",
    "Avant le développement :",
    ...c.avant.map((line) => `- ${line}`),
    "",
    "Compétences de management et de gestion (issues de la carrière précédente) :",
    ...c.management.map((line) => `- ${line}`),
    "",
    "Méthode :",
    ...c.method.map((line) => `- ${line}`),
    "",
    `Langues : ${c.langues}`,
    `Soft skills : ${c.soft}`,
    c.permis,
  ];
}

/**
 * Construit le digest complet.
 *
 * @returns {string}
 */
function buildDigest() {
  const header = [
    "# Contenu du site portfolio",
    "",
    "Source de vérité du site, publiée automatiquement à chaque déploiement.",
    "Ces informations décrivent Philippe et ses réalisations : elles lui appartiennent,",
    "elles ne te concernent pas. Sers-t'en pour répondre précisément, en citant le",
    "nom du projet et son lien quand la question porte sur une réalisation.",
  ];

  const body = [...PROJECT_CONTENT.flatMap(sectionLines), ...careerLines()];
  const digest = [...header, "", ...body].join("\n");

  if (digest.length <= MAX_CHARS) return digest;

  // Coupe sur une fin de ligne pour ne pas laisser un projet tronqué au milieu
  // d'une phrase, et on le dit : un digest partiel vaut mieux qu'un digest muet.
  const cut = digest.slice(0, MAX_CHARS);
  const lastBreak = cut.lastIndexOf("\n");
  const kept = lastBreak > 0 ? cut.slice(0, lastBreak) : cut;
  return `${kept}\n\n[Contenu tronqué : la suite dépasse le plafond de ${MAX_CHARS} caractères.]`;
}

const digest = buildDigest();

// `dist/` n'existe qu'après `next build`. En dev, ou si le build a échoué, on
// écrit à côté plutôt que de faire échouer le script : un digest absent doit
// dégrader le chat, pas casser la construction du site.
const target = existsSync(DIST) ? OUT : path.resolve(import.meta.dirname, "..", "content.json");

await mkdir(path.dirname(target), { recursive: true });
await writeFile(target, JSON.stringify({ digest }) + "\n", "utf8");

const written = await readFile(target, "utf8");
console.log(
  `content.json : ${written.length} octets, ${digest.length} caractères de digest -> ${target}`
);
