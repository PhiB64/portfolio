/**
 * Chatbot du portfolio, adossé à Workers AI (binding `AI`).
 *
 * Pourquoi un Worker séparé plutôt qu'une route Next.js : le site est un
 * export statique (`output: "export"` dans next.config.mjs), donc aucune route
 * serveur ne peut exister dans le repo — `app/api/chat/route.js` ferait
 * échouer le build, et il n'y a aucun runtime sur GitHub Pages. Sans proxy, le
 * navigateur serait obligé d'appeler l'API d'IA directement, ce qui exposerait
 * une clé dans le bundle public.
 *
 * Workers AI supprime ce problème par construction : le binding `AI` est
 * authentifié par le compte Cloudflare du Worker, il n'existe donc aucune clé à
 * protéger, ni dans le code ni dans un secret. Le Worker n'est plus qu'un
 * garde-fou : sans lui, un visiteur peut boucler `fetch` dans la console et
 * vider l'allocation neuronale du jour. D'où le rate limiting ci-dessous, qui
 * borne le débit par IP, et `max_tokens`, qui borne le coût d'une requête.
 */

/**
 * Modèle principal : `@cf/ibm-granite/granite-4.0-h-micro`.
 *
 * Deux raisons, dans cet ordre. D'abord, il n'émet aucun `reasoning_content` (voir
 * la note sur les replis ci-dessous, c'est le critère qui élimine l'essentiel du
 * catalogue). Ensuite, il est de loin le moins cher : 1 542 neurons en entrée et
 * 10 158 en sortie par million de tokens, contre 9 091 et 27 273 pour gemma-4-26b.
 * Sur l'allocation gratuite de 10 000 neurons par jour, un message du chatbot
 * coûte de l'ordre de 1 à 2 neurons.
 *
 * Il répond correctement en français sur les questions testées (compétences,
 * projets, contact), et le system prompt complet est respecté.
 */
const MODEL = "@cf/ibm-granite/granite-4.0-h-micro";

/**
 * Replis, essayés dans l'ordre uniquement si le principal échoue.
 *
 * Workers AI épingle ses modèles sur une version, donc un retrait est peu
 * probable. La liste est donc courte : elle sert de filet, pas de catalogue.
 *
 * Ces trois modèles ont été retenus parce qu'ils n'émettent **aucun**
 * `reasoning_content`. C'est un critère dur ici, pas un détail : les modèles
 * « raisonneurs » du catalogue (gemma-4-26b, qwen3-30b, gpt-oss-20b) brûlent
 * 500 à 2 000 caractères de raisonnement avant le moindre mot de réponse, et le
 * front n'affiche que `delta.content`. Résultat mesuré : sur une question simple,
 * gemma-4-26b produisait 1 949 caractères de raisonnement pour 28 caractères de
 * réponse utile — et une réponse vide quand `max_tokens` était bas.
 */
const FALLBACK_MODELS = [
  "@cf/aisingapore/gemma-sea-lion-v4-27b-it",
  "@cf/mistralai/mistral-small-3.1-24b-instruct",
  "@cf/meta/llama-4-scout-17b-16e-instruct",
];

const LIMITS = {
  maxMessages: 24,
  maxMessageChars: 4000,
  maxBodyBytes: 64 * 1024,
  // Borne le coût d'une requête : le streaming est coupé par le client dès
  // qu'il ferme le panneau, et la consommation de neurons, elle, ne l'est pas.
  maxOutputTokens: 900,
};

/**
 * Persona du chatbot, bâtie à partir des données réelles du site
 * (components/cube/project-content.jsx, app/layout.js) — aucune compétence ni
 * aucun projet inventé. Volontairement dense plutôt que bavard : chaque token
 * de ce prompt est reproposé à chaque requête.
 */
