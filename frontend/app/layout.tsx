import React from 'react';
import type { Metadata } from 'next';
import { Archivo_Narrow, Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

/**
 * Fonts are self-hosted at build time via next/font (no runtime CDN, no FOUT
 * without swap). Brand never-shipped faces: "Proxima Nova Condensed" ->
 * Archivo Narrow (condensed, OFL); "Aileron" -> Inter (body, OFL).
 */
const headingFont = Archivo_Narrow({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-archivo-narrow',
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
