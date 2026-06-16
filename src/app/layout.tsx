import type { Metadata } from "next";
import { Noto_Sans_Thai, Space_Grotesk } from "next/font/google";
import "./globals.css";

const displayFont = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const bodyFont = Noto_Sans_Thai({
  variable: "--font-body",
  subsets: ["latin", "thai"],
});

export const metadata: Metadata = {
  title: "WardFlow",
  description: "Real-time ward work management for clinical teams.",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
    shortcut: "/icon.png",
  },
  appleWebApp: {
    title: "WardFlow",
    capable: true,
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${displayFont.variable} ${bodyFont.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
