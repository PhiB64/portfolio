# Worker du chatbot

Relaye les requêtes du chatbot vers **OpenRouter**, avec **Workers AI** en
repli, et garde le contrôle des appels côté serveur.

## Pourquoi ce Worker existe

Le site est un export statique Next.js (`output: "export"` dans
`next.config.mjs`), déployé sur GitHub Pages : il n'y a **aucun runtime**. Une
route `app/api/chat/route.js` ferait échouer le build.

La seule alternative sans proxy serait que le navigateur appelle l'API d'IA
directement, avec une clé dans une variable `NEXT_PUBLIC_*` — donc dans le bundle
public : lisible en quelques secondes, et donc vidé ou bloqué au premier robot qui
visite la page.

## Les deux fournisseurs

Le Worker essaie **OpenRouter**, puis **Workers AI** si le premier échoue. Le
visiteur ne voit jamais l'échec du premier tant que le second répond.

| | OpenRouter | Workers AI |
| --- | --- | --- |
| Rôle | principal | repli |
| Modèle | `openrouter/free` (routeur) | `granite-4.0-h-micro` + 3 replis |
| Authentification | clé dans un secret Cloudflare | binding `AI`, rien à poser |
| Quota | 1 000 requêtes de modèles `:free` par jour | 10 000 neurons par jour |

**Pourquoi OpenRouter en principal.** Il n'y a pas de modèle à choisir : le
routeur `openrouter/free` sélectionne un modèle `:free` disponible à l'instant de
la requête. Les réponses sont donc nettement meilleures que celles du modèle
Workers AI, qui est un modèle de 0,5 Md de paramètres choisi pour tenir dans
l'allocation.

**Pourquoi Workers AI en repli, et pas l'inverse.** C'est la raison d'être de la
chaîne : le point faible d'OpenRouter gratuit est connu et mesuré. Un `429`
revient quand les modèles gratuits sont saturés, et le quota du compte est
borné. Le repli garantit que le chat reste disponible dans ces cas-là.

**Sans clé, le Worker ne casse pas.** Si `OPENROUTER_API_KEY` est absent,
OpenRouter est sauté sans erreur et le chat répond via Workers AI — moins bien,
mais disponible. Le secret peut donc être ajouté ou retiré sans downtime.

Chaque réponse porte un en-tête `X-Chat-Source` (`openrouter` ou `workers-ai`)
qui dit quel fournisseur a réellement répondu.

## Mise en place

```bash
cd worker
npm install

# 1. Le secret OpenRouter (une seule fois)
npm run secret          # colle la clé quand Wrangler la demande

# 2. L'endpoint, dans le site (à la racine du dépôt, .env.local)
#    NEXT_PUBLIC_CHAT_ENDPOINT=https://portfolio-chat.<subdomain>.workers.dev

# 3. Déploiement
npm run deploy
```

`npm run secret` est un `wrangler secret put OPENROUTER_API_KEY`. La clé n'est
écrite dans aucun fichier du dépôt : Wrangler la chiffre dans le compte
Cloudflare, et `npm run secret` ne la redemande pas après un déploiement.

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

En local, Wrangler charge les variables de `.dev.vars` (ignoré par git) :

```
OPENROUTER_API_KEY=sk-or-v1-…
```

Le modèle de `.dev.vars.example`. Sans ce fichier, `npm run dev` démarre quand
même et le chat répond via Workers AI.

Il existe aussi `wrangler.local.jsonc`, pour faire pointer le Worker local vers
le digest d'un build local (`npx serve dist` sur le port 8899) au lieu du site
déployé :

```bash
npx wrangler dev --config wrangler.local.jsonc
```

## Configuration

Tout est dans `wrangler.jsonc`, plus un secret. Les variables sont publiques et
peuvent rester dans le dépôt :

| Variable          | Rôle                                                       |
| ----------------- | ---------------------------------------------------------- |
| `ALLOWED_ORIGINS` | Origines autorisées, séparées par virgule                  |
| `SITE_URL`        | Page d'attribution affichée par OpenRouter                 |
| `SITE_TITLE`      | Idem, sous forme de titre lisible                          |
| `SITE_CONTENT_URL` | Adresse du digest publié par le site                      |
| `GITHUB_USER`      | Compte GitHub lu via l'API publique (vide = désactivé)      |

| Secret                | Rôle                                    |
| --------------------- | --------------------------------------- |
| `OPENROUTER_API_KEY`  | Authentification OpenRouter             |

