import gsap from "gsap";

// Caractères utilisés pendant la phase de décodage d'une étiquette.
const DECODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890!@#$%^&*()_-+=[]{}|;:,.<>?";

const randomChar = () =>
  DECODE_CHARS[Math.floor(Math.random() * DECODE_CHARS.length)];

// Anime une étiquette dans un élément DOM : chaque lettre est isolée dans un
// span, brouillée par des caractères aléatoires, puis se résout de gauche à
// droite vers le texte final. Renvoie la timeline GSAP (a tuer via stopScramble).
// Avec option cipher, le texte reste purement brouillé (jamais résolu) et se
// rebrouille en continu : c'est l'état « codé » affiché avant l'exposition.
export function scrambleLabel(el, text, { duration = 0.6, loop = false, loopDelay = 1.2, cipher = false } = {}) {
  const chars = text.split("");
  el.innerHTML = "";
  const spans = chars.map((ch) => {
    const span = document.createElement("span");
    span.style.display = "inline-block";
    span.textContent = ch;
    el.appendChild(span);
    return span;
  });

  const state = { c: 0 };
  const render = () => {
    for (let i = 0; i < spans.length; i++) {
      spans[i].textContent = state.c >= i + 1 ? chars[i] : randomChar();
    }
  };
  render();

  const tl = gsap.timeline({ repeat: loop ? -1 : 0, repeatDelay: loopDelay });
  if (cipher) {
    // state.c reste < 1 : aucune lettre ne se résout jamais ; la tween se
    // répète à l'infini pour que le brouillage continue sans interruption.
    tl.set(state, { c: 0 });
    tl.to(state, {
      c: 0.8,
      duration: 0.05,
      ease: "none",
      repeat: -1,
      onUpdate: render,
    });
  } else {
    tl.to(state, {
      c: chars.length + 1,
      duration,
      ease: "power2.inOut",
      onUpdate: render,
    });
  }

  return tl;
}

// Tue une timeline de décodage précédemment lancée (no-op si absente).
export function stopScramble(tl) {
  if (tl) tl.kill();
}