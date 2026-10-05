/**
 * Document commun aux deux langues.
 *
 * Why ce composant existe. `<html lang>` doit porter la langue réelle de la
 * page. Dans le routeur d'App, un seul layout racine aurait une seule balise
 * `<html>`, donc une seule langue — figée à « fr » quoi qu'il arrive. Deux
 * layouts racines, un par langue, sont donc nécessaires, et `app/layout.js` a
 * disparu au profit de `app/(fr)/` et `app/(en)/`.
 *
 * Ce fichier est ce que ces deux layouts partagent : la balise `<html>`, la
 * police, le JSON-LD et le sélecteur de langue. Sans lui, chaque layout
 * réécrirait ces quarante lignes et le `<html lang>` finirait par diverger — le
 * genre de défaut qu'aucun test ne voit et qu'un lecteur d'écran, lui, annonce
 * à chaque page.
 *
 * `lang` n'a pas de valeur par défaut. C'est volontaire : un affichage de repli
 * silencieux laisserait croire qu'une page anglaise est bien annoncée quand son
 * `lang` vaut « fr », ce qui est précisément le défaut qu'on cherche à éviter.
 * Les deux layouts le passent donc explicitement.
 */

import { Share_Tech_Mono } from "next/font/google";

import { LanguageSwitcher } from "./language-switcher";
import { ChatWidget } from "./chat-widget";
import { SITE_ROOT, assetUrl } from "../lib/site-url";
import { CONTACT } from "../lib/content/contact.js";
import { metaText } from "../lib/site-metadata";

const shareTechMono = Share_Tech_Mono({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-share-tech-mono",
  display: "swap",
});

/**
 * JSON-LD de la personne, dans la langue de la page.
 *
 * Le `jobTitle` est localisé : c'est la seule valeur de ce bloc qui change entre
 * les deux pages, et la laisser en français sur la page anglaise décrirait la
 * personne avec le mauvais libellé pour un moteur de recherche ou une
 * application de recrutement.
 */
function jsonLd(lang) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: "Philippe Barbosa",
    jobTitle: metaText(lang).jobTitle,
    url: SITE_ROOT,
    inLanguage: lang,
    image: assetUrl("/og-image.png"),
    email: `mailto:${CONTACT.email}`,
    telephone: CONTACT.phoneInternational,
    address: {
      "@type": "PostalAddress",
      addressLocality: CONTACT.city,
      addressRegion: CONTACT.region,
      addressCountry: "FR",
    },
    sameAs: [CONTACT.githubUrl, CONTACT.linkedinUrl],
  };
}

export function SiteShell({ lang, children }) {
  return (
    <html lang={lang} className={shareTechMono.variable}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(lang)) }}
        />
      </head>
      <body>
        {/* Hors de `{children}` : le sélecteur doit survivre à la navigation
            entre les deux pages, donc vivre dans le layout et pas dans la page.
            Sur la page d'accueil il se superpose au cube, d'où son `z-40` et son
            fond translucide. */}
        <LanguageSwitcher lang={lang} />
        {/* Le chatbot est ici pour la même raison, et pour une raison de plus :
            monté dans `HomePage`, il n'existait que sur les deux accueils. La page
            `/projects` — dans les deux langues — s'en retrouvait dépourvue, alors
            que c'est la page où l'on reste le plus longtemps à lire. Dans le
            layout, il est présent sur les quatre routes.

            Le composant ne rend rien si `NEXT_PUBLIC_CHAT_ENDPOINT` est absent. */}
        <ChatWidget lang={lang} />
        {children}
      </body>
    </html>
  );
}