Le refus de CORS est volontaire : ce Worker consomme un quota d'inférence payé.
Un `Access-Control-Allow-Origin: *` autoriserait n'importe quel site à s'en
servir comme relais et à le vider.

Après un déploiement, ajouter l'origine du nouveau domaine dans
`ALLOWED_ORIGINS`, sinon le navigateur bloquera la réponse.

## Les sources : digest du site et API GitHub

Le modèle ne devine rien sur Philippe. Il travaille à partir de deux sources,
assemblées dans le system prompt à chaque question.

### 1. Le digest du site (obligatoire)

Le Worker ne lit pas le site : il est un export statique, tout son texte vit
dans les bundles JavaScript, et le HTML servi ne contient ni les projets ni les
compétences. Le digest est donc produit au build par
`scripts/build-chat-content.mjs`, publié en JSON avec le site, et mis en cache
dix minutes.

Il est encadré par des marqueurs (`<contenu_du_site>`) et injecté dans le
system prompt. Les faits sur Philippe ne sont donc écrits qu'à un seul endroit :
modifier un projet sur le site change ce que l'assistant dit au déploiement
suivant.

#### La section « Parcours professionnel »

Le digest a deux sources. La première est `PROJECT_CONTENT`, c'est-à-dire
exactement ce qui s'affiche sur les faces du cube. La seconde est
`CAREER_CONTENT`, dans le même fichier, et elle vient du CV : reconversion
professionnelle, formations, années de management et de gestion d'équipe avant le
développement, langues, permis.

Cette seconde source **n'est affichée nulle part sur le site**. C'est
délibéré : une face de cube de plus aurait désorganisé l'interface existante, et
ces informations ne se lisent pas bien sur une face technique. Elles sont en
revanche ce que les visiteurs demandent en premier — « d'où viens-tu ? », «
comment es-tu arrivé au développement ? » — et le site ne le disait pas.

Le CV n'étant pas à jour, les formulations sont volontairement neutres :

- « depuis mars 2025 » plutôt qu'une date limite ;
- « pendant plusieurs dizaines d'années » plutôt qu'un compte d'années précis ;
- aucune mention de recherche d'alternance ni de statut, qui daterait le
  document.

Une information périmée est moins fausse qu'une date fausse.

**Si le digest est introuvable**, le Worker n'appelle aucun modèle : il répond
lui-même, en streamant un message qui dit que le portfolio est momentanément
injoignable. Un modèle sans contenu depuis lequel travailler comble le vide, et
produit des projets et des liens qu'il n'a pas lus — c'est mesuré. Le court-circuit
économise aussi le quota d'inférence, et il ne rend pas le chat inutilisable.

### 2. Les dépôts GitHub (optionnel, mais plus frais que le site)

Le digest est figé au dernier déploiement. Le profil GitHub, non : un dépôt peut
apparaître sans que le site soit redéployé. Le Worker appelle donc
`api.github.com` à chaque question et injecte la liste des dépôts publics.

Points à connaître :

- **Aucun secret.** L'API GitHub est publique : 60 requêtes par heure suffisent,
  et le résumé est mis en cache une heure (`GITHUB_TTL_MS`).
- **Les forks sont écartés.** Un fork n'est pas une réalisation de Philippe ;
  l'inclure ferait dire au modèle qu'il a écrit un code qu'il a seulement
  recopié.
- **Il est présenté comme plus frais que le site**, avec une consigne explicite de
  le privilégier au site en cas de contradiction. Sans elle, un dépôt nouveau
  pourrait faire dire au modèle qu'il n'est pas sur le portfolio.
- **Son absence est silencieuse.** Si GitHub ne répond pas, le digest seul suffit
  et le chat fonctionne. Le compte est piloté par `GITHUB_USER` dans
  `wrangler.jsonc` : le retirer désactive la source.

Le Worker ne lit pas le site : il est un export statique, tout son texte vit
dans les bundles JavaScript, et le HTML servi ne contient ni les projets ni les
compétences. Le digest est donc produit au build par
`scripts/build-chat-content.mjs`, publié en JSON avec le site, et mis en cache
dix minutes.

**Si le digest est introuvable**, le Worker n'appelle aucun modèle : il répond
lui-même, en streamant un message qui dit que le portfolio est momentanément
injoignable. Un modèle sans contenu depuis lequel travailler comble le vide, et
produit des projets et des liens qu'il n'a pas lus — c'est mesuré. Le court-circuit
économise aussi le quota d'inférence, et il ne rend pas le chat inutilisable.

