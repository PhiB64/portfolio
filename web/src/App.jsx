import { useMemo, useState } from "react";

import { ProjectCard } from "./components/ui/ProjectCard";
import { PillRow } from "./components/ui/PillRow";
import { SectionTitle } from "./components/ui/SectionTitle";
import { UI_TEXT } from "./content/uiText";
import { RESUME, RESUME_SUMMARY, LANGUAGE_LEVELS } from "./content/resume";
import {
  AVATAR_SRC,
  NAV_ITEMS,
  profile,
  projects,
  skills,
} from "./content/siteData";
import { cleanList } from "./utils/cleanList";

export default function App() {
  const [lang, setLang] = useState("fr");

  const displayName = RESUME.name || profile.name;
  const contactEmail = RESUME.email || profile.email;
  const contactPhone = RESUME.phone || null;
  const contactAddress = RESUME.address || null;
  const githubUrl = RESUME.github || profile.github || null;
  const linkedinUrl = RESUME.linkedin || profile.linkedin || null;
  const t = UI_TEXT[lang] || UI_TEXT.fr;
  const resumeSummary = RESUME_SUMMARY[lang] || RESUME_SUMMARY.fr;
  const heroTagline = resumeSummary || profile.tagline;

  const cvSkills = useMemo(() => {
    const cleaned = cleanList(RESUME.skills, { maxItems: 24 });
    return cleaned.filter((s) => !/\b\d{4}\b/.test(s));
  }, []);

  const displayedSkills = cvSkills.length > 0 ? cvSkills : skills;

  const cvLanguages = useMemo(() => {
    return cleanList(RESUME.languages, { maxItems: 8, allowDigits: false });
  }, []);

  const displayedLanguages = useMemo(() => {
    return cvLanguages.map((l) =>
      LANGUAGE_LEVELS[l] ? `${l} — ${LANGUAGE_LEVELS[l]}` : l
    );
  }, [cvLanguages]);

  const cvExperiences = (RESUME.experiences || []).slice(0, 6);
  const cvEducation = (RESUME.education || []).slice(0, 6);

  const displayedProjects = useMemo(() => {
    return projects.map((p) => {
      const description =
        typeof p.description === "string"
          ? p.description
          : p.description?.[lang] || p.description?.fr || "";

      return { ...p, description };
    });
  }, [lang]);

  return (
    <div className="min-h-dvh text-slate-100 selection:bg-fuchsia-400/30 selection:text-white">
      <div className="bg-blobs" aria-hidden="true" />

      <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/50 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <a
            href="#top"
            className="group inline-flex items-center gap-3 font-semibold tracking-tight text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
          >
            <span className="inline-flex h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5 transition-transform duration-200 transform-gpu hover:scale-150 group-focus-visible:scale-150">
              <img
                src={AVATAR_SRC}
                alt={
                  lang === "fr"
                    ? `Avatar de ${displayName}`
                    : `Avatar of ${displayName}`
                }
                className="h-full w-full object-cover transition-transform duration-200 transform-gpu hover:scale-110 group-focus-visible:scale-110"
                loading="eager"
              />
            </span>
            <span>{displayName}</span>
          </a>

          <nav className="hidden items-center gap-6 text-sm text-slate-200 sm:flex">
            {NAV_ITEMS.map((item) => (
              <a key={item.href} className="hover:text-white" href={item.href}>
                {t.nav[item.key]}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setLang((v) => (v === "fr" ? "en" : "fr"))}
              className="inline-flex items-center rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-slate-950/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
              title={
                lang === "fr"
                  ? t.langToggle.titleToEnglish
                  : t.langToggle.titleToFrench
              }
              aria-label={
                lang === "fr"
                  ? t.langToggle.ariaToEnglish
                  : t.langToggle.ariaToFrench
              }
            >
              {lang === "fr" ? t.langToggle.toEnglish : t.langToggle.toFrench}
            </button>

            <a
              href="#contact"
              className="inline-flex items-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              {t.headerCta}
            </a>
          </div>
        </div>
      </header>

      <main id="top" className="mx-auto max-w-6xl px-5">
        <section className="py-16 sm:py-24">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-slate-200/90">
              {t.heroMeta.role} • {t.heroMeta.location}
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-6xl">
              {t.heroTitle}
              <span className="block text-slate-200/90">{t.heroSubtitle}</span>
            </h1>
            <p className="mt-5 text-base leading-relaxed text-slate-200/90 sm:text-lg">
              {heroTagline}
            </p>

            <div className="mt-6">
              <PillRow items={profile.highlights} />
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#projets"
                className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
              >
                {t.heroProjectsCta}
              </a>
              <a
                href={`mailto:${contactEmail}`}
                className="inline-flex items-center rounded-xl bg-slate-900/60 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-900/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/60"
              >
                {contactEmail}
              </a>
            </div>

            <p className="mt-4 text-xs text-slate-400">
              {t.configHint} <span className="font-mono">src/App.jsx</span>.
            </p>
          </div>
        </section>

        <section id="projets" className="py-16">
          <SectionTitle
            kicker={t.sections.projects.kicker}
            title={t.sections.projects.title}
          />
          <div className="grid gap-6 md:grid-cols-2">
            {displayedProjects.map((p) => (
              <ProjectCard key={p.title} project={p} />
            ))}
          </div>
        </section>

        <section id="competences" className="py-16">
          <SectionTitle
            kicker={t.sections.skills.kicker}
            title={t.sections.skills.title}
          />
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <PillRow items={displayedSkills} />
          </div>
        </section>

        <section id="apropos" className="py-16">
          <SectionTitle
            kicker={t.sections.about.kicker}
            title={t.sections.about.title}
          />
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <h3 className="text-lg font-semibold text-white">
                {t.about.valueTitle}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-200/90">
                {t.about.valueBody}
              </p>
              {resumeSummary && (
                <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/30 p-4">
                  <p className="text-xs font-medium text-slate-300">
                    {t.about.cvExtract}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-200/90">
                    {resumeSummary}
                  </p>
                </div>
              )}
              <div className="mt-5">
                <PillRow
                  items={["Design system", "Clean UI", "A11y", "Perf", "DX"]}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <h3 className="text-lg font-semibold text-white">
                {t.about.resumeTitle}
              </h3>

              {(cvEducation.length > 0 || cvExperiences.length > 0) && (
                <div className="mt-4 grid gap-4">
                  {cvEducation.length > 0 && (
                    <div className="rounded-xl border border-white/10 bg-slate-950/30 p-4">
                      <p className="text-xs font-medium text-slate-300">
                        {t.about.education}
                      </p>
                      <ul className="mt-2 grid gap-2 text-sm text-slate-200/90">
                        {cvEducation.map((e) => (
                          <li key={`${e.dates}-${e.text}`}>
                            <span className="text-slate-300">{e.dates}</span> —{" "}
                            {e.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {cvExperiences.length > 0 && (
                    <div className="rounded-xl border border-white/10 bg-slate-950/30 p-4">
                      <p className="text-xs font-medium text-slate-300">
                        {t.about.experience}
                      </p>
                      <ul className="mt-2 grid gap-2 text-sm text-slate-200/90">
                        {cvExperiences.map((e) => (
                          <li key={`${e.dates}-${e.text}`}>
                            <span className="text-slate-300">{e.dates}</span> —{" "}
                            {e.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {cvLanguages.length > 0 && (
                    <div className="rounded-xl border border-white/10 bg-slate-950/30 p-4">
                      <p className="text-xs font-medium text-slate-300">
                        {t.about.languages}
                      </p>
                      <div className="mt-2">
                        <PillRow items={displayedLanguages} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        <section id="contact" className="py-16">
          <SectionTitle
            kicker={t.sections.contact.kicker}
            title={t.sections.contact.title}
          />
          <div className="grid gap-6 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur md:grid-cols-2">
            <div>
              <h3 className="text-lg font-semibold text-white">
                {t.contact.availabilityTitle}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-200/90">
                {t.contact.availabilityBody}
              </p>
              {(contactPhone || contactAddress) && (
                <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/30 p-4 text-sm text-slate-200/90">
                  {contactPhone && (
                    <p>
                      {t.contact.phoneLabel}: {contactPhone}
                    </p>
                  )}
                  {contactAddress && (
                    <p className="mt-2 whitespace-pre-line">
                      {t.contact.addressLabel}: {contactAddress}
                    </p>
                  )}
                </div>
              )}
              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  className="inline-flex items-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                  href={`mailto:${contactEmail}`}
                >
                  {t.contact.emailCta}
                </a>
                <a
                  className="inline-flex items-center rounded-xl border border-white/10 bg-slate-950/40 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-slate-950/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
                  href="/cv.pdf"
                  target="_blank"
                  rel="noreferrer"
                >
                  {t.contact.downloadCv}
                </a>
                <a
                  className="inline-flex items-center rounded-xl border border-white/10 bg-slate-950/40 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-slate-950/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
                  href="/lettre-motivation.docx"
                >
                  {t.contact.downloadCoverLetter}
                </a>
                {githubUrl && (
                  <a
                    className="inline-flex items-center rounded-xl border border-white/10 bg-slate-950/40 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-slate-950/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
                    href={githubUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    GitHub
                  </a>
                )}
                {linkedinUrl && (
                  <a
                    className="inline-flex items-center rounded-xl border border-white/10 bg-slate-950/40 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-slate-950/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
                    href={linkedinUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    LinkedIn
                  </a>
                )}
              </div>
            </div>

            <form
              className="rounded-2xl border border-white/10 bg-slate-950/30 p-4"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const formData = new FormData(form);
                const nameValue = formData.get("name");
                const messageValue = formData.get("message");
                const name = typeof nameValue === "string" ? nameValue : "";
                const message =
                  typeof messageValue === "string" ? messageValue : "";
                const subject = encodeURIComponent(
                  `${t.contact.form.subjectPrefix}${
                    name || t.contact.form.subjectFallback
                  }`
                );
                const body = encodeURIComponent(message);
                globalThis.location.href = `mailto:${contactEmail}?subject=${subject}&body=${body}`;
              }}
            >
              <div className="grid gap-3">
                <label className="grid gap-1 text-sm text-slate-200">
                  <span>{t.contact.form.name}</span>
                  <input
                    name="name"
                    required
                    className="h-11 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-white outline-none transition focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/30"
                    placeholder={t.contact.form.namePlaceholder}
                  />
                </label>
                <label className="grid gap-1 text-sm text-slate-200">
                  <span>{t.contact.form.message}</span>
                  <textarea
                    name="message"
                    required
                    rows={5}
                    className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-white outline-none transition focus:border-fuchsia-400/50 focus:ring-2 focus:ring-fuchsia-400/20"
                    placeholder={t.contact.form.messagePlaceholder}
                  />
                </label>

                <button
                  type="submit"
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-sky-400 via-fuchsia-400 to-emerald-300 px-4 text-sm font-semibold text-slate-950 transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                >
                  {t.contact.draftEmail}
                </button>
              </div>
            </form>
          </div>
        </section>

        <footer className="border-t border-white/10 py-10 text-sm text-slate-400">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>
              © {new Date().getFullYear()} {profile.name}. {t.footerRights}
            </p>
            <a className="hover:text-white" href="#top">
              {t.footerBackToTop}
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}
