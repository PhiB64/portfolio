/**
 * Construction du digest de contenu du portfolio, destiné au system prompt du
 * Worker du chat.
 *
 * Ce module ne fait qu'une chose : transformer la source éditoriale
 * (`lib/portfolio-content.js`) en texte dense. L'écriture du fichier est à la
 * charge de `scripts/build-chat-content.mjs`.
 *
 * La séparation n'est pas cosmétique : le script appelait `buildDigest()` puis
 * écrivait et journalisait **au chargement du module**, donc l'importer depuis
 * un test aurait créé `dist/content.json` et écrit sur la sortie standard. Une
 * fonction sans effet de bord s'importe et se teste ; un script qui écrit ne
 * s'importe pas. Les règles ci-dessous — troncature, ordre des sections,
 * exclusions volontaires — sont précisément celles qu'un test doit pouvoir
 * vérifier sans lancer de build.
 *
 * Pourquoi un digest et pas une lecture du site : le site est un export
 * statique Next.js. Tout le texte vit dans les bundles JS, et le HTML servi ne
 * contient ni les projets ni les compétences — un Worker qui le lirait ne
 * trouverait rien à analyser. Le digest est donc le pont : même source de vérité
 * que l'interface, sortie texte.
 *
 * Le format est du texte, pas du JSON : un digest JSON imbriqué ferait exploser
 * le nombre de tokens pour rien, alors que le modèle comprend une liste à
 * puces bien mieux qu'une structure à lire.
 */

import {
  CAREER_CONTENT,
  PROJECT_CONTENT,
  STACK_CONTENT,
  USAGE_CONTENT,
} from "./portfolio-content.js";

/**
 * Plafond de caractères sur le digest. Au-delà, le prompt devient coûteux à
 * chaque requête pour un gain marginal : les descriptions de projets font
 * chacune 200 à 400 caractères.
 *
 * Passé de 12 000 à 15 000 en ajoutant le parcours issu du CV : à 12 000 la
 * troncature mordait en plein milieu de la section « Méthode », et amputait
 * surtout les langues et le permis, qui se trouvent en fin de digest. Un digest
 * tronqué au milieu d'une liste est pire qu'un digest absent, parce qu'il donne
 * l'illusion d'être complet.
 *
 * Passé de 15 000 à 16 000 en ajoutant la construction du site : la section tient
 * dans les 373 caractères qui restaient, et pas davantage. Le plafond n'a pas à
 * être au-dessus de la longueur réelle du digest, seulement assez grand pour que
 * celui-ci ne soit pas tronqué — le remonter plus que nécessaire coûterait des
 * tokens sans rien apprendre au modèle.
 *
 * Le coût reste marginal : 16 000 caractères font environ 4 000 tokens par
 * requête.
 *
 * La troncature, si elle mord, est signalée dans le texte : le modèle ne doit
 * pas croire que la liste est exhaustive.
 */
export const MAX_CHARS = 16000;

/**
 * Préambule du digest.
 *
 * Il pose trois choses avant le contenu : de quoi il s'agit, qui est décrit, et
 * que ces informations appartiennent à Philippe et non au modèle. C'est la
 * première ligne du prompt que le Worker reconstruit, donc la seule occasion de
 * le dire avant que le contenu commence.
 */
const HEADER = {
  fr: [
    "# Contenu du site portfolio",
    "",
    "Source de vérité du site, publiée automatiquement à chaque déploiement.",
    "Ces informations décrivent Philippe et ses réalisations : elles lui appartiennent,",
    "elles ne te concernent pas. Sers-t'en pour répondre précisément, en citant le",
    "nom du projet et son lien quand la question porte sur une réalisation.",
  ],
  en: [
    "# Portfolio site content",
    "",
    "Source of truth for the site, published automatically on every deployment.",
    "This information describes Philippe and his work: it belongs to him, it is not",
    "about you. Use it to answer precisely, quoting the project name and its link",
    "when the question is about something he built.",
  ],
};

