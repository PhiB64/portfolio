# Worker du chatbot

Relaye les requêtes du chatbot vers **OpenRouter**, et garde le contrôle des
appels côté serveur.

## Pourquoi ce Worker existe

Le site est un export statique Next.js (`output: "export"` dans
`next.config.mjs`), déployé sur GitHub Pages : il n'y a **aucun runtime**. Une
route `app/api/chat/route.js` ferait échouer le build.

La seule alternative sans proxy serait que le navigateur appelle l'API d'IA
directement, avec une clé dans une variable `NEXT_PUBLIC_*` — donc dans le bundle
public : lisible en quelques secondes, et donc vidé ou bloqué au premier robot qui
visite la page.

## Le fournisseur

Le Worker appelle **OpenRouter** avec le routeur `openrouter/free` : il n'y a
pas de modèle à choisir, OpenRouter sélectionne un modèle `:free` disponible à
l'instant de la requête. Le catalogue gratuit évolue (ajouts, retraits) sans
qu'une ligne de code change.

**Sans clé, le Worker répond une erreur explicite.** Si `OPENROUTER_API_KEY`
est absente, il ne tente aucun appel et renvoie `500` (« service non
configuré », visible dans `npm run tail`). Il n'y a plus de repli : l'ancien
repli Workers AI ne servait qu'à pallier une clé vide, doublait la surface de
panne pour une qualité de réponse inférieure, et masquait une clé manquante
derrière une réponse médiocre (voir commit `a6f648a`).

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

Le modèle de `.dev.vars.example`. Sans ce fichier, `npm run dev` démarre mais
chaque requête échoue avec « service non configuré ».

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
`scripts/build-chat-content.mjs`, publié en `dist/content.json` avec le site,
et mis en cache dix minutes (`DIGEST_TTL_MS`).

Il est encadré par des marqueurs (`<contenu_du_site>`) et injecté dans le
system prompt. Les faits sur Philippe ne sont donc écrits qu'à un seul endroit :
modifier un projet sur le site change ce que l'assistant dit au déploiement
suivant.

Il y en a un par langue, dans `payload.digests[lang]`. La clé `digest`, qui ne
contient que le français, est conservée à côté : elle est ce que lisent les
Workers déjà déployés, donc la conserver rend le déploiement de l'un et de
l'autre dans n'importe quel ordre sans casser l'autre (voir « Langues »).

#### La section « Identité », en tête de digest

C'est une section de trois lignes, et c'est la réponse à « c'est qui Philippe ? ».

Elle existe parce que le digest ne la contenait pas. Écrit à partir des faces du
cube, il était entièrement à la première personne : il décrivait un métier, jamais
la personne. Le nom « Philippe Barbosa » n'apparaissait dans aucun des 12 000
caractères publiés — mesuré sur le `content.json` déployé. Il n'y avait donc, dans
tout le contexte, aucune phrase répondant à la question.

Résultat mesuré : à « c'est qui Philippe ? », le modèle répondait « je suis
l'assistant de Philippe ». Il ne se trompait pas de règle — le system prompt lui
ordonne cette phrase pour toute question d'identité — il n'avait rien d'autre sous
les yeux pour répondre.

Deux corrections ont donc été apportées, dans cet ordre d'importance :

- **La section « Identité » ouvre le digest**, avant le parcours et avant les
  projets. Le parcours, lui, était placé en dernier dans le code alors que son
  commentaire annonçait « la réponse à la question la plus probable » : il
  commençait à 10 515 caractères sur 12 362, donc à 85 % du digest. Le commentaire
  décrivait l'intention, le code la contredisait. Les deux sections sont maintenant
  en tête, l'identité en premier.
- **Le system prompt distingue les deux questions.** « Qui es-tu ? » porte sur le
  modèle et garde la phrase d'identité. « Qui est Philippe ? » nomme Philippe, et
  le prompt interdit désormais d'ouvrir la réponse par cette phrase, en renvoyant
  explicitement à la section « Identité ».

Les faits restent écrits à un seul endroit : ils vivent dans `CAREER_CONTENT`, le
script les publie, et rien n'est recopié dans le Worker.

