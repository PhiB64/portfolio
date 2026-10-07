"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEscapeKey, useFocusExempt } from "../lib/use-dialog-focus";
import { createLeakFilter } from "../lib/leak-filter";
import { createRequestSlot } from "../lib/chat-request";
import {
  getRecognitionCtor,
  isRecognitionSupported,
  isSynthesisSupported,
  isStopCommand,
  pickVoice,
  speakableText,
  speechLocale,
} from "../lib/voice";
import { uiFor } from "../lib/content/ui.js";
import {
  Loader2,
  MessageCircle,
  Mic,
  RotateCcw,
  Send,
  Square,
  Volume2,
  X,
} from "lucide-react";

/**
 * URL du Worker proxy (voir `worker/`). Volontairement absente du dépôt : tant
 * qu'elle n'est pas définie, le composant ne rend rien — un bouton de chat qui
 * mènerait à une erreur en développement local est pire que pas de bouton.
 */
const ENDPOINT = process.env.NEXT_PUBLIC_CHAT_ENDPOINT ?? "";

/**
 * Nombre de messages envoyés à l'API. Le Worker en refuse plus de 24 : on
 * reste sous la barre pour qu'une longue conversation ne commence pas à
 * échouer une fois arrivée au bout.
 */
const HISTORY_LIMIT = 16;

/**
 * Nombre de relances automatiques après l'échec d'une requête.
 *
 * Plafond bas et non négociable : le Worker autorise 10 requêtes par minute et
 * par IP, donc chaque relance rejoue la requête et consomme un jeton de ce
 * quota. Sans plafond, un échec permanent bouclerait jusqu'à bloquer le
 * visiteur — lui-même et tous ceux derrière la même IP.
 */
const MAX_RETRIES = 2;

/**
 * Erreur d'annulation, dans la forme que produit `AbortController`.
 *
 * `DOMException` n'est pas garanti sur tous les navigateurs (ni dans le rendu
 * serveur de React), on fabrique donc un objet qui porte le seul champ que la
 * gestion d'erreur de `send` regarde : `name`.
 *
 * @returns {Error}
 */
function abortError() {
  return Object.assign(new Error("Aborted"), { name: "AbortError" });
}

/**
 * Attente entre deux tentatives, interrompue si le visiteur annule.
 *
 * Sans l'interruption, fermer l'onglet pendant l'attente laisserait la boucle
 * repartir sur une requête morte : le `sleep` ignorait le signal et la
 * nouvelle requête partait vers un composant démonté.
 *
 * @param {number} ms
 * @param {AbortSignal} signal
 * @returns {Promise<void>}
 */
function sleep(ms, signal) {
  // Signal déjà annulé avant l'appel : aucun écouteur ne se déclencherait et
  // l'attente irait jusqu'à son terme. On sort avant de s'enregistrer.
  if (signal.aborted) return Promise.reject(abortError());

  return new Promise((resolve, reject) => {
    // `timer` est référencé par `cancel`, déclaré après : `const` vit dans le
    // TDZ, donc l'appel doit forcément être postérieur aux deux déclarations.
    const cancel = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", cancel);
      resolve();
    }, ms);
    signal.addEventListener("abort", cancel);
  });
}

/**
 * Retire la syntaxe Markdown d'un texte destiné à être affiché tel quel.
 *
 * Le composant rend le texte dans une bulle avec `whitespace-pre-wrap` : aucune
 * balise n'est interprétée, donc un `**` s'affiche littéralement à l'écran. Le
 * system prompt interdit déjà le Markdown, mais un modèle raisonneur ou une
 * bibliothèque tierce peut ne pas le respecter — et on a déjà mesuré que ce
 * catalogue de modèles n'obéit pas aux consignes d'interdiction.
 *
 * On nettoie donc à l'affichage, qui est la seule couche qui ne peut pas échouer.
 * L'ordre compte : les liens sont traités avant les astérisques, sinon leur URL
 * passerait au cleaning des italiques.
 *
 * Ce qui est retiré : `**gras**`, `__gras__`, `*italique*`, `_italique_`,
 * `` `code` ``, les puces `*`/`-` en début de ligne, et les titres `#`.
 * Ce qui est conservé : les URL, y compris celles écrites `[texte](url)`.
 *
 * @param {string} text
 * @returns {string}
 */
function stripMarkdown(text) {
  return text
    // `[libellé](url)` → `libellé (url)` : l'URL est retirée de la syntaxe mais
    // reste visible, sinon le visiteur perdrait le lien.
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, "$1 ($2)")
    // `**gras**` et `__gras__` → `gras`.
    .replace(/\*\*(.+?)\*\*/gs, "$1")
    .replace(/__(.+?)__/gs, "$1")
    // `` `code` `` → `code`.
    .replace(/`([^`]+)`/g, "$1")
    // `*italique*` et `_italique_`, mais seulement entre deux caractères non
    // blancs : sinon un `*` isolé ou un snake_case comme `snake_case` serait
    // mutilé. C'est le compromis habituel, il rate quelques cas rares.
    .replace(/(^|[\s(«"'—–-])\*([^*\n]+)\*(?=$|[\s.,;:!?)»"'—–])/g, "$1$2")
    .replace(/(^|[\s(«"'—–-])_([^_\n]+)_(?=$|[\s.,;:!?)»"'—–])/g, "$1$2")
    // Puces de liste : `- ` ou `* ` en début de ligne → `• `. Le contenu est
    // conservé, seule la puce change.
    //
    // `[ \t]` et non `\s` : en mode multiligne, `\s` englobe le retour à la
    // ligne, donc une puce en absorbait la ligne vide qui la précédait. Sur une
    // réponse structurée en listes, cela collapait toutes les séparations.
    .replace(/^[ \t]*[-*][ \t]+/gm, "• ")
    // Titres : `#` en début de ligne → rien, le texte reste.
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, "")
    // Ligne horizontale (`---`, `***`) → rien.
    .replace(/^[ \t]*(?:[-*_][ \t]*){3,}$/gm, "")
    .trim();
}

