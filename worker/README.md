# Worker proxy du chatbot

Relaye les requêtes du chatbot vers OpenRouter en gardant la clé **hors du
bundle du site**.

## Pourquoi ce Worker existe

Le site est un export statique Next.js (`output: "export"` dans
`next.config.mjs`), déployé sur GitHub Pages : il n'y a **aucun runtime**. Une
route `app/api/chat/route.js` ferait échouer le build.

La seule alternative sans proxy serait que le navigateur appelle OpenRouter
directement. La clé devrait alors vivre dans une variable `NEXT_PUBLIC_*`, donc
dans le bundle public : lisible en quelques secondes, et donc vidé ou bloqué au
premier robot qui visite la page.

Ce Worker est le seul endroit où la clé existe.

## Mise en place

```bash
cd worker
npm install

# 1. La clé OpenRouter, en secret Cloudflare (jamais dans un fichier versionné)
npm run secret          # wrangler secret put OPENROUTER_API_KEY

# 2. L'endpoint, dans le site (à la racine du dépôt, .env.local)
#    NEXT_PUBLIC_CHAT_ENDPOINT=https://portfolio-chat.<subdomain>.workers.dev

# 3. Déploiement
npm run deploy
```

La clé se crée sur https://openrouter.ai/keys. Il lui faut au moins un crédit,
même pour router sur les modèles gratuits.

## En local

```bash
cd worker
cp .dev.vars.example .dev.vars    # y mettre la clé
npm run dev                       # → http://127.0.0.1:8787
```

Puis, à la racine du dépôt, `.env.local` :

```
NEXT_PUBLIC_CHAT_ENDPOINT=http://127.0.0.1:8787
```

Le bouton de chat n'apparaît pas tant que cette variable est absente : `npm run
dev` du site tourne sur son propre port, il faut lancer les deux.

`wrangler dev` respecte `.dev.vars`, `wrangler.jsonc` fournit le reste.

## Configuration

Tout est dans `wrangler.jsonc` (`vars`), ce sont des valeurs publiques :

| Variable            | Rôle                                                  |
| ------------------- | ----------------------------------------------------- |
| `ALLOWED_ORIGINS`   | Origines autorisées, séparées par virgule             |
| `SITE_URL`          | `HTTP-Referer` envoyé à OpenRouter                   |
| `SITE_TITLE`        | `X-Title` envoyé à OpenRouter                        |

Le refus de CORS est volontaire : ce Worker porte un secret. Un
`Access-Control-Allow-Origin: *` autoriserait n'importe quel site à s'en servir
comme relais.

Après un déploiement, ajouter l'origine du nouveau domaine dans
`ALLOWED_ORIGINS`, sinon le navigateur bloquera la réponse.

## Garde-fous

- **Rate limiting** : 10 requêtes/minute par IP, via le binding `CHAT_LIMIT`
  (voir la section suivante — le premier montage ne tenait pas).
- **Validation** : 24 messages max, 4000 caractères par message, corps de
  64 Ko. Seuls les rôles `user` et `assistant` passent.
- **System prompt injecté côté Worker** : le client ne peut pas le réécrire.
- **`max_tokens`** à 900 : borne le coût d'une requête.
- **Annulation** : fermer l'onglet abandonne la requête amont.

## Rate limiting : pourquoi un binding et pas un `Map`

La première version comptait les requêtes dans une `Map` en mémoire, avec une
fenêtre par minute et une par heure. **Ça ne limitait rien.**

Les compteurs d'un Worker vivent dans l'isolate qui les a créés, et les requêtes
se répartissent sur plusieurs isolates, chacun avec sa propre copie. Mesuré sur
le Worker déployé : 8 requêtes séquentielles puis 20 en parallèle depuis la même
IP, **28 réponses en `200`**. Chaque requête avait vu un compteur vide.

Le rempart est le binding [`ratelimits`](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/),
déclaré dans `wrangler.jsonc` : il s'appuie sur un compteur partagé au sein de la
localisation Cloudflare qui sert la requête.

### Ce que le binding ne fait pas

- **Il est local à la localisation.** Une requête servie à Paris ne compte pas
  pour une requête servie à Tokyo. Un attaquant qui répartit son trafic mondial
  dépasse la limite d'un facteur égal au nombre de localisations.
- **Il est permissif.** Cloudflare le décrit comme « eventually consistent » :
  les compteurs sont mis à jour en arrière-plan, pas à chaque appel.

C'est un frein, pas un verrou. Pour un plafond comptablement exact, il faudrait
un Durable Object. Pour un portfolio, le coût ne se justifie pas.

### La clé est l'IP

Cloudflare déconseille l'IP comme clé : plusieurs personnes partagent une
adresse derrière un CGNAT mobile. Ici le risque inverse l'emporte — un visiteur
anonyme n'a pas d'autre identifiant stable, et c'est le robot sans identité qui
coûte de l'argent. Sur un site à faible trafic, le faux positif est improbable.

## Vérifier que ça fonctionne

```bash
npm run tail     # logs en direct, avec observability activée
```

Un test rapide de la clé, sans passer par le site :

```bash
curl -i https://portfolio-chat.<subdomain>.workers.dev \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://phib64.github.io' \
  -d '{"messages":[{"role":"user","content":"Bonjour"}]}'
```

Attendu : `200` et un flux `text/event-stream`. Un `403` signifie que l'origine
n'est pas dans `ALLOWED_ORIGINS`.