/**
 * Périmètre des rubriques de compétences.
 *
 * La portée est annoncée ici, à la frontière des rubriques, et pas seulement
 * dans la section « Construction du site ». Une règle posée à 19 % du digest ne
 * tient pas jusqu'au bas : le modèle avait bien lu « Framer Motion n'est pas
 * dans ce site », puis rencontra 45 lignes plus loin « J'utilise React 19 et
 * Next.js 15 ... associés à des outils d'animation avancés (GSAP, Framer Motion)
 * et de navigation fluide (Lenis) » — à la première personne, sans périmètre,
 * dans la rubrique qui répondait le plus précisément à la question posée. La
 * formulation suivante, plus proche, l'a emportée, et la réponse a fusionné les
 * deux sections : GSAP cité trois fois, Framer Motion et Lenis annoncés pour ce
 * site.
 *
 * La règle est donc répétée là où les technologies sont citées, pas seulement là
 * où elles servent à répondre. La seconde phrase lève l'ambiguïté de la dernière
 * rubrique : elle nomme ses technologies projet par projet, et ses crochets font
 * déjà ce travail.
 */
const SCOPE = {
  fr: [
    "Les rubriques de compétences qui suivent couvrent tous ses projets : une technologie",
    "citée là n'est pas forcément dans ce site. La dernière rubrique la nomme projet par projet.",
  ],
  en: [
    "The skills sections that follow cover all of his projects: a technology mentioned",
    "there is not necessarily used on this site. The last section names them project by project.",
  ],
};

/**
 * Étiquettes structurelles du digest, par langue.
 *
 * Elles sont distinctes du contenu éditorial, et suivent le même découpage que
 * `lib/content/ui.js` : `fr.js` et `en.js` portent ce que Philippe a écrit, ceci
 * porte ce que le digest construit autour. Les mélanger aurait mis du français
 * dans le digest anglais — un digest lu pour un visiteur anglophone, avec des
 * titres « ## Parcours professionnel » et des libellés « Méthode : » au-dessus
 * d'un contenu anglais. Le modèle aurait alors cité un intitulé français dans sa
 * réponse anglaise, ou posé sa question de clarification dans la mauvaise langue.
 *
 * Aucune de ces chaînes n'est une traduction : ce sont des en-têtes de prompt.
 * Elles sont donc ici plutôt que dans le dictionnaire d'interface, qui ne sert
 * qu'au rendu.
 */
const LABELS = {
  fr: {
    features: "Réalise",
    objective: "Objectif",
    philosophy: "Philosophie",
    cv: "CV",
    process: "Méthode",
    identity: "## Identité",
    usage: "## Utiliser ce site",
    stack: "## Construction du site",
    career: "## Parcours professionnel",
    formations: "Formations :",
    beforeDev: "Avant le développement :",
    management:
      "Compétences de management et de gestion (issues de la carrière précédente) :",
    method: "Méthode :",
    languages: "Langues",
  },
  en: {
    features: "Builds",
    objective: "Objective",
    philosophy: "Philosophy",
    cv: "CV",
    process: "Method",
    identity: "## Identity",
    usage: "## Using this site",
    stack: "## How this site is built",
    career: "## Career path",
    formations: "Training:",
    beforeDev: "Before development:",
    management: "Management and team leadership skills (from the previous career):",
    method: "Method:",
    languages: "Languages",
  },
};

/**
 * Étiquettes d'une langue, avec repli sur le français.
 *
 * @param {string} lang
 */
function labels(lang) {
  return LABELS[lang] ?? LABELS.fr;
}

/**
 * Langue de digest normalisée.
 *
 * Une langue inconnue ne doit pas produire un digest vide : elle est ramenée au
 * français, comme `resolveLocale` le fait côté site.
 *
 * @param {string} lang
 * @returns {"fr"|"en"}
 */
function normalizeLang(lang) {
  return lang === "en" ? "en" : "fr";
}