/**
 * Traduit une erreur OpenRouter en message français, et dit si elle mérite une
 * relance.
 *
 * Deux familles très différentes se cachent derrière un même `error_type` :
 *
 * - `content_policy_violation` et `refusal` : la demande a été comprise puis
 *   refusée. Relancer répéterait exactement le même refus — trois requêtes
 *   pour un résultat identique. Elles portent `retryable: false`.
 * - Tout le reste (surcharge, limite de débit, coupure réseau) : la réponse
 *   changerait si on reposait la question.
 *
 * Le message amont n'est jamais recopié : il est en anglais, et il parle au
 * visiteur de politique de contenu, ce qui n'est ni lisible ni aimable.
 *
 * @param {{code?: number, message?: string, metadata?: {error_type?: string}}} error
 * @param {{outOfScope: string, serviceDown: string}} t
 * @returns {Error & {retryable: boolean}}
 */
function upstreamError(error, t) {
  const kind = error?.metadata?.error_type;
  const refused = kind === "content_policy_violation" || kind === "refusal";

  return Object.assign(new Error(refused ? t.outOfScope : t.serviceDown), {
    retryable: !refused,
  });
}

/**
 * Erreur « le modèle a répondu à vide », dans la forme que la boucle de relance
 * sait traiter.
 *
 * Elle est `retryable` : une réponse vide est presque toujours celle d'un modèle
 * tiré hors de son domaine — une ligne de fuite seule, une trame tronquée — et le
 * tirage suivant du routeur tombe sur un autre modèle. Relancer est donc le seul
 * geste utile ; si le retour reste vide, les tentatives suivantes échouent
 * pareillement et ce message est celui que le visiteur finit par lire.
 *
 * @param {{retry: string}} t
 * @returns {Error & {retryable: boolean}}
 */
function emptyAnswerError(t) {
  return Object.assign(new Error(t.retry), {
    retryable: true,
  });
}

/**
 * Lit un flux SSE au format OpenAI et appelle `onDelta` à chaque fragment de
 * texte. OpenRouter émet déjà ce format, le Worker le relaie tel quel — le
 * front n'a donc pas à connaître ce détail.
 *
 * Indique en retour si le flux a produit autre chose que des blancs. Sans ce
 * signal, l'appelant ne peut pas distinguer une réponse vide d'une réponse
 * entièrement consommée par le filtre des fuites, et il ne peut donc pas
 * décider s'il a quelque chose à afficher au visiteur.
 *
 * @param {ReadableStreamDefaultReader<Uint8Array>} body
 * @param {(delta: string) => void} onDelta
 * @param {{outOfScope: string, serviceDown: string, retry: string}} t
 * @returns {Promise<boolean>}
 */
async function readStream(body, onDelta, t) {
  const leaks = createLeakFilter();
  let hasContent = false;
  // Point unique d'émission : c'est ici que l'on compte ce qui atteint vraiment
  // l'écran, le filtre et le test sur `delta` écartant déjà les fragments vides.
  const emit = (text) => {
    if (!text) return;
    if (text.trim()) hasContent = true;
    onDelta(text);
  };
  // Sortie du flux : la ligne encore en attente doit être rendue, qu'elle
  // arrive par `[DONE]` ou par la fin de la connexion.
  const finish = () => emit(leaks.flush());
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // `stream: true` : un chunk réseau peut couper un `data:` en plein milieu.
    // Le tampon retient la trame incomplète, qui sera complétée par la lecture
    // suivante — sans quoi les fins de trame seraient perdues.
    buffer += decoder.decode(value, { stream: true });

    // SSE : les événements sont séparés par une ligne vide.
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue;

        const payload = line.slice(5).trim();
        if (!payload) continue;
        if (payload === "[DONE]") {
          finish();
          return hasContent;
        }

        let frame;
        try {
          frame = JSON.parse(payload);
        } catch {
          // Trame illisible : on l'ignore, la suivante prend le relais.
          continue;
        }

        // Erreur en cours de flux : OpenRouter répond 200 et fait porter
        // l'échec dans une trame SSE (`finish_reason: "error"`), le statut HTTP
        // étant figé depuis l'envoi des en-têtes. Sans ce test, une modération
        // ou un refus de modèle s'affiche comme une réponse vide, sans texte
        // et sans erreur — le visiteur voit une bulle muette.
        if (frame?.error) throw upstreamError(frame.error, t);

        // Même échec, autre forme : certaines trames le portent dans
        // `finish_reason` sans champ `error`. Sans ce test, la bulle resterait
        // muette — le cas que le commentaire ci-dessus décrit.
        if (frame?.choices?.[0]?.finish_reason === "error") throw upstreamError({}, t);

        const delta = frame?.choices?.[0]?.delta?.content;
        if (delta) emit(leaks.push(delta));
      }
    }
  }

  // Fin du flux sans `data: [DONE]` : même traitement que la sortie ci-dessus.
  finish();
  return hasContent;
}

