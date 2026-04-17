import './globals.css';

export const metadata = {
  title: 'AEGIS SERVICE - Gestion',
  description: 'Application de gestion AEGIS SERVICE',
  manifest: '/manifest.json',
  themeColor: '#c9a44a',
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="AEGIS" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </head>
      <body>{children}</body>
    </html>
  );
}
