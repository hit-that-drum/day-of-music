import type { Metadata, Viewport } from "next";
import "./globals.css";
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
