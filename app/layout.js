import "./globals.css";

// URL publique du site. À ajuster selon l'hébergement (NEXT_PUBLIC_SITE_URL),
// sinon fallback sur l'adresse GitHub Pages du dépôt.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://phib64.github.io";
const SITE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const SITE_ROOT = `${SITE_URL}${SITE_PATH}`;

const TITLE = "Philippe Barbosa — Concepteur Développeur";
const DESCRIPTION =
  "Portfolio de Philippe Barbosa, concepteur développeur full stack (React, Next.js, Node.js, TypeScript). Du web au mobile en passant par le back-end, les bases de données et le cloud : des projets réels, du code en production.";

export const metadata = {
  metadataBase: new URL(SITE_ROOT),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "Portfolio Philippe Barbosa",
  authors: [{ name: "Philippe Barbosa", url: SITE_ROOT }],
  creator: "Philippe Barbosa",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_ROOT,
    siteName: "Portfolio Philippe Barbosa",
    locale: "fr_FR",
    type: "website",
    images: [
      {
        url: "/icon.webp",
        width: 512,
        height: 512,
        alt: "Logo de Philippe Barbosa",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/icon.webp"],
  },
  icons: {
    icon: [{ url: "/favicon.webp", sizes: "any", type: "image/webp" }],
    apple: "/favicon.webp",
  },
};

export const viewport = {
  themeColor: "#0a0f1c",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Philippe Barbosa",
  jobTitle: "Concepteur Développeur",
  url: SITE_ROOT,
  image: `${SITE_ROOT}/favicon.webp`,
  email: "mailto:philippebarbosa64@gmail.com",
  telephone: "+33651305916",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Lons",
    addressRegion: "Pyrénées-Atlantiques",
    addressCountry: "FR",
  },
  sameAs: [
    "https://github.com/PhiB64",
    "https://www.linkedin.com/in/philippe-barbosa/",
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}