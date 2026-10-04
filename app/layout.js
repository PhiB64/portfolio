import "./globals.css";
import { Share_Tech_Mono } from "next/font/google";
import { SITE_ROOT, assetUrl } from "../lib/site-url";

const shareTechMono = Share_Tech_Mono({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-share-tech-mono",
  display: "swap",
});

// La racine publique (domaine + préfixe de sous-dossier) est calculée une seule
// fois dans `lib/site-url.js`, importée aussi par `robots.js` et `sitemap.js` :
// les trois doivent produire exactement la même URL.
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
  // `"/"` aurait produit `https://phib64.github.io/` via `metadataBase`, soit
  // la page utilisateur GitHub et pas le portfolio. La canonique doit inclure
  // le sous-dossier `/portfolio`.
  alternates: { canonical: SITE_ROOT },
  robots: { index: true, follow: true },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_ROOT,
    siteName: "Portfolio Philippe Barbosa",
    locale: "fr_FR",
    type: "website",
    // PNG 1200x630 explicite : les crawlers LinkedIn/X recadrent ou refusent
    // le WebP carré 512, qui reste déclaré en second pour les clients qui le
    // gèrent.
    images: [
      {
        url: assetUrl("/og-image.png"),
        width: 1200,
        height: 630,
        alt: "Philippe Barbosa — Concepteur Développeur Full Stack",
      },
      {
        url: `${SITE_ROOT}/icon.webp`,
        width: 512,
        height: 512,
        alt: "Logo de Philippe Barbosa",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [assetUrl("/og-image.png")],
  },
  icons: {
    // Ordre de préférence : `.ico` multi-tailles pour les navigateurs
    // anciens, WebP existant conservé, PNG pour la PWA et iOS.
    icon: [
      { url: assetUrl("/favicon.ico"), sizes: "16x16 32x32 48x48" },
      { url: assetUrl("/favicon.webp"), type: "image/webp" },
      { url: assetUrl("/icon-192.png"), sizes: "192x192", type: "image/png" },
      { url: assetUrl("/icon-512.png"), sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: assetUrl("/apple-touch-icon.png"), sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: TITLE,
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
  image: assetUrl("/og-image.png"),
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
    <html lang="fr" className={shareTechMono.variable}>
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
