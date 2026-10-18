import React from 'react';
import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

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
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