/**
 * Transforme une section de `PROJECT_CONTENT` en lignes de digest.
 *
 * Le format est volontairement « plat » : une ligne par projet, une ligne par
 * compétence. Les structures imbriquées de la source portent de l'information
 * utile à l'affichage — ordre, groupings — qui n'a pas de sens dans un prompt.
 *
 * Chaque liste optionnelle est gardée par `?? []` : une section qui n'a pas de
 * projets, ou pas de liens, produit des lignes vides plutôt qu'une `TypeError`
 * qui ferait échouer le build et donc le déploiement du site.
 *
 * @param {object} section
 * @returns {string[]}
 */
export function sectionLines(section, lang = "fr") {
  const t = labels(lang);
  const lines = [`## ${section.label}`, section.title];

  for (const paragraph of section.presentation ?? []) lines.push(paragraph);

  for (const skill of section.skills ?? []) {
    lines.push(`- ${skill.title} : ${skill.desc}`);
  }

  if (section.features?.length) {
    lines.push(`${t.features} : ${section.features.join(", ")}.`);
  }
  if (section.approach?.length) {
    lines.push(`${t.objective} : ${section.approach.join(", ")}.`);
  }
  if (section.philosophy) lines.push(`${t.philosophy} : « ${section.philosophy} »`);

  if (section.profile) {
    lines.push(`${t.cv} : ${section.profile.cvUrl}`);
    // `profile.bio` n'est volontairement pas publié ici, bien qu'il soit rendu
    // sur la face « Projets » du cube : c'est la même chose que la section
    // « Identité », en première personne. Le digest la publierait deux fois donc,
    // et la version utile est celle de la tête, à la troisième personne — celle
    // que l'assistant doit reprendre. Le lien du CV, lui, n'existe qu'ici.
  }

  for (const project of section.projects ?? []) {
    lines.push(`- ${project.title} [${project.tags}] : ${project.desc} ${project.details}`);
    for (const link of project.links ?? []) lines.push(`  ${link.label} : ${link.href}`);
  }

  if (section.process?.length) {
    lines.push(`${t.process} : ${section.process.join(" ; ")}.`);
  }

  return lines;
}

/**
 * Transforme `CAREER_CONTENT` en lignes de digest.
 *
 * Le parcours et le savoir-faire de gestion viennent du CV, pas du site : ces
 * informations n'ont pas de face de cube, mais ce sont les premières choses
 * qu'un visiteur demande — « d'où viens-tu ? », « comment es-tu arrivé au
 * développement ? ».
 *
 * L'ordre des sections est l'argument le plus important de cette fonction, et
 * il a déjà été faux une fois : le parcours était placé en dernier, à 85 % du
 * digest, alors que le commentaire affirmait qu'il devait ouvrir la réponse. Le
 * modèle ne lit pas un prompt comme un lecteur : il répond avec ce qu'il a sous
 * les yeux au début.
 *
 * @param {{career: object, usage: string[], stack: string[]}} sources
 * @returns {string[]}
 */