(Poids historiques, avant les sections suivantes et le relèvement du plafond à
16 000 : 12 732 caractères après l'Identité, 14 640 après « Utiliser ce site ».)

#### La section « Utiliser ce site »

Une section de douze lignes, et c'est la réponse à « je suis perdu », « je n'arrive
pas à défiler », « où sont les onglets ? », « comment on écrit à Philippe ? ».

Le digest ne décrivait que Philippe et ses projets. La navigation du site n'y
était pas, et aucune autre source ne pouvait y répondre à l'exécution : le digest
est la seule source de vérité lue pendant la requête, le Worker n'a pas d'accès
réseau au dépôt. L'assistant disait donc qu'il n'avait pas l'information sous les
yeux — à raison, elle n'y était pas.

La section vit dans `USAGE_CONTENT`, dans `lib/portfolio-content.js`, et comme
`CAREER_CONTENT` elle n'est rendue nulle part sur le site : son seul destinataire
est le digest. Elle est publiée en deuxième position, après l'Identité — c'est la
question que se pose le visiteur qui vient d'arriver devant le cube.

Chaque ligne décrit un comportement lu dans le code, pas une intention. Les
points qui ressemblent à des bugs sont donc écrits comme des règles, jamais
comme des choix :

- les étiquettes sont floues pendant la première révolution parce que
  `FACE_LABEL_REVEAL_COUNT` vaut 2 dans `hero-cube.jsx` ;
- le cube se bloque après le second tour parce que `labelPinPRef` est armé quand
  les six faces ont été vues deux fois, et libéré seulement quand les six faces
  étiquetées ont été cliquées ;
- les onglets sont masqués tant que la rubrique n'a pas été ouverte, et `SKIP`
  les révèle sans qu'aucun clic sur une face soit nécessaire.

Deux choses apprises en testant, qui ne se devinaient pas. Le system prompt
interdit d'inventer un geste non décrit, et d'expliquer un effet du cube par une
intention — le modèle invoquait quand même « l'expérience immersive »
et « la préparation mentale », pour un comportement qui n'a pas d'explication
documentée. Et une consigne de rédaction placée dans le digest (« résume en deux
ou trois phrases, n'énumère pas les dix lignes suivantes ») a produit une réponse
en dix points numérotés : elle n'a rien changé. Ces limites sont notées dans
`USAGE_CONTENT`.

#### Les sections « Parcours professionnel » et « Construction du site »

Le digest a quatre sources, toutes dans `lib/portfolio-content.js`. La première
est `PROJECT_CONTENT`, c'est-à-dire exactement ce qui s'affiche sur les faces
du cube. Les trois autres ne sont **rendues nulle part sur le site** — c'est
délibéré, et leur seul destinataire est le digest :

- `CAREER_CONTENT` vient du CV : reconversion professionnelle, formations,
  années de management et de gestion d'équipe avant le développement, langues,
  permis. Ce sont pourtant ce que les visiteurs demandent en premier
  (« d'où viens-tu ? », « comment es-tu arrivé au développement ? ») — et le
  site ne le disait pas.
- `STACK_CONTENT` décrit avec quoi ce site est construit (Next.js 16, CSS 3D,
  ni three.js ni WebGL) : sans elle, le modèle répondait avec les technologies
  des autres projets.
- `USAGE_CONTENT` décrit comment utiliser le site (étiquettes floues au premier
  tour, blocage, SKIP, onglets, adresses directes).

Le CV n'étant pas à jour, les formulations du parcours sont volontairement
neutres :

- « depuis mars 2025 » plutôt qu'une date limite ;
- « pendant plusieurs dizaines d'années » plutôt qu'un compte d'années précis ;
- aucune mention de recherche d'alternance ni de statut, qui daterait le
  document.

Une information périmée est moins fausse qu'une date fausse.

#### La seule exception : `CONTACT`

Le Worker importe un bloc du dépôt : `CONTACT`, dans `lib/portfolio-content.js`.
C'est la seule dépendance de `worker/src/index.js` vers le reste du dépôt.

Il alimente le flux de repli, celui qui s'affiche quand le site est
injoignable — donc quand le visiteur ne peut aller vérifier l'adresse nulle
part. Les coordonnées y étaient écrites en dur, et aussi dans
`components/contact-overlay.jsx`, dans le JSON-LD et dans `USAGE_CONTENT` :
cinq copies, aucune ne le signalant. Changer d'adresse n'en changeait qu'une.

L'import est résolu au déploiement : esbuild inline le bloc dans le bundle, et
le Worker n'a rien à charger au moment de la requête (vérifié au
`wrangler deploy --dry-run` : aucun import résiduel). C'est compatible avec la
règle ci-dessus — le Worker ne lit pas le dépôt *à l'exécution*, seulement au
build.

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
- **Il est présenté comme plus frais que le site**, mais en cas de
  contradiction c'est le site qui prime : c'est la page officielle.
- **Son absence est silencieuse.** Si GitHub ne répond pas, le digest seul suffit
  et le chat fonctionne. Le compte est piloté par `GITHUB_USER` dans
  `wrangler.jsonc` : le retirer désactive la source.

**Si le digest est introuvable**, le Worker court-circuite : sans digest, le
modèle n'a rien de vrai à dire et il comblerait le vide — produisant des
projets et des liens qu'il n'a pas lus, ce qui est mesuré. Le Worker répond
alors lui-même via `fallbackStream`, sans appeler aucun modèle, ce qui économise
aussi le quota. Le chat reste utilisable.

Le digest est plafonné à `MAX_CHARS = 16000` caractères
(`scripts/build-chat-content.mjs`), et la troncature est annoncée dans le texte.
Le plafond est passé de 12 000 à 15 000 en ajoutant la section parcours (à
12 000, la coupure tombait au milieu de « Méthode » et amputait les langues et
le permis, placés en fin de digest), puis à 16 000 en ajoutant la construction
du site — voir le commentaire de `MAX_CHARS`. Un digest tronqué au milieu d'une
liste est pire qu'un digest absent, parce qu'il donne l'illusion d'être complet.

## Modèle et streaming

OpenRouter est appelé avec le routeur `openrouter/free`. Le slug est
volontairement unique : le catalogue `:free` évolue (ajouts, retraits) et le
routeur suit sans qu'une ligne de code change.

Le flux est transmis **tel quel**, sans `TransformStream` : OpenRouter émet du
SSE au format OpenAI — `choices[0].delta.content`, terminé par `data: [DONE]` —
donc il n'y a rien à convertir, et `chat-widget.jsx` n'a pas eu besoin d'être
touché.

### Le raisonnement des modèles du routeur

Le front n'affiche que `delta.content`. Or certains modèles raisonneurs du
routeur `:free` écrivent leur raisonnement directement dans `content`, où le
front l'affiche tel quel : le visiteur lit l'analyse de sa question en anglais,
et les consignes fuient avec. La requête porte donc :

```json
"reasoning": { "enabled": false }
```

`enabled: false` empêche le raisonnement d'être produit, et c'est le seul
réglage qui fonctionne ici : `exclude: true` ne retire que le champ
`reasoning` séparé, qui est vide pour ces modèles — le texte arrive malgré
tout dans le flux (voir le commentaire du `fetch` dans `src/index.js`). Le
system prompt rappelle la même consigne au modèle (réponse en deux ou trois
phrases, jamais de raisonnement).

### Les refus de modération (403)

Un `403` d'OpenRouter est une décision, pas une panne : la demande a été lue
puis refusée (modération, garde-fou, permissions). Le Worker le laisse passer
en 403 avec un message rédigé pour le visiteur, au lieu de le relayer en 502 :
un 502 ferait croire au front que la panne est passagère, et il relancerait
trois fois la même question pour aboutir au même refus (voir commit `ffcb0aa`).

Côté front (`chat-widget.jsx`), une erreur 403 porte `retryable: false` et
n'est jamais relancée — contrairement aux pannes et limites, qui se résorbent.
Le message amont n'est jamais recopié : il est en anglais et parle de
politique de contenu.

## Le Markdown et les fuites à l'affichage

Le front rend le texte dans une bulle avec `whitespace-pre-wrap` : aucune balise
n'est interprétée, donc un `**gras**` s'affiche littéralement, astérisques
visibles. Le correctif est à deux étages :

1. **Le system prompt** interdit explicitement le Markdown, en expliquant que
   l'interface affiche le texte tel quel.
2. **`stripMarkdown` dans `chat-widget.jsx`** nettoie à l'affichage. C'est la
   couche qui ne peut pas échouer : les modèles du routeur n'obéissent pas
   toujours aux consignes d'interdiction.

`stripMarkdown` retire `**gras**`, `__gras__`, les puces et les titres `#`,
ainsi que `*italique*` / `_italique_` entre délimiteurs. Elle conserve les URL :
`[libellé](url)` devient `libellé (url)` — le visiteur garde ainsi un lien lisible.

Deux pièges corrigés en cours de route, tous deux visibles sur une réponse en
listes :

- `\s` en mode multiligne englobe le retour à la ligne, donc une puce absorbait
  la ligne vide qui la précédait et toutes les séparations disparaissaient. Le
  motif utilise `[ \t]`.
- Le nettoyage des italiques est contraint par des caractères délimiteurs, sinon
  `snake_case` ou `2 * 3` seraient mutilés.

Certains modèles éventent aussi une ou plusieurs lignes de métadonnée interne
dans `delta.content`. Trois formats sont allés en production, sur trois modèles
différents du pool : `User Safety: safe`, `Response Safety: safe`,
`Safety Categories: PII/Privacy, Needs Caution`. Les deux suivants sont passés
malgré un filtre qui ne connaissait que le premier : `openrouter/free` est un
routeur, son catalogue change sans que le code change.

`createLeakFilter` (`lib/leak-filter.js`) ne reconnait donc aucun format
particulier : il retient le début de chaque ligne jusqu'au premier deux-points,
puis juge sur le **label** seul — le mot isolé `safety` ou `moderation` — et
n'importe quelle valeur passe. Le deux-points est obligatoire dans les deux sens,
c'est ce qui garantit qu'une réponse qui cite le mot passe intacte. Tests :
`lib/leak-filter.test.js`, dont un invariant qui rend la même sortie quel que soit
le découpage en deltas.

## Langues

L'assistant répond dans la langue de la page, et cette langue vient de la
requête — jamais du texte de la question. Un visiteur anglophone qui écrit en
français sur `/en` attend une réponse en anglais ; déduire la langue de la
question ferait l'inverse, et une conversation changerait de langue d'un tour à
l'autre.

Trois décisions portent tout le reste :

**La langue est connue avant les rejets précoces.** Elle est donc dans
l'en-tête `X-Chat-Lang` et pas seulement dans le corps : un refus d'origine ou
de méthode arrive avant que le corps soit lu, et c'est précisément à ces moments
que le visiteur ne parle pas la langue du serveur. L'en-tête est déclaré dans le
preflight CORS — sans cette ligne, le navigateur le retirerait de la requête et
le bilinguisme échouerait en silence, sans la moindre erreur visible. Le corps
porte `lang` aussi, pour les requêtes sans cet en-tête.

**Chaque langue a ses consignes et son digest.** `SYSTEM_PROMPTS` porte une
version par langue, règle pour règle, et non une version réduite : les règles
qui coûtent cher en production sont celles qu'on laisse tomber quand on traduit
vite. Un prompt anglais nourri du digest français produirait un assistant qui cite
des intitulés français au milieu d'une réponse anglaise, sans aucun moyen de le
savoir. `worker/src/langue.test.js` compte les garde-fous des deux versions, ce
qui rend une règle perdue visible immédiatement.

**Le repli est silencieux et vaut pour tous.** Une langue inconnue, une
requête sans en-tête, un `curl` de test : tout reçoit du français, qui est la
langue d'origine. Le repli protège surtout le prompt — répondre à un visiteur
avec un digest vide serait pire que de répondre dans la mauvaise langue.

### L'ordre de déploiement

Le Worker se déploie à la main (`npm run deploy`), le site à chaque push. Les
deux pièces ne se déploient pas ensemble, et la période entre les deux est
réelle.

La clé `digest` existe précisément pour cela : un Worker déjà déployé ne lit
que cette clé, et le site continue de la publier. Un site bilingue déployé en
premier sert donc des digests français et anglais, le Worker lit le français, et
la page anglaise reçoit des réponses françaises **jusqu'au déploiement du
Worker**. Aucun 404, aucun digest vide, aucune erreur : le service fonctionne,
dans la langue de l'origine. C'est le seul état dégradé possible, et il est
silencieux.

L'autre ordre est sans danger aussi : un Worker bilingue déployé avant le site
replie sur `digest` pour le français, et répond par le flux de secours sur la
page anglaise — qui est lui aussi traduit. Les deux ordres sont sûrs, ce qui
supprime le besoin de vérifier lequel a eu lieu.

### Le résumé GitHub

Les noms de langage de l'API sont presque tous ceux de la langue du digest —
`JavaScript`, `TypeScript`, `Python`, `HTML`, `CSS` s'écrivent pareil partout, et
c'est le cas de fait de la majorité des dépôts. Seuls « Jupyter Notebook » et
« Shell » demandent une forme lisible pour le modèle.

## Garde-fous

Les règles qui tiennent l'assistant à sa place sont dans `SYSTEM_PROMPTS`, pas
dans le digest : le digest est une donnée, et une consigne qui y figurerait
serait suivie au lieu d'être obéie.

Une consigne est écrite dans une seule langue et jamais dans les deux à la fois
dans le même prompt : le modèle en lit une par requête, selon la page. C'est ce
qui permet de garder des versions qui ne sont pas des traductions mot à mot —
l'anglais dit « the CONTACT tab on the site », le français « l'onglet CONTACT du
site » — sans avoir à réconcilier deux formulations dans un seul texte.

- **Rate limiting** : 10 requêtes/minute par IP, via le binding `CHAT_LIMIT`
  (voir la section suivante — le premier montage ne tenait pas).
- **Validation** : 24 messages max, 4000 caractères par message, corps de
  64 Ko. Seuls les rôles `user` et `assistant` passent.
- **System prompt injecté côté Worker** : le client ne peut pas le réécrire.
- **`max_tokens`** à 500 : borne le coût et la longueur d'une requête.
- **Annulation** : fermer l'onglet abandonne la requête amont.

Un jeton de rate limiting est consommé par requête du visiteur : le compteur
mesure ce que le visiteur coûte au site.

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

Attendu : `200` et un flux `text/event-stream`.

Un `403` a deux causes distinctes, et le corps `{ error }` dit laquelle :

- **« Origine non autorisée. »** — l'origine n'est pas dans `ALLOWED_ORIGINS`.
  Le Worker rejette la requête *avant* la jauge de rate limiting, donc sans
  consommer de jeton ni de quota d'inférence. Ce rejet est côté serveur, et pas
  seulement l'absence d'en-tête `Access-Control-Allow-Origin` : une requête
  « simple » (`text/plain`, sans preflight) émise par un site tiers en
  `no-cors` ou via `sendBeacon` arrive malgré tout au Worker et serait traitée
  jusqu'à l'appel d'inférence. CORS n'empêche que la *lecture* de la réponse, il
  n'empêche pas la requête d'aboutir.
- **« Je ne peux pas répondre à cette question. »** — la demande a été lue puis
  refusée par la modération OpenRouter (voir « Les refus de modération »).

Un `429` signifie que la jauge par IP est à cran ; le `Retry-After` indique
combien de secondes attendre. Un `504` signifie qu'OpenRouter n'a pas renvoyé
d'en-têtes en 15 secondes — c'est une panne de service, distincte d'un `502`
qui relèverait d'une erreur renvoyée par l'amont.

Si la clé est absente, la réponse est un `500` (« service non configuré »),
visible dans `npm run tail`.