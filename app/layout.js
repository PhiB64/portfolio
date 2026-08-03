import "./globals.css";

export const metadata = {
  title: "Portfolio",
  description: "Mon portfolio créatif",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