export function careerLines({ career, usage, stack }, lang = "fr") {
  const c = career;
  const t = labels(lang);
  return [
    // L'identité ouvre le digest. Elle est avant le parcours et avant les
    // projets, parce que c'est la réponse à « c'est qui Philippe ? », et que le
    // modèle ne va pas la chercher : il répond avec ce qu'il a sous les yeux au
    // début. Placée après 10 000 caractères de projets, elle n'était jamais
    // atteinte, et la seule phrase d'identité qui lui restait — celle du system
    // prompt, « je suis l'assistant de Philippe » — devenait sa réponse.
    t.identity,
    ...c.identite,
    "",
    // « Utiliser ce site » vient avant le parcours et avant les projets. C'est la
    // réponse à la question que se pose le visiteur qui vient d'arriver devant le
    // cube et ne sait pas quoi faire, donc elle est lue pendant qu'il regarde la
    // page. Elle ne pouvait pas être écrite plus bas : à 85 % du digest, le modèle
    // ne l'aurait pas atteinte, comme le parcours avant elle.
    t.usage,
    ...usage,
    "",
    // La construction du site vient juste après l'usage, et avant le parcours et
    // les projets. Deux raisons. La question « avec quoi c'est fait » est celle
    // d'un visiteur qui regarde le cube et essaie de comprendre, donc elle est
    // lue pendant qu'il regarde la page — mais elle n'a surtout pas sa place
    // après 14 000 caractères de projets : le modèle y répondait déjà par une
    // liste des technologies des autres projets, faute d'autre chose sous les
    // yeux. Elle doit être lue tôt, pas exhaustive.
    t.stack,
    ...stack,
    "",
    t.career,
    c.reconversion,
    "",
    t.formations,
    ...c.formation.map((line) => `- ${line}`),
    "",
    t.beforeDev,
    ...c.avant.map((line) => `- ${line}`),
    "",
    t.management,
    ...c.management.map((line) => `- ${line}`),
    "",
    t.method,
    ...c.method.map((line) => `- ${line}`),
    "",
    `${t.languages} : ${c.langues}`,
    `Soft skills : ${c.soft}`,
    c.permis,
  ];
}

/**
 * Construit le digest complet.
 *
 * Les sources sont injectables pour une seule raison : le plafond. Sans cela,
 * tester la troncature demanderait de fabriquer 16 000 caractères de contenu
 * fictif, et le test se retrouverait à valider sa propre fixture plutôt que la
 * règle. Avec un plafond bas et un contenu minuscule, la règle se vérifie en
 * quelques lignes.
 *
 * La langue est un paramètre, pas une constante. Le digest est la seule chose que
 * le Worker lit du site, et il ne pouvait rien dire de la page anglaise : il n'y
 * avait qu'un digest français, donc un visiteur anglophone était traité par un
 * assistant qui ne connaît que les projets en français — et dont les consignes
 * interdisaient explicitement de répondre autrement.
 *
 * `sources` reste injectable pour les tests (voir ci-dessus) et permet aussi de
 * produire le digest d'une langue sans que cette fonction connaisse `lib/content`.
 *
 * @param {object} [options]
 * @param {string} [options.lang] - langue du digest ; anything d'autre que `en`
 *   tombe sur le français.
 * @param {number} [options.maxChars] - plafond ; `0` ou moins désactive la
 *   troncature.
 * @param {object} [options.sources] - contenu éditorial, par défaut celui du site.
 * @returns {string}
 */
export function buildDigest({ maxChars = MAX_CHARS, lang = "fr", sources } = {}) {
  const l = normalizeLang(lang);
  const {
    career = CAREER_CONTENT,
    usage = USAGE_CONTENT,
    stack = STACK_CONTENT,
    projects = PROJECT_CONTENT,
  } = sources ?? {};

  const body = [
    ...careerLines({ career, usage, stack }, l),
    "",
    ...SCOPE[l],
    "",
    ...projects.flatMap((section) => sectionLines(section, l)),
  ];
  const digest = [...HEADER[l], "", ...body].join("\n");

  if (maxChars <= 0 || digest.length <= maxChars) return digest;

  // Coupe sur une fin de ligne pour ne pas laisser un projet tronqué au milieu
  // d'une phrase, et on le dit : un digest partiel vaut mieux qu'un digest muet,
  // mais un digest partiel qui se dit complet ne vaut rien du tout.
  //
  // L'annonce est rédigée dans la langue du digest : elle s'adresse au modèle,
  // et une consigne en français au milieu d'un digest anglais n'est pas une
  // consigne, c'est du bruit.
  const cut = digest.slice(0, maxChars);
  const lastBreak = cut.lastIndexOf("\n");
  const kept = lastBreak > 0 ? cut.slice(0, lastBreak) : cut;
  const notice =
    l === "en"
      ? `[Content truncated: the rest exceeds the ${maxChars} character limit.]`
      : `[Contenu tronqué : la suite dépasse le plafond de ${maxChars} caractères.]`;
  return `${kept}\n\n${notice}`;
}