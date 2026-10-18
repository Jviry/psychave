import React from 'react';
import './globals.css';
import { Providers } from './providers';

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
