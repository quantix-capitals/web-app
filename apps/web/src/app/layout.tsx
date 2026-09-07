import type { Metadata } from "next";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import { AppShell } from "@/components/shell/app-shell";
import "./globals.css";

/**
 * Three faces, each with one job. Geist sets the interface. Source Serif carries
 * the page titles and the measured figures — a serif is what makes a page of
 * numbers read as a statement rather than a dashboard. Geist Mono is reserved
 * for identifiers you might read character by character: symbols and folios.
 */
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Stealth Mode — Momentum, found and managed",
  description:
    "An agent that hunts momentum across the market and manages the book you build from it.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${sourceSerif.variable} font-sans antialiased`}
      >
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
