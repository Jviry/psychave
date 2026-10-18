import React from 'react';
import { SiteHeader } from '../../components/SiteHeader';
import { SiteFooter } from '../../components/SiteFooter';

/**
 * Site chrome (header + footer) for every public / dashboard route.
 * Lives in the (site) route group so (auth) pages can use the split-screen
 * layout instead.
 */
export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-parchment text-pine font-body">
      <SiteHeader />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 lg:px-8 py-10">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
