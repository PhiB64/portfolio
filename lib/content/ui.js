/**
 * Libellés d'interface, par langue.
 *
 * Why ce fichier existe. Le contenu éditorial (`fr.js`, `en.js`) décrit le
 * portfolio : projets, compétences, biographies. Il ne décrit pas l'interface —
 * « Téléphone », « Envoyer un message », « Rubriques du portfolio », « Recharger
 * la page ». Ces textes vivaient en dur dans les composants, en français.
 *
 * Une langue n'était donc affichable qu'à moitié : la page anglaise, une fois
 * branchée, aurait eu ses rubriques et ses boutons en français au milieu d'un
 * contenu anglais. Aucun test n'aurait vu le défaut — un composant qui affiche
 * une chaîne littérale est valide du point de vue de JavaScript.
 *
 * Ce qui a été déplacé ici. Uniquement ce qui est *écrit par l'interface* : les
 * libellés des contrôles, les messages de statut, les textes d'erreur du
 * formulaire, les phrases d'interface du chatbot. Le contenu éditorial n'est pas
 * touché : il est déjà dans `fr.js` et `en.js`, et la parité entre ces deux
 * fichiers est vérifiée par `parity.test.js`.
 *
 * Ce qui n'a pas été déplacé. Les marqueurs de position et les noms techniques
 * restent écrits sur place : « EMAIL », `votre@email.com`, « CONTACT », « SKIP »
 * sont identiques dans les deux langues ou relèvent d'une convention, et les
 * traduire introduirait de la variation là où il n'y en a pas besoin.
 *
 * Une seule langue est décrite par fichier. Le dictionnaire est plat et groupe
 * ses clés par consommateur (`nav`, `content`, `contact`, `form`, `chat`), pour
 * qu'un composant ne lise que la partie qui le concerne et que la parité se
 * vérifie en comparant ces groupes. Les clés dont le texte est produit à
 * partir d'un nombre sont des fonctions : elles gardent le compte dans la
 * langue du visiteur au lieu d'être assemblées à l'appel.
 */

import { resolveLocale, DEFAULT_LOCALE } from "./locales.js";

