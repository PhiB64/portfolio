"use client";
import { useState } from "react";
import { Mail, Phone, MapPin, Briefcase, Send, User, AtSign, MessageSquare, CheckCircle, AlertCircle } from "lucide-react";
import { ProjectTabs } from "./cube/project-tabs";

const IconGithub = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-[#00a5b0] shrink-0">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.79-.26.79-.58v-2.23c-3.34.73-4.03-1.42-4.03-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.05.14 3.01.4 2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.82 1.1.82 2.22v3.29c0 .32.19.69.8.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z"/>
  </svg>
);

const IconLinkedin = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-[#00a5b0] shrink-0">
    <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zm1.78 13.02H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45C23.2 24 24 23.23 24 22.27V1.73C24 .77 23.2 0 22.22 0z"/>
  </svg>
);

const FORMSPREE_ENDPOINT =
  process.env.NEXT_PUBLIC_FORMSPREE_ENDPOINT || "https://formspree.io/f/xbglwdny";
const CONTACT_EMAIL = "philippebarbosa64@gmail.com";

export function ContactOverlay({ onClose, onSelectProject }) {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState("idle");

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { name, email, message } = form;

    setStatus("sending");
    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ name, email, message }),
      });
      if (res.ok) {
        setStatus("sent");
        return;
      }
      console.error("Formspree a répondu", res.status, await res.text());
    } catch (err) {
      console.error("Échec de l'envoi à Formspree", err);
    }

    setStatus("error");
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto scroll-none" style={{ backgroundColor: "#0a0f1c" }}>
      {typeof onSelectProject === "function" && (
        <ProjectTabs
          contactActive
          onSelect={onSelectProject}
          onContact={onClose}
          onBack={onClose}
        />
      )}
      <div className="mx-auto max-w-3xl px-6 py-20">

        {/* En-tête */}
        <div className="mb-16">
          <p className="text-[#00a5b0] tracking-[0.3em] uppercase text-xs mb-4">CONTACT</p>
          <h1 className="text-5xl font-light text-white mb-3">Philippe Barbosa</h1>
          <p className="text-[#94a3b8] tracking-widest text-sm uppercase">Concepteur Développeur · Full Stack</p>
          <div className="w-16 h-0.5 bg-[#00a5b0] mt-8" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 mb-20">

          {/* Coordonnées */}
          <div>
            <h2 className="text-2xl font-bold text-[#00a5b0] mb-8">Coordonnées</h2>
            <ul className="space-y-7">
              <li className="flex items-start gap-4">
                <Mail size={18} className="text-[#00a5b0] mt-0.5 shrink-0" />
                <div>
                  <p className="text-[#64748b] text-xs tracking-widest uppercase mb-1">Email</p>
                  <a href={`mailto:${CONTACT_EMAIL}`} className="text-white hover:text-[#00a5b0] transition-colors duration-200 text-sm break-all">
                    {CONTACT_EMAIL}
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <Phone size={18} className="text-[#00a5b0] mt-0.5 shrink-0" />
                <div>
                  <p className="text-[#64748b] text-xs tracking-widest uppercase mb-1">Téléphone</p>
                  <a href="tel:0651305916" className="text-white hover:text-[#00a5b0] transition-colors duration-200 text-sm">
                    06 51 30 59 16
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <MapPin size={18} className="text-[#00a5b0] mt-0.5 shrink-0" />
                <div>
                  <p className="text-[#64748b] text-xs tracking-widest uppercase mb-1">Localisation</p>
                  <span className="text-white text-sm">Lons · Pyrénées-Atlantiques (64)</span>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <IconGithub />
                <div>
                  <p className="text-[#64748b] text-xs tracking-widest uppercase mb-1">GitHub</p>
                  <a href="https://github.com/PhiB64" target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#00a5b0] transition-colors duration-200 text-sm">
                    github.com/PhiB64
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <IconLinkedin />
                <div>
                  <p className="text-[#64748b] text-xs tracking-widest uppercase mb-1">LinkedIn</p>
                  <a
                    href="https://www.linkedin.com/in/philippe-barbosa/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white hover:text-[#00a5b0] transition-colors duration-200 text-sm"
                  >
                    linkedin.com/in/philippe-barbosa
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <Briefcase size={18} className="text-[#00a5b0] mt-0.5 shrink-0" />
                <div>
                  <p className="text-[#64748b] text-xs tracking-widest uppercase mb-1">Disponibilité</p>
                  <span className="text-white text-sm">Ouvert aux opportunités</span>
                </div>
              </li>
            </ul>
          </div>

          {/* Formulaire */}
          <div>
            <h2 className="text-2xl font-bold text-[#00a5b0] mb-8">Envoyer un message</h2>
            {status === "sent" ? (
              <div className="bg-[#0f172a] border border-[#1e293b] rounded-lg p-8">
                <div className="flex items-center gap-2 text-[#00a5b0] mb-3">
                  <CheckCircle size={16} />
                  <p className="tracking-widest uppercase text-xs">Message envoyé</p>
                </div>
                <p className="text-[#94a3b8] leading-relaxed text-sm">
                  Merci, votre message a bien été transmis. Je vous répondrai rapidement.
                </p>
              </div>
            ) : status === "error" ? (
              <div className="bg-[#0f172a] border border-[#1e293b] rounded-lg p-8">
                <div className="flex items-center gap-2 text-[#f87171] mb-3">
                  <AlertCircle size={16} />
                  <p className="tracking-widest uppercase text-xs">Envoi impossible</p>
                </div>
                <p className="text-[#94a3b8] leading-relaxed text-sm mb-5">
                  L&apos;envoi automatique n&apos;a pas abouti. Vous pouvez me écrire directement à{" "}
                  <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#00a5b0] hover:underline break-all">
                    {CONTACT_EMAIL}
                  </a>
                  .
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const body = encodeURIComponent(`De : ${form.name} (${form.email})\n\n${form.message}`);
                    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
                      `Contact portfolio – ${form.name}`
                    )}&body=${body}`;
                  }}
                  className="bg-[#00a5b0] text-white tracking-[0.2em] uppercase text-xs py-3 px-6 rounded hover:bg-[#00a5b0]/80 transition-colors duration-200 cursor-pointer border-0"
                >
                  Ouvrir ma messagerie
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="flex items-center gap-2 text-[#64748b] text-xs tracking-widest uppercase mb-2">
                    <User size={13} /> Nom
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Votre nom"
                    className="w-full bg-[#0f172a] border border-[#1e293b] rounded text-white text-sm px-4 py-3 outline-none focus:border-[#00a5b0] transition-colors placeholder:text-[#334155]"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-[#64748b] text-xs tracking-widest uppercase mb-2">
                    <AtSign size={13} /> Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={form.email}
                    onChange={handleChange}
                    placeholder="votre@email.com"
                    className="w-full bg-[#0f172a] border border-[#1e293b] rounded text-white text-sm px-4 py-3 outline-none focus:border-[#00a5b0] transition-colors placeholder:text-[#334155]"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-[#64748b] text-xs tracking-widest uppercase mb-2">
                    <MessageSquare size={13} /> Message
                  </label>
                  <textarea
                    name="message"
                    required
                    rows={5}
                    value={form.message}
                    onChange={handleChange}
                    placeholder="Votre message..."
                    className="w-full bg-[#0f172a] border border-[#1e293b] rounded text-white text-sm px-4 py-3 outline-none focus:border-[#00a5b0] transition-colors placeholder:text-[#334155] resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="w-full bg-[#00a5b0] text-white tracking-[0.2em] uppercase text-xs py-4 rounded hover:bg-[#00a5b0]/80 transition-colors duration-200 cursor-pointer border-0 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Send size={14} /> {status === "sending" ? "Envoi..." : "Envoyer"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