export function ChatWidget({ lang }) {
  const t = uiFor(lang).chat;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // Numéro de la relance en cours (0 = première tentative). Affiché dans la
  // bulle pour que le visiteur comprenne le silence lors du backoff.
  const [retry, setRetry] = useState(0);

  // Suivi de la requête en vol. Tout ce qui concernait le contrôleur, son délai
  // et l'annulation vit dans `lib/chat-request.js`, qui est testé : ici, il
  // n'y a plus qu'un `slot` à créer, à faire tourner, et à annuler. Les trois
  // `useRef` que ce code portait (`abortRef`, `timerRef`, `timedOutRef`) ont la
  // propriété commune de ne jamais être lus au rendu — ils ne vivaient que pour
  // `send`, `close`, `reset` et le nettoyage, c'est-à-dire hors du chemin
  // declaratif. Les sortir rendait le composant lisible d'un coup.
  const slotRef = useRef(null);
  if (slotRef.current === null) slotRef.current = createRequestSlot();
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const launcherRef = useRef(null);
  const panelRef = useRef(null);

  // Voix gratuite (Web Speech API), mains libres et lecture.
  //
  // Le `supported` n'est lu qu'au rendu : ce sont des booléens figés au
  // montage, pas un état React. En SSR `window` n'existe pas, les fonctions
  // de `lib/voice.js` rendent donc `false` et les boutons restent masqués —
  // jamais d'erreur, jamais de micro muet. Au montage, le state force un
  // second rendu avec les vraies capacités du navigateur.
  const [voiceReady, setVoiceReady] = useState(false);
  const dictationRef = useRef(null);
  const [_listening, setListening] = useState(false); // eslint-disable-line no-unused-vars
  const [speaking, setSpeaking] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const handsFreeRef = useRef(false);
  const busyRef = useRef(false);
  const requestReplyRef = useRef(null);
  const canSpeak = voiceReady && isSynthesisSupported();
  const canHandsFree = voiceReady && isRecognitionSupported() && canSpeak;

  // Le panneau et son lanceur flottent au-dessus des overlays, donc ils doivent
  // rester atteignables à la Tab pendant qu'un overlay modal est ouvert — sans
  // quoi le bouton serait visible à l'œil et hors d'atteinte au clavier. Voir
  // `useFocusExempt` : le registre est la seule chose que ce composant et
  // `HeroCube` partagent, et elle ne crée aucune dépendance entre les deux.
  useFocusExempt([panelRef, launcherRef]);

  // Descend avec la conversation : le texte arrive fragment par fragment, donc
  // on se cale sur chaque delta pour rester collé à la dernière ligne écrite.
  useEffect(() => {
    const node = listRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Révèle les boutons voix après le montage : `window` n'existe qu'au
  // navigateur, et Firefox n'expose pas `SpeechRecognition`. Sans ce second
  // rendu, le micro resterait masqué même sur Chrome ; sans la détection, il
  // s'afficherait muet sur Firefox.
  useEffect(() => {
    setVoiceReady(true);
    return () => {
      // Démonter en pleine reconnaissance ou lecture : arrêter les deux évite de
      // parler à un panneau qui n'existe plus. `speechSynthesis` est lu dans
      // le nettoyage, pas au rendu, pour ne jamais toucher `window` en SSR.
      // La boucle mains libres s'éteint avec le panneau, même raison que
      // `close` : pas de micro sans panneau visible.
      handsFreeRef.current = false;
      try {
        dictationRef.current?.abort?.();
      } catch {}
      try {
        if (typeof window !== "undefined" && window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
      } catch {}
    };
  }, []);

  const close = useCallback(() => {
    slotRef.current?.cancelCurrent();
    // Couper la reconnaissance et la lecture à la fermeture : sans ça, la
    // transcription remplirait un panneau démonté et la voix continuerait
    // de lire une bulle que le visiteur ne regarde plus. La boucle mains
    // libres s'éteint avec : rouvrir le panneau ne doit pas rouvrir le micro
    // sans un geste explicite — un micro qui se rallume seul est un défaut de
    // confidentialité, pas une commodité.
    handsFreeRef.current = false;
    setHandsFree(false);
    try {
      dictationRef.current?.abort?.();
    } catch {}
    try {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    } catch {}
    setListening(false);
    setSpeaking(false);
    setOpen(false);
    // Le champ de saisie est démonté avec le panneau : sans ça le focus tombe
    // sur `body` et le clavier repart du haut de la page. On le rend au bouton
    // lanceur, qui est le point de retour logique.
    launcherRef.current?.focus?.();
  }, []);

  // Échap referme le panneau. Pas de piège de focus ici : le widget n'est pas
  // modal — il laisse la page sous-jacente tabulable, ce qui est le bon
  // comportement pour une bulle d'aide. `close` et non `setOpen(false)` : il
  // faut aussi arrêter la requête en vol.
  useEscapeKey(open, close);

  const reset = useCallback(() => {
    slotRef.current?.cancelCurrent();
    try {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    } catch {}
    setSpeaking(false);
    // Effacer la conversation coupe aussi la boucle mains libres : la réponse
    // que la boucle s'apprêtait à lire n'existe plus, et le micro rouvrirait
    // sur un fil vide.
    handsFreeRef.current = false;
    setHandsFree(false);
    try {
      dictationRef.current?.abort?.();
    } catch {}
    setListening(false);
    setMessages([]);
    setError(null);
    setBusy(false);
    busyRef.current = false;
    requestReplyRef.current = null;
    setRetry(0);
    inputRef.current?.focus();
  }, []);

  async function send(eventOrContent, maybeBusy, maybeHandsFree) {
    // Appelé depuis le formulaire (événement) ou depuis la boucle mains libres
    // (chaîne). Le second argument n'existe que pour l'appel interne : il
    // transmet l'état `busy` lu au moment du callback, pas celui figé dans la
    // closure du `send` précédent. Le troisième dit si l'envoi vient du mains
    // libres : le Worker ajoute alors une consigne de brièveté orale (l'essentiel
    // + renvoi vers la page, pas de détails lus à voix haute).
    const fromEvent = typeof eventOrContent?.preventDefault === "function";
    if (fromEvent) eventOrContent.preventDefault();
    const content = (fromEvent ? draft : eventOrContent).trim();
    const isBusy = fromEvent ? busy : maybeBusy;
    // Depuis le formulaire, le mains libres ne change rien à l'envoi : seul
    // l'envoi vocal demande la version courte. `handsFreeRef` et non
    // `handsFree` : après des `await`, le state en closure est périmé.
    const fromHandsFree = fromEvent ? false : maybeHandsFree === true;
    if (!content || isBusy) return;

    // La reconnaissance s'arrête à l'envoi : garder le micro ouvert remplirait le
    // nouveau brouillon vide pendant que le visiteur croit parler à l'ancien.
    // En mains libres aussi : c'est le `finally` qui relancera l'écoute après
    // la lecture, pas la session qui vient de parler.
    try {
      dictationRef.current?.abort?.();
    } catch {}
    setListening(false);

    const history = [...messages, { role: "user", content }];
    // Bulle vide réservée à la réponse en cours, remplie delta par delta.
    setMessages([...history, { role: "assistant", content: "" }]);
    setDraft("");
    setError(null);
    setBusy(true);
    busyRef.current = true;
    // Supposée vide jusqu'à preuve du contraire : la boucle mains libres lit
    // la réponse ici plutôt que dans `messages`, qu'elle ne peut pas lire
    // sans closure périmée après les `await`.
    requestReplyRef.current = null;

    const request = slotRef.current.begin();

    try {
      // Relance automatique : toute erreur repart, sans exception. Seule
      // l'annulation du visiteur sort de la boucle, relance n'ayant pas de sens
      // pour une requête à laquelle il a mis fin lui-même.
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          if (attempt > 0) {
            // Backoff croissant : laisse le temps au service de se rétablir
            // après un pic de charge, sans faire attendre un simple 400.
            await sleep(500 * attempt, request.signal);
          // Réponse éventuellement écrite avant l'échec : on la jette, sinon
            // le texte partiel et la nouvelle réponse s'afficheraient collés
            // l'un à l'autre. La ref suit le même sort : elle ne doit porter
            // que la réponse complète, jamais un fragment d'échec.
            setMessages((prev) =>
              prev[prev.length - 1]?.role === "assistant"
                ? [...prev.slice(0, -1), { role: "assistant", content: "" }]
                : prev,
            );
            requestReplyRef.current = null;
            setRetry(attempt);
          }

          const res = await fetch(ENDPOINT, {
            method: "POST",
            // La langue part dans un en-tête *et* dans le corps.
            //
            // L'en-tête d'abord : le Worker doit traduire ses rejets précoces —
            // méthode, origine, taille — et ces rejets arrivent avant que le corps
            // soit lu. Un `lang` dans le JSON seul arriverait trop tard, et un
            // visitor anglophone se ferait répondre en français à une erreur qu'il cherche
            // à comprendre. L'en-tête est donc déclaré dans le preflight CORS du
            // Worker ; s'il en manquait un, le navigateur le retirerait de la
            // requête et le bilinguisme échouerait en silence.
            //
            // Le corps en supplément : il sert aux requêtes sans cet en-tête — un
            // ancien client, un `curl` — et évite d'avoir à modifier deux choses
            // pour ajouter une langue.
            //
            // Les deux viennent de la page, jamais de la question : la langue se
            // choisit en haut de l'écran, pas en écrivant. Un visiteur anglophone
            // qui écrit en français sur la page anglaise attend une réponse en
            // anglais.
            headers: { "Content-Type": "application/json", "X-Chat-Lang": lang },
            body: JSON.stringify({
              lang,
              // `handsfree: true` seulement sur l'envoi vocal : le Worker y
              // ajoute une consigne de brièveté orale. `false` ou absent à
              // l'écrit — la réponse complète reste la bonne quand on relit.
              ...(fromHandsFree ? { handsfree: true } : {}),
              messages: history.slice(-HISTORY_LIMIT).map(({ role, content: text }) => ({
                role,
                content: text,
              })),
            }),
            signal: request.signal,
          });

          if (!res.ok || !res.body) {
            // Le Worker renvoie toujours `{ error }` sur une erreur, déjà rédigé
            // pour le visiteur : on le montre tel quel.
            let message = t.serviceDown;
            let retryable = true;
            try {
              const data = await res.json();
              if (data?.error) message = data.error;
            } catch {
              // Pas de JSON lisible (HTML d'erreur, réseau coupé) : texte par défaut.
            }
            // 403 : la demande a été lue puis refusée (modération, garde-fou,
            // permissions). Le message du Worker est alors définitif, et surtout
            // identique à chaque tentative : on ne le relance pas.
            //
            // 429 : la jauge du Worker est à cran, et le message dit « Réessayez
            // dans 60 s ». Relancer tout de suite produirait deux requêtes
            //parties dans la même minute, donc deux nouveaux 429, et le visiteur
            // verrait son message contredit par trois tentatives inutiles.
            if (res.status === 403 || res.status === 429) retryable = false;

            throw Object.assign(new Error(message), { retryable });
          }

          const hasContent = await readStream(res.body, (delta) => {
            requestReplyRef.current = {
              ok: true,
              text: `${requestReplyRef.current?.text ?? ""}${delta}`,
            };
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              next[next.length - 1] = { ...last, content: last.content + delta };
              return next;
            });
          }, t);

          // Flux terminé sans un seul caractère affichable : le modèle n'a émis
          // que sa ligne de fuite, et le filtre l'a retirée. Sans ce test, la
          // boucle se concluait sur `break` et laissait au visiteur une bulle
          // muette, sans erreur et sans aucun moyen de réessayer. On transforme
          // donc ce silence en relance : si le nouveau tirage répond, le trou est
          // invisible, et sinon l'erreur affichée plus bas est au moins une
          // consigne claire plutôt qu'un vide. La ref est vidée avec, pour la
          // même raison que la bulle ci-dessus : pas de lecture d'un fragment.
          if (!hasContent) {
            requestReplyRef.current = null;
            throw emptyAnswerError(t);
          }

          break; // Réponse reçue en entier : plus rien à relancer.
        } catch (err) {
          // Un refus de modération ou de modèle ne change pas d'une tentative à
          // l'autre : le relancer consommerait trois requêtes pour aboutir au
          // même refus.
          if (err?.retryable === false) throw err;
          // Délai expiré : relancer ne servirait à rien puisque le minuteur
          // couvre tout le `send`, il ne recommencera donc pas. On laisse
          // remonter, et le `catch` d'après affiche un message dédié.
          if (err?.name === "AbortError") throw err;
          // Dernière tentative : on laisse l'erreur remonter, c'est elle qu'on
          // affiche au visiteur.
          if (attempt === MAX_RETRIES) throw err;
        }
      }
    } catch (err) {
      // Timeout : ce n'est pas un départ du visiteur, c'est une panne ou un
      // silence du service. Le distinguer compte — sans ce test, un délai expiré
      // produirait le même silence qu'une fermeture, alors que le premier mérite
      // un message et que le second ne mérite rien. La relance a déjà eu lieu
      // plus haut : le délai couvre le `send` entier, il n'a donc pas été
      // retenté ici.
      if (err?.name === "AbortError" && request.timedOut()) {
        // Timeout : ce n'est pas un départ du visiteur, c'est une panne ou un
        // silence du service. Le distinguer compte — sans ce test, un délai expiré
        // produirait le même silence qu'une fermeture, alors que le premier mérite
        // un message et que le second n'en mérite aucun. La relance a déjà eu lieu
        // plus haut : le délai couvre le `send` entier, il n'a donc pas été retenté.
        setError(t.timeout);
        // La bulle vide est retirée : rien n'a été affiché, la laisser produirait
        // une bulle muette sous une bannière d'erreur.
        setMessages((prev) =>
          prev[prev.length - 1]?.role === "assistant" && !prev[prev.length - 1].content
            ? prev.slice(0, -1)
            : prev,
        );
      } else if (err?.name !== "AbortError") {
        setError(err?.message ?? t.genericError);
        // Pas de bulle d'erreur dupliquée dans le fil : elle vit dans la bannière.
        setMessages((prev) =>
          prev[prev.length - 1]?.role === "assistant" && !prev[prev.length - 1].content
            ? prev.slice(0, -1)
            : prev,
        );
      }
      // `AbortError` sans expiration : le visiteur a fermé le panneau ou relancé
      // une question — il n'est plus là pour lire une erreur, et le texte partiel
      // déjà affiché suffit.
    } finally {
      setBusy(false);
      busyRef.current = false;
      setRetry(0);
      // `finish()` ne libère la place et n'annule le délai que si cette requête
      // est encore la courante. C'est la propriété qui corrige la course : le
      // `finally` d'un envoi plus ancien ne peut ni voler le contrôleur d'un envoi
      // plus récent, ni annuler son délai.
      request.finish();
      // Réponse complète (bulle non vide et pas d'erreur) : en mains libres,
      // on la lit à voix haute, et c'est la fin de la lecture qui rouvre le
      // micro. En cas d'échec, on rouvre directement : le visiteur doit pouvoir
      // reformuler sans toucher à rien. `handsFreeRef` et non `handsFree` :
      // ce `finally` s'exécute après des `await`, le state a pu changer entre
      // temps — seule la ref dit si la boucle court encore.
      if (handsFreeRef.current) {
        const last = requestReplyRef.current;
        requestReplyRef.current = null;
        if (last?.ok && last?.text) speakReply(last.text, true);
        else startHandsFreeListening();
      }
    }
  }

  // Le panneau ne s'affiche pas si le Worker n'est pas configuré. Le retour
  // arrive APRÈS tous les hooks : les mettre avant ferait dépendre le nombre de
  // hooks appelés d'une constante, ce qui casse la règle d'appel inconditionnel.
  //
  // Les fonctions voix suivent pour la même raison : elles lisent `lang`
  // via `t` déjà calculé, mais restent déclarées avant tout `return`.
  /**
   * Lit un texte à voix haute.
   *
   * Extrait de `toggleSpeech` : la boucle mains libres doit lire sans bascule,
   * et `speakReply` partage avec `toggleSpeech` la construction de l'énoncé.
   * `fromHandsFree` ne change que la fin : la lecture relance l'écoute, pour
   * boucler sans appui. Le texte est nettoyé du Markdown avant lecture : sans
   * ça, la voix épelle les `**` et les `#`. `speakableText` corrige ensuite
   * deux prononciations (`CV` lu « chevaux », `@` lu « at ») : l'affichage
   * garde le texte d'origine, seule la voix entend la version corrigée.
   *
   * @param {string} html `content` de la bulle assistant.
   * @param {boolean} [fromHandsFree] relancer l'écoute à la fin.
   */
  const speakReply = (html, fromHandsFree = false) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      // Synthèse absente en cours de boucle : on rouvre quand même le micro,
      // pour que le visiteur puisse continuer à dicter plutôt que de rester
      // bloqué sur un mode à moitié actif.
      if (fromHandsFree) startHandsFreeListening();
      return;
    }
    const synthesis = window.speechSynthesis;
    const text = speakableText(stripMarkdown(html ?? ""), lang);
    if (!text) {
      if (fromHandsFree) startHandsFreeListening();
      return;
    }
    try {
      synthesis.cancel();
    } catch {}
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = speechLocale(lang);
    const voice = pickVoice(synthesis.getVoices?.() ?? [], lang);
    if (voice) utterance.voice = voice;
    utterance.onend = () => {
      setSpeaking(false);
      if (fromHandsFree && handsFreeRef.current) startHandsFreeListening();
    };
    utterance.onerror = () => {
      setSpeaking(false);
      if (fromHandsFree && handsFreeRef.current) startHandsFreeListening();
    };
    try {
      synthesis.speak(utterance);
      setSpeaking(true);
    } catch {
      setSpeaking(false);
      if (fromHandsFree && handsFreeRef.current) startHandsFreeListening();
    }
  };

  /**
   * Lit une réponse à voix haute, ou coupe la lecture en cours.
   *
   * Le texte est nettoyé du Markdown avant lecture : sans ça, la voix épelle
   * les `**` et les `#`. `speakableText` corrige ensuite deux prononciations
   * (`CV` lu « chevaux », `@` lu « at »). La lecture est coupée avant d'en lancer une autre —
   * une bulle ne parle jamais par-dessus la précédente. Couper la lecture
   * coupe aussi la boucle mains libres : c'est elle qui lisait, et un arrêt
   * explicite vaut pour les deux.
   *
   * @param {string} html `content` de la bulle assistant.
   */
  const toggleSpeech = (html) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const synthesis = window.speechSynthesis;
    if (speaking) {
      stopHandsFree();
      try {
        synthesis.cancel();
      } catch {}
      setSpeaking(false);
      return;
    }
    speakReply(html);
  };

  /**
   * Ouvre le micro pour un tour de boucle mains libres.
   *
   * La session est à tir unique (`continuous: false`) : chaque pause du
   * visiteur clôt un résultat final, qui part seul par le circuit normal.
   * Un micro continu remplirait le brouillon sans jamais l'envoyer — la
   * boucle attendrait un envoi qui ne viendrait pas. Le résultat final part
   * avec `busyRef` lu au moment du callback, pas le `busy` figé de la
   * closure, sinon un envoi en cours laisserait passer un doublon. Le `true`
   * final dit à `send` que l'envoi est vocal : le Worker ajoute la consigne
   * de brièveté orale.
   */
  const startHandsFreeListening = () => {
    if (!handsFreeRef.current) return;
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      stopHandsFree();
      return;
    }
    try {
      dictationRef.current?.abort?.();
    } catch {}
    const recognition = new Ctor();
    dictationRef.current = recognition;
    recognition.lang = speechLocale(lang);
    recognition.interimResults = true;
    recognition.continuous = false;
    // `maxAlternatives = 1` : la première hypothèse suffit, les suivantes ne
    // serviraient qu'en cas de relecture manuelle, qu'on ne propose pas.
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      // Seul le résultat final part : les intermédiaires remplissent le
      // brouillon en direct, pour que le visiteur voie ce qui est entendu.
      let interim = "";
      let final = "";
      for (const result of event.results) {
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) final += text;
        else interim += text;
      }
      const heard = (final || interim).trim();
      if (heard) setDraft(heard.slice(0, 4000));
      // Ordre d'arrêt vocal : dire `stop` coupe la boucle au lieu d'être
      // envoyé au modèle. Exact seulement — « parle-moi du stop du cube »
      // contient le mot sans être un ordre et part normalement.
      if (final.trim() && isStopCommand(final, lang)) {
        stopHandsFree();
        return;
      }
      if (final.trim()) send(final, busyRef.current, true);
    };
    recognition.onerror = (event) => {
      // `not-allowed` = micro refusé : le seul cas qui mérite un message, car
      // un bouton qui reste muet après un refus ressemble à une panne. Le mode
      // s'arrête : relancer en boucle sur un refus afficherait le message à
      // chaque tour sans jamais entendre personne.
      if (event?.error === "not-allowed" || event?.error === "service-not-allowed") {
        setError(t.voiceDenied);
        stopHandsFree();
        return;
      }
      // `no-speech` = silence, `aborted` = bascule vers l'envoi : la session
      // est morte, mais la boucle ne l'est pas — `onend` la relancera.
      setListening(false);
    };
    // `onend` suit chaque arrêt : fin de phrase, silence, envoi. Tant que la
    // boucle court et qu'aucune requête n'est en vol, on rouvre le micro —
    // c'est ce qui rend la conversation continue sans appui répété. Pendant
    // l'envoi et la lecture, on ne rouvre rien : c'est le `finally` de `send`
    // qui relancera après la réponse lue.
    recognition.onend = () => {
      setListening(false);
      if (handsFreeRef.current && !busyRef.current) startHandsFreeListening();
    };

    try {
      recognition.start();
      setListening(true);
      setError(null);
    } catch {
      // Micro déjà ouvert par un autre onglet, ou double appui rapide : on
      // laisse la main à la session en cours, sans éteindre le mode.
      setListening(false);
    }
  };

  /**
   * Coupe la boucle mains libres, micro et lecture compris.
   *
   * Le double `handsFree` / `handsFreeRef` s'éteint ensemble : le state pour
   * le rendu, la ref pour les callbacks différés qui ne reverront jamais le
   * nouveau state. `onend` et `utterance.onend` testent la ref, donc couper
   * ici suffit à empêcher toute relance — aucun drapeau supplémentaire.
   */
  const stopHandsFree = () => {
    handsFreeRef.current = false;
    setHandsFree(false);
    try {
      dictationRef.current?.abort?.();
    } catch {}
    try {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    } catch {}
    setListening(false);
    setSpeaking(false);
  };

  /**
   * Bascule la boucle mains libres.
   *
   * À l'arrêt, tout s'éteint via `stopHandsFree`. Au démarrage, toute
   * session de reconnaissance en cours est coupée : la boucle mains libres
   * prend sa propre session à tir unique.
   */
  const toggleHandsFree = () => {
    if (handsFreeRef.current) {
      stopHandsFree();
      return;
    }
    try {
      dictationRef.current?.abort?.();
    } catch {}
    setListening(false);
    handsFreeRef.current = true;
    setHandsFree(true);
    startHandsFreeListening();
  };

  if (!ENDPOINT) return null;

  const canSend = draft.trim().length > 0 && !busy;
  const lastIsPending = busy && messages[messages.length - 1]?.role === "assistant";

  return (
    <>
      {/* Panneau. `z-[70]` le place au-dessus des deux overlays plein écran —
          contact (`z-[60]`) et rubrique projet (`z-50`) — pour qu'une question
          au chatbot reste posable depuis une fiche, sans avoir à refermer
          l'overlay d'abord. L'ordre tient parce que ces overlays sont frères de
          la section du cube, et non enfants : `z-10` + `relative` faisait de la
          section un contexte d'empilement, où leurs `z-50` ne se comparaient
          qu'à lui.

          Il reste sous le verrou d'orientation (`z-[100]`), qui n'est pas un
          overlay mais un mur : un mobile en paysage n'a rien à montrer ici, et
          un bouton de discussion par-dessus n'y servirait à personne. */}
      {open && (
        <>
          {/* Voile mobile : le panneau y fait presque plein écran (`inset-x-4`),
              donc la page derrière doit s'effacer — sinon le visiteur lit deux
              couches à la fois. Sur desktop le panneau n'est qu'une bulle en
              coin (`sm:w-96`), un voile plein écran y serait intrusif : `sm:hidden`.
              `z-[69]`, juste sous le panneau et le lanceur (`z-[70]`) mais
              au-dessus des overlays contact (`z-[60]`) et projet (`z-50`) :
              ouvrir le chat depuis une fiche assombrit la fiche, et le refermer
              la révèle intacte. Un clic dessus referme — le geste de sortie
              naturel au tactile. `aria-hidden`, non focusable : le widget reste
              non modal au clavier, comme avant. */}
          <div
            data-chat-backdrop
            aria-hidden="true"
            onClick={close}
            className="fixed inset-0 z-[69] bg-[#0a0f1c]/70 sm:hidden"
          />
          <section
            id="chat-panel"
            ref={panelRef}
            aria-label={t.assistant}
            className="fixed inset-x-4 top-20 z-[70] flex max-h-[calc(var(--svh)-7rem)] flex-col overflow-hidden rounded-2xl border border-[#1e293b] bg-[#0f172a]/95 shadow-2xl shadow-black/50 backdrop-blur-md sm:inset-x-auto sm:right-8 sm:w-96"
          >
          <header className="flex items-center justify-between gap-3 border-b border-[#1e293b] px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageCircle size={16} className="text-[#00a5b0]" />
              <p className="text-xs uppercase tracking-widest text-[#94a3b8]">
                {t.heading}
              </p>
            </div>
            <button
              type="button"
              onClick={reset}
              aria-label={t.clear}
              disabled={messages.length === 0}
              className="text-[#7c8ca1] transition-colors duration-200 hover:text-[#00a5b0] disabled:cursor-not-allowed disabled:opacity-30"
            >
              <RotateCcw size={16} />
            </button>
          </header>

          {/* `aria-live` sur une région stable : c'est le seul moyen d'entendre
              les réponses qui s'écrivent. Posé sur une bulle conditionnelle, il
              serait recréé à chaque fragment et resterait muet. */}
          <div
            ref={listRef}
            aria-live="polite"
            aria-atomic="false"
            className="scroll-none flex-1 overflow-y-auto px-4 py-4"
          >
            {messages.length === 0 && (
              <p className="text-sm leading-relaxed text-[#94a3b8]">
                {t.greeting}
              </p>
            )}

            <ul className="space-y-4">
              {messages.map((message, index) => {
                const isUser = message.role === "user";
                // Une bulle assistant vide et encore en cours = indicateur de frappe.
                const isPending = lastIsPending && !isUser && !message.content;

                return (
                  <li
                    key={index}
                    className={isUser ? "flex justify-end" : "flex justify-start"}
                  >
                    <div
                      className={
                        isUser
                          ? "max-w-[85%] rounded-2xl rounded-br-sm bg-[#00a5b0] px-3 py-2 text-sm text-[#0a0f1c]"
                          : "max-w-[85%] rounded-2xl rounded-bl-sm border border-[#1e293b] bg-[#0a0f1c] px-3 py-2 text-sm leading-relaxed text-[#e2e8f0]"
                      }
                    >
                      {isPending ? (
                        <span className="flex items-center gap-2 py-1 text-[#7c8ca1]">
                          <Loader2 size={14} className="animate-spin" />
                          {/* `retry` > 0 = la requête précédente a échoué et
                              repart. Sans ce libellé, le backoff est un silence
                              qui ressemble à un blocage. */}
                          <span className="text-xs">
                            {retry > 0 ? t.writingRetry(retry, MAX_RETRIES) : t.writing}
                          </span>
                        </span>
                      ) : (
                        <>
                          <span className="whitespace-pre-wrap break-words">
                            {isUser ? message.content : stripMarkdown(message.content)}
                          </span>
                          {/* Lecture vocale : chaque réponse de l'assistant porte
                              son bouton, car c'est la seule unité de lecture qui
                              a du sens — lire toute la conversation d'un coup
                              relirait les questions du visiteur. Masqué sans
                              support (Firefox sans synthèse) et pendant la
                              génération, où la bulle n'est pas encore complète
                              et la voix lirait un texte tronqué. */}
                          {!isUser && canSpeak && !lastIsPending && message.content && (
                            <span className="mt-1 flex justify-end">
                              <button
                                type="button"
                                onClick={() => toggleSpeech(message.content)}
                                aria-label={speaking ? t.stopReading : t.listen}
                                aria-pressed={speaking}
                                className="flex h-7 w-7 items-center justify-center rounded-md text-[#7c8ca1] transition-colors duration-200 hover:bg-[#00a5b0]/10 hover:text-[#00a5b0]"
                              >
                                {speaking ? <Square size={14} /> : <Volume2 size={14} />}
                              </button>
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {error && (
              <p role="alert" className="mt-4 rounded-lg border border-[#d900a8]/40 bg-[#d900a8]/10 px-3 py-2 text-xs leading-relaxed text-[#e2e8f0]">
                {error}
              </p>
            )}
          </div>

          <form onSubmit={send} className="border-t border-[#1e293b] p-3">
            <div className="flex items-center gap-2">
              <label htmlFor="chat-input" className="sr-only">
                {t.inputLabel}
              </label>
              <input
                id="chat-input"
                ref={inputRef}
                type="text"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={t.placeholder}
                maxLength={4000}
                autoComplete="off"
                aria-describedby={handsFree ? "chat-voice-status" : undefined}
                className="min-w-0 flex-1 rounded-lg border border-[#1e293b] bg-[#0a0f1c] px-3 py-2 text-sm text-[#e2e8f0] placeholder:text-[#7c8ca1] focus:border-[#00a5b0] focus:outline-none"
              />
              {/* Mains libres : le bouton n'existe que si le navigateur sait à
                  la fois transcrire ET lire. Masqué sans support — pas d'erreur.
                  Un second appui coupe la boucle, micro et lecture compris. */}
              {canHandsFree && (
                <button
                  type="button"
                  onClick={toggleHandsFree}
                  aria-label={handsFree ? t.voiceStopHandsFree : t.voiceHandsFree}
                  aria-pressed={handsFree}
                  className={
                    handsFree
                      ? "flex h-10 w-10 shrink-0 animate-pulse items-center justify-center rounded-lg bg-[#d900a8] text-white transition-colors duration-200 hover:bg-[#d900a8]/80"
                      : "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#1e293b] text-[#7c8ca1] transition-colors duration-200 hover:border-[#00a5b0] hover:text-[#00a5b0]"
                  }
                >
                  {handsFree ? <Square size={16} /> : <Mic size={16} />}
                </button>
              )}
              <button
                type="submit"
                disabled={!canSend}
                aria-label={t.send}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#00a5b0] text-[#0a0f1c] transition-colors duration-200 hover:bg-[#00b0bd] disabled:cursor-not-allowed disabled:opacity-30"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
            {/* Statut d'écoute annoncé aux lecteurs d'écran : sans lui, un
                visiteur aveugle active le micro sans savoir s'il est entendu.
                En mains libres, le statut dit que la boucle court : le micro
                se rouvre seul après chaque réponse, et sans ce rappel le
                visiteur croirait le micro coupé entre deux tours. */}
            {handsFree && (
              <p id="chat-voice-status" role="status" className="mt-2 flex items-center gap-1.5 text-[10px] leading-relaxed text-[#d900a8]">
                <Mic size={12} aria-hidden="true" />
                {t.voiceHandsFreeActive}
              </p>
            )}
            <p className="mt-2 text-[10px] leading-relaxed text-[#7c8ca1]">
              {t.disclaimer}
            </p>
          </form>
          </section>
        </>
      )}

      {/* Lanceur, en haut à droite. Même `z-[70]` que le panneau, pour qu'il reste
          atteignable au-dessus d'un overlay ouvert : c'est par lui qu'on referme
          le panneau. Le bouton « retour en haut » du cube reste en bas à droite :
          plus de conflit de coin, donc plus d'empilement. */}
      <button
        ref={launcherRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-controls="chat-panel"
        aria-label={open ? t.close : t.open}
        className="fixed top-4 right-4 z-[70] flex h-11 w-11 items-center justify-center rounded-full border border-[#00a5b0]/60 bg-[#0a0f1c]/80 text-[#00a5b0] backdrop-blur-md transition-colors duration-300 hover:bg-[#00a5b0]/10 hover:text-white sm:top-6 sm:right-8"
      >
        {open ? <X size={20} /> : <MessageCircle size={20} />}
      </button>
    </>
  );
}
