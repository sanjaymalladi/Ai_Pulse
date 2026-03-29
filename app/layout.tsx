import type { Metadata } from "next";
import { Syne, Space_Mono } from "next/font/google";
import "./globals.css";

const syne = Syne({
  variable: "--font-heading",
  subsets: ["latin"],
});

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  variable: "--font-sys",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI PULSE DATA // NEXT",
  description: "Next.js migration of AI News Terminal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${spaceMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
