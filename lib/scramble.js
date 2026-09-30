import gsap from "gsap";

// Caractères utilisés pendant la phase de décodage d'une étiquette.
const DECODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890!@#$%^&*()_-+=[]{}|;:,.<>?";

// Cadence à laquelle un état « codé » re-brouille ses caractères. Sans effet sur
// la vitesse perçue (chaque frame change déjà le rendu), mais borne la cadence
// des écritures DOM.
const CIPHER_REFRESH_MS = 0.05;

const randomChar = () =>
  DECODE_CHARS[Math.floor(Math.random() * DECODE_CHARS.length)];

// Anime une étiquette dans un élément DOM : chaque lettre est isolée dans un
// span, brouillée par des caractères aléatoires, puis se résout de gauche à droite
// vers le texte final. Renvoie la timeline GSAP (a tuer via stopScramble).
// Avec option cipher, le texte reste purement brouillé (jamais résolu) et se
// rebrouille en continu : c'est l'état « codé » affiché avant l'exposition.
export function scrambleLabel(el, text, { duration = 0.6, cipher = false } = {}) {
  el.innerHTML = "";
  // Un span par lettre, insécable.
  const spans = [];
  // Dernier caractère écrit par span : les caractères déjà résolus ne changent
  // plus, inutile de réécrire leur `textContent` à chaque frame (~une écriture
  // DOM inutile par caractère et par frame, sur tous les labels animés).
  const shown = [];
  // Seuil de résolution de chaque span, en valeur de `state.c`. Un seuil par
  // lettre, croissant : c'est cet ordre qui fait l'écriture de gauche à droite.
  const thresholds = [];
  // Lettre destination du span de même index, relue par `render`. Elle vit à côté
  // des spans plutôt que dans leur `textContent`, que le brouillage écrase.
  const finals = [];
  // Un tour de parole par lettre : l'échelle sur laquelle `state.c` progresse,
  // donc la durée s'y répartit.
  const turns = text.length;

  const addLetter = (ch, threshold) => {
    const span = document.createElement("span");
    span.style.display = "inline-block";
    span.textContent = ch;
    thresholds.push(threshold);
    finals.push(ch);
    shown.push(null);
    spans.push(span);
    return span;
  };

  // Ajoute ce qui ne s'anime pas et ne consomme aucun tour : un saut de ligne.
  // `null` dans `spans`, que `render` saute — et donc une destination jamais
  // relue.
  const addStatic = (node) => {
    el.appendChild(node);
    thresholds.push(Infinity);
    finals.push(null);
    shown.push(null);
    spans.push(null);
  };

  text.split("").forEach((ch, i) => {
    // Un saut de ligne devient un `<br>` plutôt qu'un span : les spans sont des
    // `inline-block` dans un conteneur flex (les labels de face se centrent par
    // flex), où `<br>` ne coupe aucune ligne.
    if (ch === "\n") {
      addStatic(document.createElement("br"));
    } else {
      el.appendChild(addLetter(ch, i + 0.5));
    }
  });

  const state = { c: 0 };
  const render = () => {
    for (let i = 0; i < spans.length; i++) {
      if (!spans[i]) continue;
      // Résolution à mi-parcours (0,5) plutôt qu'à la fin (1) : le label est
      // lisible dès la moitié de la durée, la fin de la tween ne fait plus que
      // confirmer. Au seuil 1 le texte n'était lisible qu'à l'instant exact où
      // l'animation s'arrêtait, sans marge de lecture.
      // `cipher` prime sur le seuil : rien ne se résout tant que le texte est
      // « codé », quelle que soit la valeur prise par `state.c`. Sans ce test,
      // les premières lettres se résolvaient par à-coups au passage de la phase
      // codée — un début de message lisible, juste assez pour se demander s'il
      // était là ou non.
      const next = cipher || state.c < thresholds[i] ? randomChar() : finals[i];
      if (shown[i] !== next) {
        shown[i] = next;
        spans[i].textContent = next;
      }
    }
  };
  render();

  if (cipher) {
    // État « codé » : le texte reste brouillé indéfiniment (cf. `render`), la
    // tween ne sert qu'à faire tourner `render` en continu ; sa durée (0,05 s)
    // est la cadence de re-brouillage, pas une durée d'animation. `state.c`
    // reste sous 1 pour qu'aucun seuil de résolution ne soit atteint.
    const tl = gsap.timeline();
    tl.set(state, { c: 0 });
    tl.to(state, {
      c: 0.8,
      duration: CIPHER_REFRESH_MS,
      ease: "none",
      repeat: -1,
      onUpdate: render,
    });
    return tl;
  }

  return gsap.timeline().to(state, {
    // Un tour de marge au-delà du dernier seuil : la tween se termine sur du
    // texte stable, lisible, plutôt que sur sa résolution exacte.
    c: turns + 1,
    duration,
    ease: "power2.inOut",
    onUpdate: render,
  });
}

// Tue une timeline de décodage précédemment lancée (no-op si absente).
export function stopScramble(tl) {
  if (tl) tl.kill();
}
