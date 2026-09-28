'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './globals.css';
import { SiteHeader } from '../components/SiteHeader';
import { SiteFooter } from '../components/SiteFooter';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <html lang="en">
      <body>
        <QueryClientProvider client={queryClient}>
          <div className="min-h-screen flex flex-col bg-[#F6F9F6] text-[#25372D] font-body">
            <SiteHeader />
            <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 lg:px-8 py-10">
              {children}
            </main>
            <SiteFooter />
          </div>
        </QueryClientProvider>
      </body>
    </html>
  );
}
