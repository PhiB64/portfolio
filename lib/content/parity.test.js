/**
 * Contrat de parité entre `fr.js` et `en.js`.
 *
 * Why ce test existe. La forme du contenu est ce qui permet à `getContent(lang)`
 * de substituer une langue à l'autre sans que le rendu s'en aperçoive : le rendu
 * lit `section.skills[2].desc`, pas « le troisième libellé ». Une clé renommée ou
 * un élément retiré côté anglais produit donc une page qui affiche `undefined`,
 * ou un tableau qui se décale d'un cran — et rien ne casse à la compilation.
 *
 * Ce genre de défaut ne se voit pas en CI, parce que le fichier anglais est du
 * JavaScript valide et qu'aucun test ne l'exerce tant que la page anglaise n'est
 * pas branchée. Il se voit en production, sur la page anglaise, une fois le
 * déploiement fait. D'où ce test : il est là pour rendre la parité vérifiable
 * maintenant, pas après lebranchement.
 *
 * Ce que le test compare :
 * - les clés de premier niveau, dans le même ordre ;
 * - le nombre d'éléments de chaque tableau, à toute profondeur ;
 * - les noms de champs de chaque objet, à toute profondeur.
 *
 * Ce qu'il ne compare pas, volontairement : le texte. Une traduction de qualité
 * ne se vérifie pas par egalité de chaîne, et toute assertion sur un libellé
 * anglais figerait la copie au lieu de la laisser évoluer. Les tests qui portent
 * sur le texte sont ceux du digest, qui vérifient des faits (une adresse, un
 * `?project=`), pas de la rédaction.
 */

import { describe, it, expect } from "vitest";

import { PROJECT_CONTENT as FR } from "./fr.js";
import { PROJECT_CONTENT as EN } from "./en.js";
import { CAREER_CONTENT as CAREER_FR } from "./fr.js";
import { CAREER_CONTENT as CAREER_EN } from "./en.js";
import { STACK_CONTENT as FR_STACK } from "./fr.js";
import { STACK_CONTENT as EN_STACK } from "./en.js";
import { USAGE_CONTENT as USAGE_FR } from "./fr.js";
import { USAGE_CONTENT as USAGE_EN } from "./en.js";

/**
 * Descend dans deux valeurs de même forme et compare leur structure.
 *
 * Pourquoi une fonction récursive plutôt que `toEqual` sur les clés. `toEqual`
 * comparerait aussi les valeurs, donc il exigerait des chaînes identiques — ce que
 * la traduction interdit par construction. Il faut donc comparer la *forme* :
 * le type de chaque nœud, les clés d'un objet, la longueur d'un tableau, et
 * recommencer sur chaque enfant.
 *
 * Le message d'erreur dit le chemin (`skills[2].desc`) parce qu'un simple
 * « objects are not equal » sur une arborescence de six rubriques et huit
 * réalisations ne localize pas la faute : il oblige à relire les deux fichiers
 * côte à côte pour trouver l'écart, qui est précisément le travail qu'on veut
 * éviter ici.
 */
function assertSameShape(a, b, path = "") {
  const at = path || "(racine)";

  if (Array.isArray(a) || Array.isArray(b)) {
    expect(Array.isArray(a), `${at} : le français est un tableau, l'anglais ne l'est pas`).toBe(Array.isArray(b));
    expect(
      a.length,
      `${at} : ${a.length} élément(s) en français, ${b.length} en anglais`,
    ).toBe(b.length);

    a.forEach((item, i) => assertSameShape(item, b[i], `${path}[${i}]`));
    return;
  }

  if (a !== null && typeof a === "object") {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    expect(
      keysA.join(","),
      `${at} : clés différentes (français : ${keysA.join(", ")} / anglais : ${keysB.join(", ")})`,
    ).toBe(keysB.join(","));

    for (const key of keysA) {
      assertSameShape(a[key], b[key], path ? `${path}.${key}` : key);
    }
    return;
  }

  expect(typeof a, `${at} : types différents`).toBe(typeof b);
}

