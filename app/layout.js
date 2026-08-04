import "./globals.css";

export const metadata = {
  title: "Portfolio",
  description: "Mon portfolio créatif",
  icons: {
    icon: [{ url: "/favicon.png", sizes: "any", type: "image/png" }],
    apple: "/favicon.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
