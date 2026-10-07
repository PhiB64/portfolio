/**
 * Tests de la construction du digest du chatbot.
 *
 * Ce digest est la seule source de vérité du Worker, et il n'est pas vérifié
 * ailleurs : `dist/content.json` est produit par le build, jamais relu par un
 * test. Deux défauts y seraient invisibles.
 *
 * **Un digest tronqué en silence.** Le digest tient dans 16 000 caractères, il en
 * fait 15 730 aujourd'hui — la marge est de 270 caractères. Ajouter une ligne à
 * une rubrique suffit donc à faire mordre la troncature, et le résultat serait un
 * contenu amputé en silence. C'est le risque principal, d'autant qu'un digest
 * tronqué se lit comme un digest complet : le modèle répond alors avec une liste
 * qu'il croit exhaustive.
 *
 * **Un ordre de sections faux.** Le parcours, l'identité et la construction du
 * site sont placés tôt dans le digest, et ce placement était déjà faux une fois :
 * le parcours était à 85 % du digest pendant que son commentaire affirmait qu'il
 * devait ouvrir la réponse. Le modèle ne lit pas un prompt comme un lecteur — il
 * répond avec ce qu'il a sous les yeux au début.
 *
 * Exécution : `npm test`.
 */

import { describe, it, expect } from "vitest";

import { CAREER_CONTENT, PROJECT_CONTENT } from "./portfolio-content.js";
import { MAX_CHARS, buildDigest, careerLines, sectionLines } from "./chat-digest.js";

/**
 * Digest français, comme les libellés que ce fichier vérifie.
 *
 * `buildDigest()` sans argument suit la langue par défaut, alors que les
 * assertions d'ici citent du texte français : « Contenu du site portfolio », le
 * marqueur « Contenu tronqué », les titres de rubriques. Laisser ces tests en
 * hériter de la langue par défaut les ferait échouer le jour où elle change, pour
 * une raison étrangère à ce qu'ils vérifient — et le bruit masquerait alors une
 * vraie régression de troncature ou d'ordre des sections.
 *
 * @param {object} [options]
 * @returns {string}
 */
const digestFR = (options) => buildDigest({ lang: "fr", ...options });

/**
 * Contenu éditorial minimal, suffisant pour exercer toutes les branches.
 *
 * Le contenu réel fait 15 730 caractères : s'en servir pour tester la troncature
 * obligerait à soit oversized la fixture, soit à descendre `MAX_CHARS` jusqu'à un
 * plafond que le digest réel n'atteindrait jamais. Les sources sont donc
 * injectables, et la règle se vérifie sur un contenu minuscule.
 */
const SOURCES = {
  career: {
    identite: ["Philippe Barbosa estdeveloppeur."],
    contact: ["Basé à Lons."],
    reconversion: "Reconverti en 2020.",
    formation: ["Master info"],
    avant: ["Technicien"],
    management: ["Management"],
    method: ["Ecoute"],
    langues: "Francais, anglais",
    soft: "Pédagogie",
    permis: "Permis B",
  },
  usage: ["Cliquer sur une face."],
  stack: ["Next.js"],
  projects: [
    {
      label: "Projets",
      title: "Trois projets",
      presentation: ["Une phrase."],
      skills: [{ title: "React", desc: "interfaces" }],
      features: ["un", "deux"],
      approach: ["tester"],
      philosophy: "Mesurer",
      profile: { cvUrl: "/cv.pdf", bio: "Bio en premiere personne, a ne pas publier." },
      projects: [
        {
          title: "Alpha",
          tags: "next",
          desc: "un projet",
          details: "avec details",
          links: [{ label: "Source", href: "https://github.com/x" }],
        },
      ],
      process: ["lire", "ecrire"],
    },
  ],
};

describe("digest complet", () => {
  it("reste sous le plafond avec le contenu réel", () => {
    // Le garde-fou le plus simple et le plus utile : si quelqu'un ajoute du
    // contenu au-delà, ce test échoue avant que la troncature ne morde en
    // production.
    const digest = digestFR();

    expect(digest.length).toBeLessThanOrEqual(MAX_CHARS);
  });

  it("ne se tronque pas quand il est sous le plafond", () => {
    // Contrôle positif de la troncature : sans lui, un digest toujours tronqué
    // passerait le test précédent.
    const digest = digestFR({ maxChars: 100_000 });

    expect(digest).not.toContain("[Contenu tronqué");
  });

  it("ne s'écrit jamais dans le disque", () => {
    // Le script appelait `buildDigest()` puis écrivait **au chargement du
    // module**. L'import depuis un test créait donc `dist/content.json` et
    // journalisait sur la sortie standard : la fonction était invérifiable.
    expect(digestFR()).toContain("# Contenu du site portfolio");
  });
});

