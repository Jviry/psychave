import React from 'react';
import type { Metadata } from 'next';
import { Barlow, Barlow_Condensed } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

/**
 * Fonts are self-hosted at build time via next/font (no runtime CDN).
 * Display face: Barlow Condensed (clean condensed sans matching Proxima Nova Condensed).
 * Body/UI face: Barlow (crisp grotesque sans matching Aileron).
 */
const headingFont = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-barlow-condensed',
  display: 'swap',
});

const bodyFont = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-barlow',
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
