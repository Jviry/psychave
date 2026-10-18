import React from 'react';
import type { Metadata } from 'next';
import { Archivo, Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

/**
 * Fonts are self-hosted at build time via next/font (no runtime CDN, no FOUT
 * without swap). Display face: Archivo — a wide grotesque used at medium
 * weight for headings (minimal refresh). Its expanded width comes from the
 * variable `wdth` axis (see .font-heading in globals.css). Body: Inter (OFL).
 * Historical: "Proxima Nova Condensed" -> Inter (pre-v2); Fraunces serif
 * (August-Health refresh) -> Archivo (minimal pass).
 */
const headingFont = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  variable: '--font-archivo',
  display: 'swap',
});

const bodyFont = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'PsychAvenuePH — PRC-Verified Mental Health Care in the Philippines',
    template: '%s — PsychAvenuePH',
  },
  description:
    'Structured scheduling with PRC-registered psychologists — transparent pricing, guided intake, and consent-first data handling.',
};

/**
 * Root layout is a server component and the ONLY place that renders
 * <html>/<body>. Route-group layouts ((site), (auth)) provide their own
 * chrome below this — never nest html/body again.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${headingFont.variable} ${bodyFont.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
