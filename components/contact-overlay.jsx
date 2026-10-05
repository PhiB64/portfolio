"use client";
import { useRef, useState } from "react";
import { Mail, Phone, MapPin, Briefcase, Send, User, AtSign, MessageSquare, CheckCircle, AlertCircle } from "lucide-react";
import { ProjectTabs, BackButton } from "./cube/project-tabs";
import { HONEYPOT_FIELD, LIMITS, buildPayload, looksAutomated, validateDraft } from "../lib/contact-form";
import { CONTACT, CONTACT_LOCATION } from "../lib/portfolio-content";
import { uiFor } from "../lib/content/ui.js";

// Icônes de liaison (GitHub, LinkedIn) : décoratives, le lien adjacent porte
// déjà le nom (« github.com/PhiB64 »). `focusable="false"` pour IE/Edge
// legacy, qui rendent sinon le SVG focalisable.
const IconGithub = () => (
  <svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-[#00a5b0] shrink-0">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.79-.26.79-.58v-2.23c-3.34.73-4.03-1.42-4.03-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.05.14 3.01.4 2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.82 1.1.82 2.22v3.29c0 .32.19.69.8.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z"/>
  </svg>
);

const IconLinkedin = () => (
  <svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-[#00a5b0] shrink-0">
    <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zm1.78 13.02H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45C23.2 24 24 23.23 24 22.27V1.73C24 .77 23.2 0 22.22 0z"/>
  </svg>
);

const FORMSPREE_ENDPOINT =
  process.env.NEXT_PUBLIC_FORMSPREE_ENDPOINT || "https://formspree.io/f/xbglwdny";

/**
 * Délai maximal d'un envoi au formulaire, en millisecondes.
 *
 * Aucun n'existait : un service qui accepte la connexion et n'envoie rien
 * laisse le bouton « Envoi... » affiché indéfiniment, avec aucun moyen pour le
 * visiteur de savoir que la demande est perdue — et le formulaire reste
 * verrouillé, puisqu'il est `disabled` pendant l'envoi.
 */
const SEND_TIMEOUT_MS = 15_000;

export function ContactOverlay({ lang, onClose, onSelectProject }) {
  const t = uiFor(lang).contact;
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState("idle");
  // Erreur de saisie, distincte de `status === "error"` : un envoi refusé par
  // Formspree propose de passer par le courriel, alors qu'une adresse mal saisie
  // demande de la corriger sur place. Les deux dans le même état donneraient au
  // visiteur une consigne qui ne s'applique pas à son cas.
  const [formError, setFormError] = useState(null);

  // Instant d'ouverture du formulaire, pour le filtre de délai. Une `ref` et pas
  // un état : c'est une mesure prise au montage, jamais lue au rendu, donc elle
  // n'a pas sa place dans le chemin déclaratif.
  const openedAtRef = useRef(null);
  if (openedAtRef.current === null) openedAtRef.current = Date.now();

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    // Toute frappe efface l'erreur : la laisser affichée ferait croire que la
    // saisie suivante est aussi refusée que la précédente.
    setFormError(null);
  };

  // Le piège n'emprunte pas `handleChange` : celui-ci dérive la clé d'état du
  // nom DOM, ce qui est juste pour les trois champs visibles — `name`, `email`,
  // `message` portent le même nom dans les deux mondes — mais pas ici, où les
  // deux noms sont différents par construction. Passé par `handleChange`, il
  // écrivait dans l'état sous une clé que rien ne lit.
  const handleHoneypot = (e) => setForm((prev) => ({ ...prev, honeypot: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const draft = { ...form, elapsedMs: Date.now() - openedAtRef.current };

    // Le filtre tourne avant la validation, et son résultat n'est jamais dit.
    // Un robot qui reçoit une confirmation n'essaie pas une seconde fois ; un
    // humain qui reçoit un faux échec n'a qu'à renvoyer son message. Voir
    // `lib/contact-form.js` pour pourquoi la réponse est muette.
    if (looksAutomated(draft)) {
      setStatus("sent");
      return;
    }

    const check = validateDraft(draft, { lang });
    if (!check.ok) {
      setFormError(check.error);
      return;
    }

    setStatus("sending");
    // L'annulation est portée par le `finally` : sans cela, un formulaire qui
    // reste en « Envoi... » ne pourra jamais être renvoyé, le bouton étant
    // désactivé jusqu'à la fin.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(buildPayload(draft)),
        signal: controller.signal,
      });
      if (res.ok) {
        setStatus("sent");
        return;
      }
      console.error("Formspree a répondu", res.status, await res.text());
    } catch (err) {
      // L'expiration et la fermeture par le navigateur produisent la même
      // `AbortError`, et le diagnostic utile est le même : rien n'a été
      // transmis, le visiteur doit réessayer ou écrire.
      console.error("Échec de l'envoi à Formspree", err);
    } finally {
      clearTimeout(timer);
    }

    setStatus("error");
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto scroll-none" style={{ backgroundColor: "#0a0f1c" }}>
      {typeof onSelectProject === "function" && (
        <ProjectTabs
          lang={lang}
          contactActive
          onSelect={onSelectProject}
          onContact={onClose}
          onBack={onClose}
        />
      )}
      <div className="mx-auto max-w-3xl px-6 py-20">

        {/* En-tête. Le `h1` porte l'`id` repris par `aria-labelledby` du
            dialog parent : sans nom accessible, un lecteur d'écran annonce
            « boîte de dialogue » et rien d'autre. */}
        <div className="mb-16">
          <p className="text-[#00a5b0] tracking-[0.3em] uppercase text-xs mb-4">CONTACT</p>
          <h1 id="contact-overlay-title" className="text-5xl font-light text-white mb-3">Philippe Barbosa</h1>
          <p className="text-[#94a3b8] tracking-widest text-sm uppercase">{t.jobTitle}</p>
          <div className="w-16 h-0.5 bg-[#00a5b0] mt-8" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 mb-20">

          {/* Coordonnées */}
          <div>
            <h2 className="text-2xl font-bold text-[#00a5b0] mb-8">{t.coordinates}</h2>
            <ul className="space-y-7">
              <li className="flex items-start gap-4">
                <Mail size={18} className="text-[#00a5b0] mt-0.5 shrink-0" />
                <div>
                  <p className="text-[#7c8ca1] text-xs tracking-widest uppercase mb-1">Email</p>
                  <a href={`mailto:${CONTACT.email}`} className="text-white hover:text-[#00a5b0] transition-colors duration-200 text-sm break-all">
                    {CONTACT.email}
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <Phone size={18} className="text-[#00a5b0] mt-0.5 shrink-0" />
                <div>
                  <p className="text-[#7c8ca1] text-xs tracking-widest uppercase mb-1">{t.phone}</p>
                  <a href={CONTACT.phoneHref} className="text-white hover:text-[#00a5b0] transition-colors duration-200 text-sm">
                    {CONTACT.phoneDisplay}
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <MapPin size={18} className="text-[#00a5b0] mt-0.5 shrink-0" />
                <div>
                  <p className="text-[#7c8ca1] text-xs tracking-widest uppercase mb-1">Localisation</p>
                  <span className="text-white text-sm">{CONTACT_LOCATION}</span>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <IconGithub />
                <div>
                  <p className="text-[#7c8ca1] text-xs tracking-widest uppercase mb-1">GitHub</p>
                  <a href={CONTACT.githubUrl} target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#00a5b0] transition-colors duration-200 text-sm">
                    {CONTACT.githubLabel}
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <IconLinkedin />
                <div>
                  <p className="text-[#7c8ca1] text-xs tracking-widest uppercase mb-1">LinkedIn</p>
                  <a
                    href={CONTACT.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white hover:text-[#00a5b0] transition-colors duration-200 text-sm"
                  >
                    {CONTACT.linkedinLabel}
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <Briefcase size={18} className="text-[#00a5b0] mt-0.5 shrink-0" />
                <div>
                  <p className="text-[#7c8ca1] text-xs tracking-widest uppercase mb-1">{t.availability}</p>
                  <span className="text-white text-sm">{t.available}</span>
                </div>
              </li>
            </ul>
          </div>

          {/* Formulaire */}
          <div>
            <h2 className="text-2xl font-bold text-[#00a5b0] mb-8">{t.sendMessage}</h2>
            {/* `aria-live` sur un conteneur stable : les annonces de changement
                d'état (envoi, succès, échec) ne sont entendues que si la région
                existe déjà au moment où son contenu change. Posé sur le `div`
                conditionnel, il serait recréé au changement et resterait muet. */}
            <div aria-live="polite" aria-atomic="true">
            {status === "sent" ? (
              <div className="bg-[#0f172a] border border-[#1e293b] rounded-lg p-8">
                <div className="flex items-center gap-2 text-[#00a5b0] mb-3">
                  <CheckCircle size={16} />
                  <p className="tracking-widest uppercase text-xs">{t.sent}</p>
                </div>
                <p className="text-[#94a3b8] leading-relaxed text-sm">
                  {t.sentBody}
                </p>
              </div>
            ) : status === "error" ? (
              <div className="bg-[#0f172a] border border-[#1e293b] rounded-lg p-8">
                <div className="flex items-center gap-2 text-[#f87171] mb-3">
                  <AlertCircle size={16} />
                  <p className="tracking-widest uppercase text-xs">{t.failed}</p>
                </div>
                <p className="text-[#94a3b8] leading-relaxed text-sm mb-5">
                  {t.failedBody}{" "}
                  <a href={`mailto:${CONTACT.email}`} className="text-[#00a5b0] hover:underline break-all">
                    {CONTACT.email}
                  </a>
                  .
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const body = encodeURIComponent(`De : ${form.name} (${form.email})\n\n${form.message}`);
                    window.location.href = `mailto:${CONTACT.email}?subject=${encodeURIComponent(
                      `Contact portfolio – ${form.name}`
                    )}&body=${body}`;
                  }}
                  className="bg-[#00a5b0] text-[#0a0f1c] tracking-[0.2em] uppercase text-xs py-3 px-6 rounded hover:bg-[#00a5b0]/80 transition-colors duration-200 cursor-pointer border-0"
                >
                  {t.openMail}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="contact-name"
                    className="flex items-center gap-2 text-[#7c8ca1] text-xs tracking-widest uppercase mb-2"
                  >
                    <User size={13} aria-hidden="true" /> {t.name}
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    name="name"
                    required
                    maxLength={LIMITS.name}
                    autoComplete="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder={t.namePlaceholder}
                    className="w-full bg-[#0f172a] border border-[#1e293b] rounded text-white text-sm px-4 py-3 outline-none focus:border-[#00a5b0] transition-colors placeholder:text-[#728296]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="contact-email"
                    className="flex items-center gap-2 text-[#7c8ca1] text-xs tracking-widest uppercase mb-2"
                  >
                    <AtSign size={13} aria-hidden="true" /> {t.email}
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    name="email"
                    required
                    maxLength={LIMITS.email}
                    autoComplete="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="votre@email.com"
                    className="w-full bg-[#0f172a] border border-[#1e293b] rounded text-white text-sm px-4 py-3 outline-none focus:border-[#00a5b0] transition-colors placeholder:text-[#728296]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="contact-message"
                    className="flex items-center gap-2 text-[#7c8ca1] text-xs tracking-widest uppercase mb-2"
                  >
                    <MessageSquare size={13} aria-hidden="true" /> {t.message}
                  </label>
                  <textarea
                    id="contact-message"
                    name="message"
                    required
                    rows={5}
                    maxLength={LIMITS.message}
                    value={form.message}
                    onChange={handleChange}
                    placeholder={t.messagePlaceholder}
                    className="w-full bg-[#0f172a] border border-[#1e293b] rounded text-white text-sm px-4 py-3 outline-none focus:border-[#00a5b0] transition-colors placeholder:text-[#728296] resize-none"
                  />
                </div>

                {/* Pot de miel. Le champ est hors du flux et masqué au lecteur
                    d'écran : un humain ne le voit ni ne le remplit, un script qui
                    parcourt tous les champs le complète. `type="text"` et non
                    `hidden` — un `hidden` n'est pas rendu, donc le navigateur ne
                    le soumet pas, et le piège ne verrait rien. `tabIndex={-1}`
                    l'exclut aussi de la navigation au clavier, au cas où le
                    masquage CSS viendrait à échouer. */}
                <div className="absolute -left-[9999px]" aria-hidden="true">
                  <label htmlFor="contact-website">{t.honeypot}</label>
                  <input
                    id="contact-website"
                    type="text"
                    name={HONEYPOT_FIELD}
                    tabIndex={-1}
                    autoComplete="off"
                    // L'état porte la clé `honeypot`, le DOM porte
                    // `HONEYPOT_FIELD`. Les deux ne sont pas le même nom : le
                    // premier est ce que `looksAutomated` lit, le second est ce
                    // que le piège doit s'appeler pour les Robots qui
                    // parcourent les champs. Les confondre donnait un piège
                    // présent, soumis, et jamais lu — donc inerte.
                    value={form.honeypot}
                    onChange={handleHoneypot}
                  />
                </div>

                {/* Erreur de saisie. `role="alert"` plutôt qu'un simple
                    `aria-live` : l'erreur doit être annoncée *maintenant*, pas
                    seulement la prochaine fois que la zone est mise à jour. */}
                {formError && (
                  <p
                    role="alert"
                    className="flex items-center gap-2 text-[#f87171] text-sm"
                  >
                    <AlertCircle size={14} aria-hidden="true" /> {formError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status === "sending"}
                  aria-busy={status === "sending"}
                  className="w-full bg-[#00a5b0] text-[#0a0f1c] tracking-[0.2em] uppercase text-xs py-4 rounded hover:bg-[#00a5b0]/80 transition-colors duration-200 cursor-pointer border-0 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Send size={14} aria-hidden="true" /> {status === "sending" ? t.sending : t.send}
                </button>
              </form>
            )}
            </div>
          </div>
        </div>

        {/* Retour en bas de page sur mobile, où la barre d'onglets est masquée */}
        <div className="text-center mt-20 sm:hidden">
          <BackButton lang={lang} onClick={onClose} />
        </div>
      </div>
    </div>
  );
}
