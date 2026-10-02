/**
 * Proxy OpenRouter du chatbot du portfolio.
 *
 * Pourquoi un Worker séparé plutôt qu'une route Next.js : le site est un
 * export statique (`output: "export"` dans next.config.mjs), donc aucune route
 * serveur ne peut exister dans le repo — `app/api/chat/route.js` ferait
 * échouer le build, et il n'y a aucun runtime sur GitHub Pages. Sans proxy, le
 * navigateur serait obligé d'appeler OpenRouter directement, et la clé se
 * retrouverait dans une variable `NEXT_PUBLIC_*`, donc dans le bundle public,
 * lisible par n'importe qui en quelques secondes.
 *
 * Ce Worker est le seul endroit où la clé existe : elle vit dans un secret
 * (`wrangler secret put OPENROUTER_API_KEY`), jamais dans le code ni dans une
 * variable `NEXT_PUBLIC_*`.
 *
 * Il est aussi le garde-fou : sans lui, un visiteur peut boucler `fetch` dans
 * la console et vider le quota du compte. D'où le rate limiting ci-dessous, qui
 * borne le débit par IP, et `max_tokens`, qui borne le coût d'une requête.
 */

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

// Routeur gratuit d'OpenRouter : il choisit un modèle `:free` parmi la liste
// disponible (~17 modèles au moment de l'écriture). Le slug est volontairement
// unique — le catalogue évolue (modèles ajoutés ou retirés) et le routeur suit
// le mouvement sans qu'une ligne de code change.
const ROUTER_MODEL = "openrouter/free";

const LIMITS = {
  maxMessages: 24,
  maxMessageChars: 4000,
  maxBodyBytes: 64 * 1024,
  // Borne le coût d'une requête : une réponse de modèle gratuit peut partir
  // très vite, et le streaming est coupé par le client dès qu'il ferme le
  // panneau — la facturation, elle, ne l'est pas.
  maxOutputTokens: 900,
};

/**
 * Persona du chatbot, bâtie à partir des données réelles du site
 * (components/cube/project-content.jsx, app/layout.js) — aucune compétence ni
 * aucun projet inventé. Volontairement dense plutôt que bavard : le routeur
 * gratuit mène à des modèles petits, et chaque token de ce prompt est
 * reproposé à chaque requête.
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
 * identité — est celui qui coûte de l'argent.
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
 * porte un secret, même s'il ne le renvoie jamais. Un `Access-Control-Allow-Origin:
 * *` autoriserait n'importe quel site à s'en servir comme relais, et ce site
 * tiers pourrait alors lire les réponses à la place du portfolio.
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

  // L'API OpenRouter refuse un historique qui ne commence pas par un message
  // `user` : on retire les éventuels messages `assistant` orphelins du début.
  // Le découpage se fait sur `client` et AVANT d'ajouter le system prompt — sinon
  // `slice()` couperait aussi le prompt, qui est précisément en tête.
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
   * @param {{OPENROUTER_API_KEY?: string, ALLOWED_ORIGINS?: string, SITE_URL?: string, SITE_TITLE?: string}} env
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

    if (!env.OPENROUTER_API_KEY) {
      // Clé absente : configuration cassée, ce n'est pas une erreur du visiteur.
      return json(request, env, { error: "Service indisponible." }, 503);
    }

    let upstream;
    try {
      upstream = await fetch(OPENROUTER_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          // OpenRouter affiche le site appelant sur ses pages d'attribution.
          "HTTP-Referer": env.SITE_URL ?? "",
          "X-Title": env.SITE_TITLE ?? "Portfolio Philippe Barbosa",
        },
        body: JSON.stringify({
          model: ROUTER_MODEL,
          messages: messages.messages,
          max_tokens: LIMITS.maxOutputTokens,
          stream: true,
        }),
        // Si le visiteur ferme l'onglet, la requête amont est abandonnée au
        // lieu de continuer à consommer des tokens pour rien.
        signal: request.signal,
      });
    } catch (error) {
      // 499 : convention nginx pour « fermé par le client ». Le visiteur est
      // parti, il n'a plus personne à prévenir.
      if (error?.name === "AbortError") return new Response(null, { status: 499 });
      return json(request, env, { error: "Le service de discussion ne répond pas." }, 502);
    }

    // Erreur amont : traitée avant de démarrer le streaming, sinon le client a
    // déjà reçu un 200 et ne verrait qu'un flux coupé sans explication.
    if (!upstream.ok) {
      const status = upstream.status;

      if (status === 429) {
        return json(request, env, { error: "Les modèles gratuits sont saturés. Réessayez dans un instant." }, 429);
      }
      if (status === 402) {
        return json(request, env, { error: "Le quota du assistant est épuisé pour le moment." }, 503);
      }
      if (status === 401 || status === 403) {
        console.error("OpenRouter refuse la clé configurée sur le Worker.");
        return json(request, env, { error: "Service indisponible." }, 503);
      }
      console.error("OpenRouter a renvoyé", status, (await upstream.text()).slice(0, 500));
      return json(request, env, { error: "Le service de discussion a renvoyé une erreur." }, 502);
    }

    // Flux SSE transmis tel quel : OpenRouter gère le découpage, le client le
    // décode. On ne recopie que le type MIME — les en-têtes de cache
    // d'OpenRouter nuiraient à une reconnexion après erreur.
    return withCors(
      request,
      env,
      new Response(upstream.body, {
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