describe("troncature", () => {
  /** Construit un digest tronqué à un plafond donné. */
  function tronque(maxChars) {
    return digestFR({ maxChars });
  }

  it("annonce la troncature", () => {
    // Sans marqueur, le modèle croit à une liste exhaustive — c'est le pire
    // résultat possible, pire que l'absence de digest.
    expect(tronque(500)).toContain("[Contenu tronqué");
  });

  it("cite le plafond dans le marqueur", () => {
    // Un message qui dit « tronqué » sans dire combien ne permet pas de décider
    // s'il faut ajouter du contenu ou en enlever.
    expect(tronque(500)).toContain("500");
  });

  it("ne garde que des lignes entières du digest complet", () => {
    // La propriété qui compte, et non « ça ne finit pas par un bout de mot » :
    // chaque ligne conservée doit exister telle quelle dans le digest non
    // tronqué. Une coupure en milieu de ligne produit un texte qui se termine
    // par un mot coupé, que le modèle attribue à l'auteur du site.
    const complet = digestFR({ maxChars: 100_000 });
    const lignesCompletes = new Set(complet.split("\n"));
    const corps = tronque(500).split("\n\n[Contenu tronqué")[0];

    for (const ligne of corps.split("\n")) {
      expect(lignesCompletes.has(ligne)).toBe(true);
    }
  });

  it("produit un digest plus court que son plafond, marqueur compris", () => {
    // Le marqueur est ajouté *après* la coupe : un digest « tronqué » plus long
    // que son plafond indiquerait que le plafond ne plafonne rien.
    const maxChars = 500;
    const digest = tronque(maxChars);
    const avantMarqueur = digest.split("\n\n[Contenu tronqué")[0];

    expect(avantMarqueur.length).toBeLessThanOrEqual(maxChars);
  });

  it("coupe plus tôt quand le plafond baisse", () => {
    // Contrôle de monotonie : un plafond plus petit ne peut pas garder plus de
    // texte. Une inversion ici signifierait que la coupe n'est pas sur le
    // plafond mais sur autre chose.
    expect(tronque(400).length).toBeLessThan(tronque(2000).length);
  });

  it("désactive la troncature sur un plafond nul ou négatif", () => {
    // `maxChars <= 0` est traité comme « pas de plafond », pas comme « vide » :
    // un plafond nul couperait tout, digest vide, modèle sans rien dire.
    expect(tronque(0)).not.toContain("[Contenu tronqué");
    expect(tronque(-1)).not.toContain("[Contenu tronqué");
  });

  it("coupe même sans retour à la ligne avant le plafond", () => {
    // Si le plafond tombe avant le premier `\n`, `lastIndexOf` renvoie -1. Le
    // code doit alors couper au plafond plutôt que de renvoyer une chaîne vide
    // ou de lever : le cas est peu probable avec le contenu réel, mais il se
    // produirait si le préambule grossissait.
    const digest = digestFR({ maxChars: 10 });

    expect(digest.length).toBeGreaterThan(0);
    expect(digest).toContain("[Contenu tronqué");
  });
});

describe("ordre des sections", () => {
  it("met l'identité avant tout le reste", () => {
    // La réponse à « c'est qui Philippe ? » ne doit pas être à 10 000 caractères.
    // Placée plus bas, elle n'était jamais atteinte, et la seule phrase
    // d'identité restante — celle du system prompt — devenait la réponse.
    const digest = digestFR({ maxChars: 100_000 });

    expect(digest.indexOf("## Identité")).toBeLessThan(digest.indexOf("## Utiliser ce site"));
  });

  it("met l'usage et la construction avant les projets", () => {
    // Ces deux sections répondent à ce que le visiteur regarde en arrivant. Après
    // 14 000 caractères de projets, le modèle y répondait par une liste des
    // technologies des autres projets.
    const digest = digestFR({ maxChars: 100_000 });

    expect(digest.indexOf("## Utiliser ce site")).toBeLessThan(digest.indexOf("## Projets"));
    expect(digest.indexOf("## Construction du site")).toBeLessThan(digest.indexOf("## Projets"));
  });

  it("met le parcours avant les projets", () => {
    // L'ordre a déjà été faux ici : le parcours était en dernier pendant que son
    // commentaire affirmait le contraire.
    const digest = digestFR({ maxChars: 100_000 });

    expect(digest.indexOf("## Parcours professionnel")).toBeLessThan(
      digest.indexOf("## Projets"),
    );
  });

  it("annonce le périmètre des rubriques juste avant elles", () => {
    // La règle « une technologie citée là n'est pas forcément dans ce site » doit
    // précéder les technologies, pas les suivre. À 19 % du digest, elle ne
    // tenait pas jusqu'en bas.
    const digest = digestFR({ maxChars: 100_000 });
    const perimetre = digest.indexOf("n'est pas forcément dans ce site");

    expect(perimetre).toBeGreaterThan(0);
    expect(perimetre).toBeLessThan(digest.indexOf("## Projets"));
  });

  it("garde le préambule, qui pose dont parle le digest", () => {
    const digest = digestFR({ maxChars: 100_000 });

    expect(digest.startsWith("# Contenu du site portfolio")).toBe(true);
    expect(digest).toContain("elles ne te concernent pas");
  });
});

