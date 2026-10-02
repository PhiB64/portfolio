# Worker du chatbot

Relaye les requêtes du chatbot vers **Workers AI** en gardant le contrôle des
appels côté serveur.

## Pourquoi ce Worker existe

Le site est un export statique Next.js (`output: "export"` dans
`next.config.mjs`), déployé sur GitHub Pages : il n'y a **aucun runtime**. Une
route `app/api/chat/route.js` ferait échouer le build.

La seule alternative sans proxy serait que le navigateur appelle l'API d'IA
directement, avec une clé dans une variable `NEXT_PUBLIC_*` — donc dans le bundle
public : lisible en quelques secondes, et donc vidé ou bloqué au premier robot qui
visite la page.

## Workers AI : pas de clé à gérer

L'inférence passe par le binding `AI` (`env.AI.run`), déclaré dans
`wrangler.jsonc`. Il s'authentifie avec le compte Cloudflare du Worker : il n'y a
**aucun secret à poser, aucune clé à faire tourner, rien à retirer**. C'est ce qui
a remplacé le proxy OpenRouter, qui demandait une clé secrète et dependait d'un
quota de modèles gratuits très faible.

L'allocation gratuite du plan Workers est de **10 000 neurons par jour**, remis à
zéro à 00:00 UTC. Sur un portfolio à faible trafic, c'est confortable.

## Mise en place

```bash
cd worker
npm install

# 1. L'endpoint, dans le site (à la racine du dépôt, .env.local)
#    NEXT_PUBLIC_CHAT_ENDPOINT=https://portfolio-chat.<subdomain>.workers.dev

# 2. Déploiement
npm run deploy
```

## En local

```bash
cd worker
npm run dev    # → http://127.0.0.1:8787
```

Puis, à la racine du dépôt, `.env.local` :

```
NEXT_PUBLIC_CHAT_ENDPOINT=http://127.0.0.1:8787
```

Le bouton de chat n'apparaît pas tant que cette variable est absente : `npm run
dev` du site tourne sur son propre port, il faut lancer les deux.

`wrangler.jsonc` fournit toute la configuration. `.dev.vars` n'est plus nécessaire
en local : le binding `AI` est disponible sans clé.

## Configuration

Tout est dans `wrangler.jsonc`. Une seule variable d'environnement reste, et c'est
une valeur publique :

| Variable          | Rôle                                      |
| ----------------- | ----------------------------------------- |
| `ALLOWED_ORIGINS` | Origines autorisées, séparées par virgule |

Le refus de CORS est volontaire : ce Worker consomme l'allocation neuronale du
compte. Un `Access-Control-Allow-Origin: *` autoriserait n'importe quel site à
s'en servir comme relais et à le vider.

Après un déploiement, ajouter l'origine du nouveau domaine dans
`ALLOWED_ORIGINS`, sinon le navigateur bloquera la réponse.

## Modèle et streaming

Le modèle est défini en haut de `src/index.js` (`MODEL`). C'est
`@cf/ibm-granite/granite-4.0-h-micro` : il n'émet aucun `reasoning_content` (voir
ci-dessous, c'est le critère qui élimine l'essentiel du catalogue) et il est de
loin le moins cher — 1 542 neurons en entrée et 10 158 en sortie par million de
tokens. Un message du chatbot coûte de l'ordre de 1 à 2 neurons, donc l'allocation
gratuite de 10 000 neurons par jour ne sera jamais un problème ici.

Le flux est transmis **tel quel**, sans `TransformStream`. Workers AI émet déjà du
SSE au format OpenAI — `choices[0].delta.content`, terminé par `data: [DONE]` — donc
`chat-widget.jsx` n'a pas eu besoin d'être touché.

### Pourquoi pas de `pipeThrough`

C'est contre-intuitif, alors que le réécrire paraît plus propre. Un `TransformStream`
posé sur le flux d'un binding `AI` **ne fonctionne pas** : le binding s'exécute à
distance, et workerd livre alors à `transform` des chunks que ni `TextDecoder` ni
le `controller` ne savent traiter (`controller.enqueue is not a function`). Le
symptôme en production est un `200` avec **zéro octet** et aucune erreur visible —
le client voit un chat bloqué indéfiniment.

Le passthrough direct fonctionne : vérifié, 26 922 octets, trames et `[DONE]`
compris. Un aller-retour par un Worker de test a confirmé que c'est bien
`pipeThrough` qui casse, et non le modèle.

### Le critère « pas de raisonnement »

Un premier essai avec `@cf/google/gemma-4-26b-a4b-it` renvoyait des réponses
vides. La cause : ce modèle est un modèle raisonneur, il émet
`reasoning_content` avant `content`, et le front n'affiche que le second. Mesuré
sur une question simple : **1 949 caractères de raisonnement pour 28 caractères de
réponse**, et une réponse totalement vide quand `max_tokens` était bas.

Les quatre modèles retenus (principal + trois replis) ont été choisis parce
qu'ils n'émettent aucun `reasoning_content`. Si un jour un repli doit être
remplacé, vérifier ce point d'abord — un modèle raisonneur produit un chat
muet, sans la moindre erreur à l'écran.

Si le modèle principal échoue, les replis sont essayés dans l'ordre. En revanche,
si l'allocation du jour est épuisée, la cause est commune à tous les modèles : on
ne tente pas les replis et on renvoie directement un message qui le dit.

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
coûte de l'allocation. Sur un site à faible trafic, le faux positif est improbable.

### Le tester est plus dur que le croire

Tester cette limite depuis une machine ne fonctionne pas du premier coup, pour une
raison qui fait perdre du temps : **l'IP de sortie peut être répartie sur plusieurs
adresses**. Sur la machine de développement, les requêtes arrivaient en
`185.5.129.29`, `.30` et `.31` — jamais plus de 10 sur aucune des trois, donc
aucune n'était jamais bloquée, alors que 40 requêtes étaient envoyées.

Le rempart n'était pas en cause : en descendant `limit` à 1, une rafale de 30
requêtes a renvoyé 6 `429` et 24 `200`. Le binding fonctionne, mais pour l'observer
il faut soit viser une seule adresse, soit réduire la limite le temps d'un test.

## Vérifier que ça fonctionne

```bash
npm run tail     # logs en direct, avec observability activée
```

Un test rapide, sans passer par le site :

```bash
curl -i https://portfolio-chat.<subdomain>.workers.dev \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://phib64.github.io' \
  -d '{"messages":[{"role":"user","content":"Bonjour"}]}'
```

Attendu : `200` et un flux `text/event-stream`. Un `403` signifie que l'origine
n'est pas dans `ALLOWED_ORIGINS`.