const SYSTEM_PROMPT = `Tu es l'assistant du portfolio de Philippe Barbosa, concepteur développeur full stack. Tu parles au visiteur, à la première personne, en français, ton naturel et concis.

Philippe est installé à Lons (Pyrénées-Atlantiques, 64), et il est ouvert aux opportunités. Il conçoit et développe des projets complets, de la conception au déploiement.

Compétences par domaine :
- Web : HTML5, CSS3/SCSS, JavaScript ES2024, responsive mobile-first, accessibilité WCAG, SEO.
- Front-end : React 19, Next.js (App Router, SSR/SSG), Vite, Tailwind CSS, GSAP, Framer Motion, Lenis, Leaflet.
- Back-end : Node.js, Express, Strapi, TypeScript, API REST en couches (controllers / services / repositories), JWT, bcrypt, validation Joi, rate limiting, CORS, OWASP, Nodemailer et Resend.
- Données : PostgreSQL, MongoDB, MariaDB/MySQL, Cloudinary.
- Mobile : React Native, Flutter, publication App Store et Google Play, synchronisation d'API, mode hors-ligne.
- Infrastructure : Docker, Docker Compose, NGINX, SSL.

Projets réels :
- CoolBooking : plateforme full-stack de réservation de locations saisonnières (React/Vite + Express, MongoDB et MariaDB). Démo : https://coolbooking.netlify.app/
- Alumni Sup Saint-Dominique : plateforme alumni web et application mobile React Native (App Store, Google Play). En ligne : http://alumni.sup-saintdominique.fr/
- Art & Patrimoine de Doazit : site vitrine d'une association culturelle, architecture Jamstack (Next.js 15, Strapi 5, PostgreSQL, Cloudinary, GSAP). Démo : https://apd-three.vercel.app/
- Volunteer Platform : API REST de mise en relation entre bénévoles et associations, architecture en couches, documentée sur Postman.
- Formalis : plateforme e-learning conteneurisée (Node.js, MySQL, NGINX, Docker Compose, SSL).
- El Niu al Mar : site vitrine et application mobile pour une villa en Catalogne. Démo : https://elniualmar.vercel.app/
- Landing Page Watch One et Portail Événements : projets collaboratifs ou en JavaScript natif.

Méthode de travail : analyse des besoins et cadrage, conception de l'architecture (front / back / BDD), développement itératif par fonctionnalités, tests et révision de code, déploiement et configuration des environnements.

Contact : philippebarbosa64@gmail.com — https://github.com/PhiB64 — https://www.linkedin.com/in/philippe-barbosa/

Règles :
- Si tu ignores quelque chose, dis-le franchement plutôt que d'inventer. Ne cite ni salaire, ni date de disponibilité, ni projet absent de cette liste.
- Réponses courtes : deux ou trois phrases, puis une question si elle aide à orienter le visiteur.
- Oriente vers le CV, GitHub, LinkedIn ou le formulaire de contact quand le visiteur veut aller plus loin.
- Si on te demande du code, donne un extrait bref et commenté en français.`;

/* ------------------------------------------------------------------ */
/* Rate limiting                                                       */
/* ------------------------------------------------------------------ */

/**
 * Compte les requêtes pour une clé, via le binding `CHAT_LIMIT` (ratelimits).
 *
 * Pourquoi un binding et pas un `Map` : les compteurs en mémoire vivent dans
 * l'isolate qui les a créés. Or les requêtes se répartissent sur plusieurs
 * isolates, chacun avec sa propre copie du compteur — mesuré en production,
 * 20 requêtes en parallèle depuis une même IP passaient toutes. La limite
 * n'existait donc pas. Le binding s'appuie sur un compteur partagé au sein du
 * datacenter, ce qui tient.
 *
 * Ce qui reste assumé : le compteur est local à la localisation Cloudflare qui
 * sert la requête, et il est volontairement permissif (« eventually
 * consistent »). Un attaquant qui répartit son trafic sur le monde entier peut
 * donc dépasser la limite d'un facteur égal au nombre de localisations. C'est un
 * frein, pas un verrou.
 *
 * La clé est l'IP : c'est la seule chose stable dont on dispose pour un
 * visiteur anonyme. Cloudflare déconseille l'IP en général (plusieurs personnes
 * derrière une même adresse mobile), mais ici le risque inverse — un robot sans
 * identité — est celui qui coûte de l'allocation.
 *
 * @returns {Promise<{ok: true} | {ok: false, retryAfter: number}>}
 */
