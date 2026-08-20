import type { Metadata, Viewport } from "next";
import "./globals.css";
import "../styles/day-of-music.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  applicationName: "Day of Music",
  title: "Day of Music",
  description: "A music calendar image maker for weekly album picks.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Day of Music",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    // Declared explicitly (not via the app/icon file convention) so the tab
    // favicon link is emitted deterministically in dev and prod. Points at the
    // transparent vinyl PNGs in public/icons; browsers pick the size they need.
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#18181b",
  width: "device-width",
  initialScale: 1,
  // Paint edge to edge on notched phones. The frame's gutters read the
  // safe-area insets back (see .dom-root / .dom-scrim in day-of-music.css), so
  // nothing lands under the notch or the home indicator.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