describe("parité fr / en du contenu éditorial", () => {
  it("PROJECT_CONTENT a la même forme dans les deux langues", () => {
    assertSameShape(FR, EN);
  });

  it("CAREER_CONTENT a la même forme dans les deux langues", () => {
    assertSameShape(CAREER_FR, CAREER_EN);
  });

  it("STACK_CONTENT a le même nombre de lignes dans les deux langues", () => {
    // `STACK_CONTENT` est un simple tableau de chaînes : il n'y a pas de sous-
    // structure à descendre, donc la longueur suffit. Le compte compte parce que
    // le digest les numérote en tête : en perdre une en traduction ferait
    // répondre au modèle une liste de technologies incomplète, et il comblerait
    // le trou avec une techno qui n'est pas dans le projet.
    expect(FR_STACK).toHaveLength(EN_STACK.length);
  });

  it("USAGE_CONTENT a le même nombre de lignes dans les deux langues", () => {
    expect(USAGE_EN).toHaveLength(USAGE_FR.length);
  });
});

/**
 * Ces deux tests sont moins évidents qu'ils n'y paraît, et couvrent les deux
 * pièges que la seule parité de forme ne voit pas.
 */
describe("valeurs qui ne se vérifient pas par parité de forme", () => {
  it("l'anglais ne laisse aucun libellé français dans les onglets", () => {
    // La page anglaise montre « PROJECTS », pas « PROJETS ». Si les deux figures
    // dans le digest anglais, l'assistant en anglais citera un onglet que le visiteur ne
    // voit pas — un défaut qui ne se remarque qu'en trainant le visiteur.
    expect(USAGE_EN.join("\n")).not.toMatch(/\bPROJETS\b/);
    expect(USAGE_EN.join("\n")).toMatch(/\bPROJECTS\b/);
  });

  it("chaque réalisation garde les mêmes liens que le français", () => {
    // Les URL ne sont pas traduites : ce sont des faits, pas de la copie. Si une
    // réalisation en anglais perd un lien, c'est une erreur de report, pas une
    // décision de rédaction, et elle serait invisible sans ce test.
    //
    // On compare les href dans l'ordre, sans le titre : le titre EST traduit
    // (« Portail Événements » devient « Events Portal »), donc le comparer ferait
    // échouer le test à chaque traduction correcte. L'ordre et les href ne
    // doivent pas bouger : c'est ce qui garantit qu'aucun lien n'a été perdu,
    // réordonné ou corrigé en douce.
    const links = (sections) =>
      sections.flatMap((s) => (s.projects ?? []).flatMap((p) => p.links.map((l) => l.href)));

    expect(links(EN)).toEqual(links(FR));
    expect(links(EN)).toHaveLength(links(FR).length);
  });

  it("le digest français cite des URLs qui portent le préfixe /fr", () => {
    // La seule valeur dépendante de la langue. Les adresses anglaises sont en
    // racine (`?project=1`), l'anglais étant la langue par défaut ; sur la version
    // française elles vivent sous `/fr`. Sans ce test, un `/fr` oublié enverrait le
    // visiteur français vers la page anglaise en lui affirmant qu'il est sur la
    // bonne, et un `/en` resté de l'ancienne répartition ferait l'inverse.
    expect(USAGE_FR.join("\n")).toContain("/fr?project=1");
    expect(USAGE_EN.join("\n")).not.toContain("/fr?project=");
  });

  it("l'e-mail de CONTACT est identique dans les deux langues", () => {
    // USAGE_CONTENT interpole `CONTACT.email`. C'est la seule valeur partagée
    // entre les deux fichiers, et elle doit venir de `contact.js` dans les deux
    // cas — jamais être retapée.
    const fr = USAGE_FR.find((line) => line.includes("@"));
    const en = USAGE_EN.find((line) => line.includes("@"));
    expect(en).toBeDefined();
    expect(en.split("@").pop()).toBe(fr.split("@").pop());
  });
});