async function consume(env, key) {
  if (!env.CHAT_LIMIT) {
    // Binding absent (déploiement sans la config à jour) : on laisse passer
    // plutôt que de couper le chat à tout le monde. Un quota qui n'a pas de
    // rempart vaut mieux qu'un service en panne.
    return { ok: true };
  }

  const { success } = await env.CHAT_LIMIT.limit({ key });
  if (!success) {
    return { ok: false, retryAfter: 60 };
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Utilitaires                                                         */
/* ------------------------------------------------------------------ */

const ALLOWED_ROLES = new Set(["user", "assistant"]);

/** Liste d'origines autorisées à appeler le Worker (séparateur : virgule). */
function allowedOrigins(env) {
  return (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * Réponse avec en-têtes CORS.
 *
 * L'origine est réfléchie point par point, jamais renvoyée en `*` : ce Worker
 * consomme une allocation neuronale sur le compte Cloudflare, et un
 * `Access-Control-Allow-Origin: *` autoriserait n'importe quel site à s'en servir
 * comme relais. Ce site tiers pourrait alors lire les réponses, et surtout vider
 * l'allocation du jour pour tous les visiteurs du portfolio.
 */
function withCors(request, env, response) {
  const origin = request.headers.get("Origin");
  // Requête sans Origin (curl, test de santé) : il n'y a pas de CORS à accorder.
  if (origin && allowedOrigins(env).includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
  }
  return response;
}

function json(request, env, body, status = 200, extraHeaders = {}) {
  return withCors(
    request,
    env,
    new Response(JSON.stringify(body), {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        ...extraHeaders,
      },
    }),
  );
}

/**
 * Valide et normalise l'historique envoyé par le client.
 *
 * Le system prompt est ajouté ici et non reçu du client : sinon n'importe qui
 * pourrait réécrire la persona en joignant son propre message `system`.
 *
 * @param {unknown} input
 * @returns {{ok: true, messages: object[]} | {ok: false, error: string}}
 */
function sanitizeMessages(input) {
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, error: "Aucun message reçu." };
  }
  if (input.length > LIMITS.maxMessages) {
    return { ok: false, error: `Historique trop long (${LIMITS.maxMessages} messages maximum).` };
  }

  const client = [];

  for (const message of input) {
    if (!message || typeof message !== "object") {
      return { ok: false, error: "Format de message invalide." };
    }
    if (!ALLOWED_ROLES.has(message.role)) {
      return { ok: false, error: "Rôle de message non autorisé." };
    }
    if (typeof message.content !== "string") {
      return { ok: false, error: "Contenu de message invalide." };
    }
    const content = message.content.trim();
    if (!content) return { ok: false, error: "Message vide." };
    if (content.length > LIMITS.maxMessageChars) {
      return { ok: false, error: `Message trop long (${LIMITS.maxMessageChars} caractères maximum).` };
    }
    client.push({ role: message.role, content });
  }

  // L'API refuse un historique qui ne commence pas par un message `user` : on
  // retire les éventuels messages `assistant` orphelins du début. Le découpage
  // se fait sur `client` et AVANT d'ajouter le system prompt — sinon `slice()`
  // couperait aussi le prompt, qui est précisément en tête.
  const firstUser = client.findIndex((message) => message.role === "user");
  if (firstUser === -1) return { ok: false, error: "Aucun message utilisateur." };

  return { ok: true, messages: [{ role: "system", content: SYSTEM_PROMPT }, ...client.slice(firstUser)] };
}

/* ------------------------------------------------------------------ */
/* Handler                                                             */
/* ------------------------------------------------------------------ */

export default {
  /**
   * @param {Request} request
   * @param {{AI?: Ai, ALLOWED_ORIGINS?: string}} env
   */
  async fetch(request, env) {
    // Le navigateur envoie un OPTIONS avant le POST, car la requête change de
    // méthode et pose des en-têtes qui la rendent non « simple ». Il doit
    // répondre tout de suite, sans consommer de jeton de rate limiting.
    if (request.method === "OPTIONS") {
      return withCors(
        request,
        env,
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Max-Age": "86400",
          },
        }),
      );
    }

    if (request.method !== "POST") {
      return json(request, env, { error: "Méthode non autorisée." }, 405, { Allow: "POST, OPTIONS" });
    }

    // `CF-Connecting-IP` est posé par CloudEdge et n'est pas falsifiable par le
    // client, contrairement à `X-Forwarded-For` — c'est lui qui sert de clé de
    // jauge. La taille du corps est vérifiée via l'en-tête avant même de lire le
    // flux, pour ne pas engager de la mémoire sur une requête abusive.
    const declaredLength = Number(request.headers.get("Content-Length") ?? "0");
    if (declaredLength > LIMITS.maxBodyBytes) {
      return json(request, env, { error: "Requête trop volumineuse." }, 413);
    }

    const ip = request.headers.get("CF-Connecting-IP") ?? "inconnu";
    const quota = await consume(env, ip);
    if (!quota.ok) {
      return json(
        request,
        env,
        { error: `Trop de messages d'affilée. Réessayez dans ${quota.retryAfter} s.` },
        429,
        { "Retry-After": String(quota.retryAfter) },
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json(request, env, { error: "Corps de requête illisible." }, 400);
    }

    const messages = sanitizeMessages(body?.messages);
    if (!messages.ok) {
      return json(request, env, { error: messages.error }, 400);
    }

    if (!env.AI) {
      // Binding absent : configuration cassée, ce n'est pas une erreur du visiteur.
      return json(request, env, { error: "Service indisponible." }, 503);
    }

    const payload = (model) => ({
      messages: messages.messages,
      max_tokens: LIMITS.maxOutputTokens,
      stream: true,
    });

    /**
     * Un appel à Workers AI pour un modèle donné.
     *
     * Contrairement à une API HTTP, `env.AI.run` ne renvoie pas de statut : il
     * lève une exception en cas d'échec. On attrape donc pour décider s'il
     * vaut la peine d'essayer le modèle suivant.
     *
     * @returns {Promise<ReadableStream>} le flux amont
     * @throws si l'appel échoue, y compris si le visiteur a fermé l'onglet
     */
    async function callModel(model) {
      try {
        const stream = await env.AI.run(model, payload(model));
        if (!stream) throw new Error("Workers AI n'a renvoyé aucun flux.");
        return stream;
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        console.error("Appel Workers AI impossible pour", model, error?.message ?? error);
        throw error;
      }
    }

    // Le modèle principal d'abord, les replis ensuite. L'épuisement de
    // l'allocation neuronale est une cause commune à tous les modèles : inutile
    // d'enchaîner les replis dans ce cas, on dit tout de suite la vraie raison.
    let stream;
    let exhausted = false;
    for (const model of [MODEL, ...FALLBACK_MODELS]) {
      try {
        stream = await callModel(model);
        break;
      } catch (error) {
        if (error?.name === "AbortError") return new Response(null, { status: 499 });
        const message = String(error?.message ?? error);
        if (/limit|quota|neuron|billing/i.test(message)) {
          console.error("Allocation Workers AI épuisée :", message.slice(0, 300));
          exhausted = true;
          break;
        }
        console.warn("Modèle", model, "indisponible, essai du suivant.");
      }
    }

    if (exhausted) {
      return json(
        request,
        env,
        { error: "L'allocation du jour est épuisée. Le chat sera de nouveau disponible demain." },
        429,
      );
    }

    if (!stream) {
      return json(request, env, { error: "Le service de discussion ne répond pas." }, 502);
    }

    // Le flux est transmis tel quel, sans passer par un `TransformStream`.
    //
    // Workers AI émet déjà du SSE au format OpenAI — `choices[0].delta.content`,
    // terminé par `data: [DONE]` — donc il n'y a rien à convertir, et
    // `chat-widget.jsx` reste inchangé.
    //
    // Le `pipeThrough` a été essayé puis retiré : sur le flux d'un binding `AI`,
    // qui s'exécute à distance, workerd livre à `transform` des chunks que ni
    // `TextDecoder` ni le `controller` ne savent traiter. Résultat en production :
    // des `200` à taille zéro, sans la moindre erreur visible. Le passthrough
    // direct fonctionne (vérifié : 26 922 octets, trames et `[DONE]` inclus).
    return withCors(
      request,
      env,
      new Response(stream, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-store, no-transform",
          "X-Accel-Buffering": "no",
        },
      }),
    );
  },
};
