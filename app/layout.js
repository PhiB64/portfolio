import "./globals.css";

export const metadata = {
  title: "Philippe Barbosa — Concepteur Développeur",
  description:
    "Portfolio de Philippe Barbosa, concepteur développeur full stack (React, Next.js, Node.js). Découvrez ses projets web, mobile et back-end, du code en production.",
  icons: {
    icon: [{ url: "/favicon.png", sizes: "any", type: "image/png" }],
    apple: "/favicon.png",
  },
  openGraph: {
    title: "Philippe Barbosa — Concepteur Développeur",
    description:
      "Portfolio créatif : cube 3D interactif, projets web, mobile et back-end.",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}