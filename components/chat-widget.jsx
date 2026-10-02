"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, RotateCcw, Send, X } from "lucide-react";

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

const GREETING = "Bonjour ! Je suis l'assistant de Philippe. Posez-moi une question sur ses projets, ses compétences ou son parcours.";

/**
 * Lit un flux SSE au format OpenAI et appelle `onDelta` à chaque fragment de
 * texte. Workers AI émet déjà ce format, le Worker le relaie tel quel.
 *
 * @param {ReadableStreamDefaultReader<Uint8Array>} body
 * @param {(delta: string) => void} onDelta
 */
async function readStream(body, onDelta) {
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
        if (payload === "[DONE]") return;

        try {
          const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
          if (delta) onDelta(delta);
        } catch {
          // Trame illisible : on l'ignore, la suivante prend le relais.
        }
      }
    }
  }
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const abortRef = useRef(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  // Descend avec la conversation : le texte arrive fragment par fragment, donc
  // on se cale sur chaque delta pour rester collé à la dernière ligne écrite.
  useEffect(() => {
    const node = listRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Referme le panneau sans laisser la requête en vol : le visiteur emporte
  // sinon la génération avec lui, pour rien.
  useEffect(() => () => abortRef.current?.abort(), []);

  const close = useCallback(() => {
    abortRef.current?.abort();
    setOpen(false);
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setBusy(false);
    inputRef.current?.focus();
  }, []);

  async function send(event) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || busy) return;

    const history = [...messages, { role: "user", content }];
    // Bulle vide réservée à la réponse en cours, remplie delta par delta.
    setMessages([...history, { role: "assistant", content: "" }]);
    setDraft("");
    setError(null);
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.slice(-HISTORY_LIMIT).map(({ role, content: text }) => ({
            role,
            content: text,
          })),
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        // Le Worker renvoie toujours `{ error }` sur une erreur : on le montre
        // tel quel, il est déjà rédigé pour le visiteur.
        let message = "Le service de discussion ne répond pas.";
        try {
          const data = await res.json();
          if (data?.error) message = data.error;
        } catch {
          // Pas de JSON lisible (HTML d'erreur, réseau coupé) : texte par défaut.
        }
        throw new Error(message);
      }

      await readStream(res.body, (delta) => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          next[next.length - 1] = { ...last, content: last.content + delta };
          return next;
        });
      });
    } catch (err) {
      if (err?.name === "AbortError") {
        // Le visiteur a fermé le panneau ou relancé une question : il n'est
        // plus là pour lire une erreur, et le texte partiel déjà affiché suffit.
      } else {
        setError(err?.message ?? "Une erreur est survenue.");
      }
      // Pas de bulle d'erreur dupliquée dans le fil : elle vit dans la bannière.
      setMessages((prev) =>
        prev[prev.length - 1]?.role === "assistant" && !prev[prev.length - 1].content
          ? prev.slice(0, -1)
          : prev,
      );
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  // Le panneau ne s'affiche pas si le Worker n'est pas configuré. Le retour
  // arrive APRÈS tous les hooks : les mettre avant ferait dépendre le nombre de
  // hooks appelés d'une constante, ce qui casse la règle d'appel inconditionnel.
  if (!ENDPOINT) return null;

  const canSend = draft.trim().length > 0 && !busy;
  const lastIsPending = busy && messages[messages.length - 1]?.role === "assistant";

  return (
    <>
      {/* Panneau. `z-40` le place au-dessus du contenu du cube (`z-30` max) mais
          sous les plein écran de l'overlay de contact et du CV (`z-50`/`z-100`) :
          ouvrir l'un d'eux masque donc le chat au lieu de le laisser flotter. */}
      {open && (
        <section
          aria-label="Assistant de Philippe"
          className="fixed inset-x-4 top-20 z-40 flex max-h-[calc(var(--svh)-7rem)] flex-col overflow-hidden rounded-2xl border border-[#1e293b] bg-[#0f172a]/95 shadow-2xl shadow-black/50 backdrop-blur-md sm:inset-x-auto sm:right-8 sm:w-96"
        >
          <header className="flex items-center justify-between gap-3 border-b border-[#1e293b] px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageCircle size={16} className="text-[#00a5b0]" />
              <p className="text-xs uppercase tracking-widest text-[#94a3b8]">Assistant</p>
            </div>
            <button
              type="button"
              onClick={reset}
              aria-label="Effacer la conversation"
              disabled={messages.length === 0}
              className="text-[#64748b] transition-colors duration-200 hover:text-[#00a5b0] disabled:cursor-not-allowed disabled:opacity-30"
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
              <p className="text-sm leading-relaxed text-[#94a3b8]">{GREETING}</p>
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
                          ? "max-w-[85%] rounded-2xl rounded-br-sm bg-[#00a5b0] px-3 py-2 text-sm text-white"
                          : "max-w-[85%] rounded-2xl rounded-bl-sm border border-[#1e293b] bg-[#0a0f1c] px-3 py-2 text-sm leading-relaxed text-[#e2e8f0]"
                      }
                    >
                      {isPending ? (
                        <span className="flex items-center gap-2 py-1 text-[#64748b]">
                          <Loader2 size={14} className="animate-spin" />
                          <span className="text-xs">rédaction…</span>
                        </span>
                      ) : (
                        <span className="whitespace-pre-wrap break-words">{message.content}</span>
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
                Votre message
              </label>
              <input
                id="chat-input"
                ref={inputRef}
                type="text"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Votre question…"
                maxLength={4000}
                autoComplete="off"
                className="min-w-0 flex-1 rounded-lg border border-[#1e293b] bg-[#0a0f1c] px-3 py-2 text-sm text-[#e2e8f0] placeholder:text-[#64748b] focus:border-[#00a5b0] focus:outline-none"
              />
              <button
                type="submit"
                disabled={!canSend}
                aria-label="Envoyer le message"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#00a5b0] text-white transition-colors duration-200 hover:bg-[#00a5b0]/80 disabled:cursor-not-allowed disabled:opacity-30"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-[#64748b]">
              Réponses générées par IA — vérifiez les informations importantes.
            </p>
          </form>
        </section>
      )}

      {/* Lanceur, en haut à droite. Le bouton « retour en haut » du cube reste
          en bas à droite : plus de conflit de coin, donc plus d'empilement. */}
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-label={open ? "Fermer l'assistant" : "Ouvrir l'assistant"}
        className="fixed top-4 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-[#00a5b0]/60 bg-[#0a0f1c]/80 text-[#00a5b0] backdrop-blur-md transition-colors duration-300 hover:bg-[#00a5b0]/10 hover:text-white sm:top-6 sm:right-8"
      >
        {open ? <X size={20} /> : <MessageCircle size={20} />}
      </button>
    </>
  );
}
