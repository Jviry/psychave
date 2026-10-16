'use client';

import React from 'react';
import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="bg-[#25372D] text-[#F6F9F6] border-t border-[#5D8B69]/40 mt-20">
      <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-10 border-b border-[#5D8B69]/30">
          <div className="md:col-span-2 space-y-3">
            <p className="font-heading text-2xl font-bold tracking-tight text-white">
              PSYCHAVE PH
            </p>
            <p className="text-sm text-[#C0D3C3] max-w-md leading-relaxed">
              PsychAvenuePH matches you with a verified psychologist through guided booking with
              clear session lengths and strict confidentiality.
            </p>
            <p className="text-xs text-[#8FBE8F] pt-1">
              Direct Clinic Coordination: psychaveph.info@gmail.com
            </p>
          </div>

          <div className="space-y-2.5 text-sm">
            <p className="font-heading text-base font-semibold text-[#D0E187]">
              Explore
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[#C0D3C3]">
              <li>
                <Link href="/services" className="hover:text-white transition-colors">
                  Services & session lengths
                </Link>
              </li>
              <li>
                <Link href="/personas" className="hover:text-white transition-colors">
                  Start a booking
                </Link>
              </li>
              <li>
                <Link href="/book" className="hover:text-white transition-colors">
                  Other ways to book
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-white transition-colors">
                  About our practice
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#C0D3C3]/80">
          <p>
            © {new Date().getFullYear()} PSYCHAVE PH (PsychAvenuePH). All clinical services adhere to PAP Ethical Guidelines & RA 10173 Data Privacy standards.
          </p>
          <p className="text-[#8FBE8F]">
            Verified psychologists · Private by design
          </p>
        </div>
      </div>
    </footer>
  );
}