Le digest est plafonné à 15 000 caractères (`MAX_CHARS`), et la troncature est
annoncée dans le texte. Le plafond a été relevé de 12 000 en ajoutant la section
parcours : à 12 000, la coupure tombait au milieu de « Méthode » et amputait les
langues et le permis, placés en fin de digest. Un digest tronqué au milieu d'une
liste est pire qu'un digest absent, parce qu'il donne l'illusion d'être complet.

## Modèle et streaming

OpenRouter est appelé avec le routeur `openrouter/free`. Le slug est
volontairement unique : le catalogue `:free` évolue (ajouts, retraits) et le
routeur suit sans qu'une ligne de code change.

Le repli Workers AI commence par `@cf/ibm-granite/granite-4.0-h-micro` : il
n'émet aucun `reasoning_content` (voir ci-dessous, c'est le critère qui élimine
l'essentiel du catalogue) et il est de loin le moins cher — 1 542 neurons en
entrée et 10 158 en sortie par million de tokens. Un message du chatbot coûte de
l'ordre de 1 à 2 neurons, donc l'allocation gratuite de 10 000 neurons par jour
ne sera jamais un problème ici.

Le flux est transmis **tel quel**, sans `TransformStream`. Les deux fournisseurs
émettent du SSE au format OpenAI — `choices[0].delta.content`, terminé par
`data: [DONE]` — donc il n'y a rien à convertir, et `chat-widget.jsx` n'a pas eu
besoin d'être touché.

### Pourquoi pas de `pipeThrough`

C'est contre-intuitif, alors que le réécrire paraît plus propre. Un
`TransformStream` posé sur le flux d'un binding `AI` **ne fonctionne pas** : le
binding s'exécute à distance, et workerd livre alors à `transform` des chunks que
ni `TextDecoder` ni le `controller` ne savent traiter (`controller.enqueue is not
a function`). Le symptôme en production est un `200` avec **zéro octet** et
aucune erreur visible — le client voit un chat bloqué indéfiniment.

Le passthrough direct fonctionne : vérifié, 26 922 octets, trames et `[DONE]`
compris. Un aller-retour par un Worker de test a confirmé que c'est bien
`pipeThrough` qui casse, et non le modèle.

Sur le flux HTTP d'OpenRouter, un `pipeThrough` fonctionnerait — mais il
n'apporterait rien, et il faudrait deux versions du code selon le fournisseur.

### Le critère « pas de raisonnement »

Le front n'affiche que `delta.content`. Un modèle raisonneur émet
`reasoning_content` avant, et l'écran reste vide le temps qu'il réfléchisse.

Mesuré sur `@cf/google/gemma-4-26b-a4b-it` : **1 949 caractères de raisonnement
pour 28 caractères de réponse**, et une réponse totalement vide quand
`max_tokens` était bas. Les quatre modèles Workers AI retenus (principal + trois
repls) ont été choisis parce qu'ils n'émettent aucun `reasoning_content`.

Le problème se repose côté OpenRouter, mais il n'est plus maîtrisable par le
choix du modèle : le routeur peut décider de nous envoyer n'importe quel `:free`.
La requête porte donc :

```json
"reasoning": { "effort": "low", "exclude": true }
```

`exclude` demande à OpenRouter de retirer le raisonnement de la réponse, `effort`
le borne quand le modèle l'expose. Si OpenRouter venait à refuser ce corps — un
`400` — le Worker réessaie une fois sans ce champ, ce qui préserve le chat sans
avoir à réécrire le Worker. Voir le log `OpenRouter a refusé le corps de la
requête` dans `npm run tail`.

### Un `429` d'OpenRouter recouvre deux causes

Le statut seul ne suffit pas, et la distinction a déjà coûté une enquête :

- **`free-models-per-day`** — le quota gratuit du compte est épuisé. Aucun
  repli de modèle n'y change rien.
- **saturation** — les modèles `:free` sont pleins à cet instant. Ça se résout
  tout seul en quelques secondes.

Le corps de l'erreur est le seul endroit où la différence apparaît, donc c'est lui
que `describeOpenRouterFailure` regarde. Ici les deux finissent au même endroit —
le repli Workers AI — donc la distinction ne sert qu'à la lisibilité des logs.

Si un jour OpenRouter redevient le seul fournisseur, il faudra la ressortir pour
l'affichage : dire « saturés, réessayez » quand c'est le quota du jour épuise
envoie le visiteur recharger une page qui ne marchera pas.

## Le coupe-circuit

Après un échec, le Worker cesse d'appeler OpenRouter pendant un certain délai, et
va directement au repli. Les durées dépendent de la nature de la panne :

