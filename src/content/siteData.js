export const AVATAR_SRC = `${import.meta.env.BASE_URL}Image1.png`;

export const NAV_ITEMS = [
  { key: "projects", href: "#projets" },
  { key: "skills", href: "#competences" },
  { key: "about", href: "#apropos" },
  { key: "contact", href: "#contact" },
];

export const profile = {
  name: "Philippe Barbosa",
  role: "Développeur Full Stack",
  location: "France",
  tagline:
    "Je viens de terminer ma formation TP Développeur Web. Je recherche un poste de développeur full stack, motivé et prêt à apprendre en équipe.",
  highlights: ["Fullstack junior", "React", "Node.js", "SQL", "Accessibilité"],
  email: "philippebarbosa64@gmail.com",
  github: "",
  linkedin: "",
};

export const projects = [
  {
    title: "CoolBooking",
    description: {
      fr: "Application full stack de gestion d’annonces et de réservations (comptes, annonces, favoris, messagerie) avec une interface React + Vite et une API REST côté back.",
      en: "Full-stack application for listings and bookings management (accounts, listings, favorites, messaging), with a React + Vite UI and a REST API backend.",
    },
    stack: ["React", "Vite", "Node.js", "Express", "MariaDB"],
    links: [
      { label: "Demo", href: "https://coolbooking.netlify.app/" },
      {
        label: "GitHub",
        href: "https://github.com/PhiB64/back-coolbooking-mariaDB.git",
      },
    ],
  },
  {
    title: "Art & Patrimoine de Doazit",
    description: {
      fr: "Site vitrine moderne pour une association, architecture découplée: frontend Next.js (React/Tailwind) consommant une API Strapi + PostgreSQL avec gestion des médias.",
      en: "Modern showcase website for an association with a decoupled architecture: a Next.js (React/Tailwind) frontend consuming a Strapi + PostgreSQL API with media management.",
    },
    stack: ["Next.js", "React", "Tailwind", "Strapi", "PostgreSQL"],
    links: [{ label: "GitHub", href: "https://github.com/PhiB64/apd.git" }],
  },
];

export const skills = [
  "HTML",
  "CSS",
  "JavaScript",
  "React",
  "Node.js",
  "Express",
  "SQL",
  "Git / GitHub",
];