export const UI = {
  fr: {
    nav: {
      skipToContent: "Aller au contenu",
      sections: "Rubriques du portfolio",
      sectionsContact: "Rubriques — page contact",
      backToTop: "Retour en haut de page",
      skip: "Passer l'animation",
      // Version courte, pour le bouton lui-même : `skip` ci-dessus sert
      // d'`aria-label` au bouton SKIP, dont le texte tient largement dans la
      // pastille. On ne réutilise pas cette clé parce qu'une pastille ne peut
      // pas porter douze caractères.
      skipShort: "Passer",
      restart: "Revenir au début de l'animation",
      // Décrit la destination, pas la langue courante : une seule clé suffit,
      // lue depuis la langue de la page visitée. La formule « Voir ce portfolio
      // en <autre langue> » est donc déjà résolue par le choix du dictionnaire.
      switchLanguage: "Voir ce portfolio en anglais",
    },
    tabs: {
      projects: "PROJETS",
    },
    projectsPage: {
      h1: "Compétences & projets",
      intro:
        "Le contenu des six rubriques du cube, en texte complet et sans animation.",
      backToCube: "← Retour au cube",
      summaryNav: "Sommaire des rubriques",
      summaryTitle: "Sommaire",
      footerNav: "Navigation de pied de page",
    },
    content: {
      about: "À propos de moi",
      downloadCv: "Télécharger mon CV",
      presentation: "Présentation",
      mySkills: "Mes compétences",
      myTools: "Mes outils",
      features: "Fonctionnalités",
      whatIBuild: "Ce que je réalise",
      objective: "Objectif",
      philosophy: "Ma philosophie",
      projects: "Projets",
      method: "Ma méthode de travail",
      methodIntro: "Chaque projet suit un processus rigoureux :",
      ctaTitle: "Un projet en tête ?",
      ctaBody: "Discutons de votre besoin — réponse rapide garantie.",
      ctaButton: "Me contacter",
    },
    contact: {
      jobTitle: "Concepteur Développeur · Full Stack",
      coordinates: "Coordonnées",
      phone: "Téléphone",
      availability: "Disponibilité",
      available: "Ouvert aux opportunités",
      sendMessage: "Envoyer un message",
      sent: "Message envoyé",
      sentBody:
        "Merci, votre message a bien été transmis. Je vous répondrai rapidement.",
      failed: "Envoi impossible",
      failedBody: "L’envoi automatique n’a pas abouti. Vous pouvez m’écrire directement à",
      openMail: "Ouvrir ma messagerie",
      name: "Nom",
      namePlaceholder: "Votre nom",
      email: "Email",
      message: "Message",
      messagePlaceholder: "Votre message…",
      honeypot: "Ne pas remplir ce champ",
      sending: "Envoi…",
      send: "Envoyer",
      back: "Retour",
    },
    form: {
      errName: "Indiquez votre nom.",
      errNameLong: (n) => `Votre nom est trop long (${n} caractères maximum).`,
      errEmail: "Indiquez votre adresse e-mail.",
      errEmailLong: (n) =>
        `Votre adresse e-mail est trop longue (${n} caractères maximum).`,
      errEmailInvalid: "Cette adresse e-mail semble incorrecte.",
      errMessage: "Écrivez un message.",
      errMessageLong: (n) =>
        `Votre message est trop long (${n} caractères maximum).`,
    },
    chat: {
      outOfScope:
        "Je ne peux pas répondre à cette question. Posez-moi autre chose sur le portfolio.",
      serviceDown: "Le service de discussion ne répond pas.",
      retry: "Le service de discussion n’a pas su répondre. Réessayez.",
      timeout: "Le service de discussion met trop de temps à répondre.",
      genericError: "Une erreur est survenue.",
      assistant: "Assistant de Philippe",
      clear: "Effacer la conversation",
      writing: "rédaction…",
      // `writingRetry` est une fonction parce que le compteur de relance change
      // à chaque tentative : une chaîne figée dans le dictionnaire afficherait
      // toujours « nouvelle tentative (1/3) ».
      writingRetry: (n, max) => `nouvelle tentative (${n}/${max})…`,
      placeholder: "Votre question…",
      send: "Envoyer le message",
      // Les six clés suivantes sont les textes qui étaient encore écrits en
      // français dans `chat-widget.jsx`. Elles n'étaient pas visibles dans le
      // panneau — sauf `heading` et `disclaimer`, qui s'affichaient en français
      // sur une page anglaise.
      heading: "Assistant",
      greeting:
        "Bonjour ! Je suis l’assistant de Philippe. Posez-moi une question sur ses projets, ses compétences ou son parcours.",
      inputLabel: "Votre message",
      disclaimer:
        "Réponses générées par IA — vérifiez les informations importantes.",
      open: "Ouvrir l’assistant",
      close: "Fermer l’assistant",
      // Voix gratuite (Web Speech API) : dictée vers le brouillon et lecture
      // des réponses. Mêmes clés, même ordre côté anglais — voir `ui.test.js`.
      voiceDictate: "Dicter un message",
      voiceStopDictation: "Arrêter la dictée",
      voiceListening: "écoute…",
      voiceDenied:
        "Micro bloqué : autorisez son accès dans le navigateur, puis réessayez.",
      listen: "Écouter la réponse",
      stopReading: "Arrêter la lecture",
      // Conversation mains libres : boucle écoute → envoi auto → lecture →
      // ré-écoute. Clés ajoutées en fin de groupe, même ordre côté anglais.
      // Le visiteur peut la couper à la voix en disant `stop` : la commande
      // est reconnue par `isStopCommand` dans `lib/voice.js`.
      voiceHandsFree: "Conversation mains libres",
      voiceStopHandsFree: "Arrêter la conversation mains libres",
      voiceHandsFreeActive: "Conversation auto active — dites « stop » pour arrêter",
    },
    cube: {
      reload: "Recharger la page",
      // Consigne de la zone de clic du cube, lue par les lecteurs d'écran.
      // C'est ce texte qui couvrait déjà les invites « SCROLL DOWN » et
      // « CLICK TO EXPLORE » (masquées en `aria-hidden`) — mais il était écrit
      // en dur en français dans `hero-cube.jsx`, donc une page anglaise
      // annonçait sa consigne principale en français.
      cubeInstructions:
        "Cube de compétences. Faites défiler pour le faire tourner, puis appuyez sur Entrée pour ouvrir la face tournée vers vous.",
      // Tableau de lignes, pas une chaîne : l'invite tient sur une ligne en
      // français (« SCROLLEZ ») là où l'anglais tient sur deux (« SCROLL /
      // DOWN »). Le nombre de lignes n'est pas un détail de mise en forme
      // arbitraire — la position de l'invite est calibrée dessus, et elle est
      // lue ligne par ligne pour le rendu.
      scrollDown: ["SCROLLEZ"],
      // Chaîne simple : à 0,875 rem en chasse fixe, « CLIQUEZ POUR EXPLORER »
      // tient dans la largeur du cube. Voir `FACE_LABEL_FONT_SCALE`.
      clickToExplore: "CLIQUEZ POUR EXPLORER",
    },
  },

  en: {
    nav: {
      skipToContent: "Skip to content",
      sections: "Portfolio sections",
      sectionsContact: "Sections — contact page",
      backToTop: "Back to top of page",
      skip: "Skip the animation",
      skipShort: "Skip",
      restart: "Back to the start of the animation",
      switchLanguage: "View this portfolio in French",
    },
    tabs: {
      projects: "PROJECTS",
    },
    projectsPage: {
      h1: "Skills & projects",
      intro:
        "The full content of the cube’s six sections, in complete text and without animation.",
      backToCube: "← Back to the cube",
      summaryNav: "Sections overview",
      summaryTitle: "Overview",
      footerNav: "Footer navigation",
    },
    content: {
      about: "About me",
      downloadCv: "Download my CV",
      presentation: "Presentation",
      mySkills: "My skills",
      myTools: "My tools",
      features: "Features",
      whatIBuild: "What I build",
      objective: "Objective",
      philosophy: "My philosophy",
      projects: "Projects",
      method: "My work method",
      methodIntro: "Every project follows a rigorous process:",
      ctaTitle: "Got a project in mind?",
      ctaBody: "Tell me about your needs — guaranteed quick reply.",
      ctaButton: "Contact me",
    },
    contact: {
      jobTitle: "Full Stack Developer · Designer",
      coordinates: "Contact details",
      phone: "Phone",
      availability: "Availability",
      available: "Open to opportunities",
      sendMessage: "Send a message",
      sent: "Message sent",
      sentBody: "Thank you, your message has been sent. I’ll reply shortly.",
      failed: "Could not send",
      failedBody:
        "Automatic sending failed. You can write to me directly at",
      openMail: "Open my email client",
      name: "Name",
      namePlaceholder: "Your name",
      email: "Email",
      message: "Message",
      messagePlaceholder: "Your message…",
      honeypot: "Do not fill this field",
      sending: "Sending…",
      send: "Send",
      back: "Back",
    },
    form: {
      errName: "Please enter your name.",
      errNameLong: (n) => `Your name is too long (${n} characters maximum).`,
      errEmail: "Please enter your email address.",
      errEmailLong: (n) =>
        `Your email address is too long (${n} characters maximum).`,
      errEmailInvalid: "This email address seems incorrect.",
      errMessage: "Please write a message.",
      errMessageLong: (n) =>
        `Your message is too long (${n} characters maximum).`,
    },
    chat: {
      outOfScope:
        "I can’t answer this question. Ask me something else about the portfolio.",
      serviceDown: "The chat service is not responding.",
      retry: "The chat service couldn’t answer. Please try again.",
      timeout: "The chat service is taking too long to respond.",
      genericError: "Something went wrong.",
      assistant: "Philippe’s assistant",
      clear: "Clear the conversation",
      writing: "writing…",
      writingRetry: (n, max) => `retrying (${n}/${max})…`,
      placeholder: "Your question…",
      send: "Send the message",
      heading: "Assistant",
      greeting:
        "Hi! I’m Philippe’s assistant. Ask me about his projects, his skills or his background.",
      inputLabel: "Your message",
      disclaimer:
        "AI-generated replies — check any information that matters.",
      open: "Open the assistant",
      close: "Close the assistant",
      voiceDictate: "Dictate a message",
      voiceStopDictation: "Stop dictation",
      voiceListening: "listening…",
      voiceDenied:
        "Microphone blocked: allow access in the browser, then try again.",
      listen: "Listen to the reply",
      stopReading: "Stop reading",
      // Hands-free conversation: listen → auto-send → read aloud → listen
      // again. New keys at the end of the group, same order as the French side.
      // Saying `stop` ends it by voice — see `isStopCommand` in `lib/voice.js`.
      voiceHandsFree: "Hands-free conversation",
      voiceStopHandsFree: "Stop the hands-free conversation",
      voiceHandsFreeActive: "Hands-free conversation on — say “stop” to end it",
    },
    cube: {
      reload: "Reload the page",
      cubeInstructions:
        "Skills cube. Scroll to rotate it, then press Enter to open the face turned toward you.",
      scrollDown: ["SCROLL", "DOWN"],
      clickToExplore: "CLICK TO EXPLORE",
    },
  },
};