describe("section de projet", () => {
  const lignes = sectionLines(SOURCES.projects[0]);

  it("met le titre et la présentation avant les compétences", () => {
    const tout = lignes.join("\n");

    expect(tout.indexOf("Trois projets")).toBeLessThan(tout.indexOf("- React :"));
  });

  it("nomme chaque compétence et sa description", () => {
    expect(lignes).toContain("- React : interfaces");
  });

  it("agrège les features et l'approche sur une ligne chacune", () => {
    expect(lignes).toContain("Réalise : un, deux.");
    expect(lignes).toContain("Objectif : tester.");
  });

  it("cite la philosophie et la méthode", () => {
    expect(lignes).toContain("Philosophie : « Mesurer »");
    expect(lignes).toContain("Méthode : lire ; ecrire.");
  });

  it("marque chaque projet de ses technologies", () => {
    // Les crochets sont ce qui permet au modèle de répondre « avec quoi ? »
    // projet par projet — la section des compétences, elle, couvre tous les
    // projets et ne distingue rien.
    expect(lignes.some((l) => l.startsWith("- Alpha [next] :"))).toBe(true);
  });

  it("indente les liens d'un projet", () => {
    expect(lignes).toContain("  Source : https://github.com/x");
  });

  it("publie le lien du CV", () => {
    expect(lignes).toContain("CV : /cv.pdf");
  });

  it("ne publie pas la bio du CV", () => {
    // Exclu volontairement : c'est la même information que « Identité », en
    // première personne. Le digest la publierait deux fois, et la version utile
    // est celle de la tête, à la troisième personne — celle que l'assistant doit
    // reprendre.
    expect(lignes.join("\n")).not.toContain("Bio en premiere personne");
  });

  it("ne lève pas sur une section sans aucune rubrique optionnelle", () => {
    // Une rubrique vide ne doit pas casser le build, donc le déploiement du
    // site — pour un contenu absent.
    const lignesVides = sectionLines({ label: "Vide", title: "Rien" });

    expect(lignesVides).toEqual(["## Vide", "Rien"]);
  });
});

describe("parcours", () => {
  const lignes = careerLines(SOURCES);
  const tout = lignes.join("\n");

  it("ouvre sur l'identité", () => {
    expect(lignes[0]).toBe("## Identité");
  });

  it("liste les formations et la carrière antérieure à puces", () => {
    // Les puces sont ce qui permet au modèle de distinguer une liste d'un
    // paragraphe : il les restitue en liste.
    expect(tout).toContain("- Master info");
    expect(tout).toContain("- Technicien");
  });

  it("garde les langues, les soft skills et le permis, qui sont en fin de digest", () => {
    // Ces trois lignes sont les dernières avant les projets, donc les premières
    // victimes d'une troncature. À 12 000 caractères, c'est exactement ce qui
    // disparaissait.
    expect(tout).toContain("Langues : Francais, anglais");
    expect(tout).toContain("Soft skills : Pédagogie");
    expect(tout).toContain("Permis B");
  });

  it("publie les coordonnées citables juste après l'identité", () => {
    // Téléphone, localité, e-mail et disponibilité : sans ces lignes, le
    // modèle ne peut répondre à « comment le joindre ? ». Elles sont en tête
    // pour la même raison que l'identité — placées après les projets, elles
    // ne seraient jamais atteintes.
    const career = { ...SOURCES.career, contact: ["Basé à Lons.", "Téléphone : 06."] };
    const lignes = careerLines({ career, usage: SOURCES.usage, stack: SOURCES.stack });
    const tout = lignes.join("\n");

    expect(tout).toContain("Contact");
    expect(tout).toContain("- Basé à Lons.");
    expect(tout.indexOf("Contact")).toBeLessThan(tout.indexOf("## Utiliser ce site"));
  });

  it("reste lisible sans coordonnées, pour les contenus qui n'en ont pas", () => {
    // `contact` est optionnel : les fixtures historiques et les contenus sans
    // coordonnées ne doivent pas produire une section vide.
    const careerSansContact = { ...SOURCES.career };
    delete careerSansContact.contact;
    const lignes = careerLines({
      career: careerSansContact,
      usage: SOURCES.usage,
      stack: SOURCES.stack,
    });

    expect(lignes.join("\n")).not.toContain("Contact");
  });
});

describe("contenu réel", () => {
  it("contient toutes les rubriques attendues", () => {
    // Un test de coherence entre la source et le digest : si une rubrique de
    // `PROJECT_CONTENT` change de `label`, cette liste doit changer aussi.
    const digest = digestFR();

    for (const section of PROJECT_CONTENT) {
      expect(digest).toContain(`## ${section.label}`);
    }
    expect(digest).toContain(CAREER_CONTENT.reconversion);
  });

  it("publie chaque lien de chaque projet", () => {
    // Les liens sont la partie du digest qui se périme : un lien de portfolio
    // mort est une promesse que l'assistant ne tient pas.
    const digest = digestFR();
    const liens = PROJECT_CONTENT.flatMap((s) =>
      (s.projects ?? []).flatMap((p) => (p.links ?? []).map((l) => l.href)),
    );

    expect(liens.length).toBeGreaterThan(0);
    for (const href of liens) expect(digest).toContain(href);
  });
});