| Panne                       | Délai  | Pourquoi                                |
| --------------------------- | ------ | --------------------------------------- |
| `401` / `403`               | 30 min | clé refusée : rien ne changera          |
| `402`                       | 30 min | pas de crédits                          |
| `429` quota du jour         | 60 min | il ne se remit pas en quelques secondes |
| `429` saturation            | 20 s   | passagère                               |
| autre (`5xx`, réseau coupé) | 20 s   | passagère                               |

Une clé invalide produirait sinon un échec **systématique** : un aller-retour
inutile à chaque message, quelques centaines de ms de latence en plus, et une
ligne de log par requête. Le visiteur ne verrait rien de cassé — seulement un chat
plus lent — mais la panne serait invisible au fil des conversations, ce qui est le
pire endroit pour la découvrir.

Une réussite rouvre immédiatement le circuit. L'état est au niveau de l'isolate,
donc un isolate fraîchement démarré réessaiera une fois : c'est une optimisation,
pas un verrou de sûreté.

Pendant un circuit fermé, le motif n'est pas re-journalisé à chaque message. Il
l'a déjà été à l'ouverture du circuit — le chercher dans `npm run tail` plutôt que
de s'attendre à le voir répéter.

### Le Markdown à l'affichage

Le front rend le texte dans une bulle avec `whitespace-pre-wrap` : aucune balise
n'est interprétée, donc un `**gras**` s'affiche littéralement, astérisques
visibles. C'est ce que le visiteur voyait.

Le correctif est à deux étages :

1. **Le system prompt** interdit explicitement le Markdown, en expliquant que
   l'interface affiche le texte tel quel.
2. **`stripMarkdown` dans `chat-widget.jsx`** nettoie à l'affichage. C'est la
   couche qui ne peut pas échouer : on a déjà mesuré que ce catalogue de modèles
   n'obéit pas aux consignes d'interdiction, et un modèle raisonneur peut
   ignorer la consigne sans qu'aucune erreur ne remonte.

`stripMarkdown` retire `**gras**`, `__gras__`, `*italique*`, `_italique_`,
`` `code` ``, les puces et les titres `#`. Elle conserve les URL, y compris celles
écrites `[libellé](url)` — le visiteur garde ainsi un lien cliquable.

Deux pièges ont été corrigés en cours de route, tous deux visibles sur une
réponse en listes :

- `\s` en mode multiligne englobe le retour à la ligne, donc une puce absorbait
  la ligne vide qui la précédait et toutes les séparations disparaissaient. Le
  motif utilise `[ \t]`.
- Le nettoyage des italiques est contraint par des caractères délimiteurs, sinon
  `snake_case` ou `2 * 3` seraient mutilés.

18 cas de test couvrent la fonction, dont quatre qui doivent rester intacts
(`a * b = c`, `snake_case_name`, `2 * 3 = 6`, une URL nue).

## Garde-fous

- **Rate limiting** : 10 requêtes/minute par IP, via le binding `CHAT_LIMIT`
  (voir la section suivante — le premier montage ne tenait pas).
- **Validation** : 24 messages max, 4000 caractères par message, corps de
  64 Ko. Seuls les rôles `user` et `assistant` passent.
- **System prompt injecté côté Worker** : le client ne peut pas le réécrire.
- **`max_tokens`** à 900 : borne le coût d'une requête.
- **Annulation** : fermer l'onglet abandonne la requête amont.

Un seul jeton de rate limiting est consommé par requête du visiteur, même si deux
fournisseurs sont appelés : le compteur mesure ce que le visiteur coûte au site,
pas le nombre d'appels internes.

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
coûte le quota. Sur un site à faible trafic, le faux positif est improbable.

### Le tester est plus dur que le croire

Tester cette limite depuis une machine ne fonctionne pas du premier coup, pour une
raison qui fait perdre du temps : **l'IP de sortie peut être répartie sur
plusieurs adresses**. Sur la machine de développement, les requêtes arrivaient en
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

Pour savoir quel fournisseur a répondu, sans le déduire du texte :

```bash
curl -s -D - -o /dev/null https://portfolio-chat.<subdomain>.workers.dev \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://phib64.github.io' \
  -d '{"messages":[{"role":"user","content":"Bonjour"}]}' | grep -i x-chat-source
```

Si la clé secrète est absente ou refusée, la réponse porte `x-chat-source:
workers-ai` et les logs de `npm run tail` contiennent la raison du refus
(`OpenRouter refuse la clé configurée sur le Worker`).