export default UI;

/**
 * Libellés d'une langue, avec repli silencieux.
 *
 * Volontairement sans import de `fr.js` / `en.js`, contrairement à `getContent`
 * dans `index.js` : cette fonction est appelée par des composants client, qui ne
 * doivent pas embarquer le contenu éditorial pour afficher « Téléphone ».
 *
 * @param {string} lang
 * @returns {typeof UI["en"]}
 */
export function uiFor(lang) {
  return UI[resolveLocale(lang)] ?? UI[DEFAULT_LOCALE];
}

/**
 * Nom de chaque langue, dans cette langue.
 *
 * Écrit dans sa propre langue et non dans celle du visiteur : « Français » se
 * reconnaît en anglais, alors que « French » ne se reconnaît pas en français et
 * ferait douter un visiteur anglophone. Le sélecteur affiche ce nom pour la
 * langue courante, il est donc toujours dans la langue du visiteur — la seule
 * écriture qui marche des deux côtés.
 */
export const LANGUAGE_NAMES = { fr: "Français", en: "English" };

/**
 * Code court de chaque langue, pour le sélecteur en version mobile.
 *
 * Why deux tables et pas une seule. « Français » et « English » se lisent d'un
 * coup ; leur code, non, mais sur un écran de 320 px le nom complet ne laisse
 * plus de place au bouton CONTACT centré en bas — mesuré : le lien allait jusqu'à
 * x=117 et CONTACT commençait à x=95. Le mobile garde donc le code, le desktop le
 * nom complet.
 *
 * Why deux lettres et pas une. `F` et `E` se confondent en tracking large ;
 * `FR` et `EN` se lisent encore, et restent sous les 25 px de large. Le code est
 * en majuscules comme le reste de l'interface — `uppercase` s'en charge déjà.
 */
export const LANGUAGE_CODES = { fr: "FR", en: "EN" };
