'use client';

import React from 'react';
import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="bg-[#25372D] text-[#F6F9F6] border-t border-[#5D8B69]/40 mt-20">
      <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-[#5D8B69]/30">
          <div className="md:col-span-2 space-y-3">
            <p className="font-heading text-2xl font-bold tracking-tight text-white">
              PSYCHAVE PH
            </p>
            <p className="text-sm text-[#C0D3C3] max-w-md leading-relaxed">
              PsychAvenuePH is a structured Philippine mental-health booking platform built around
              canonical Flow C booking, PRC-verified resident psychologists, explicit clinical duration
              guardrails, and strict confidentiality governance.
            </p>
            <p className="text-xs text-[#8FBE8F] pt-1">
              Direct Clinic Coordination: psychaveph.info@gmail.com
            </p>
          </div>

          <div className="space-y-2.5 text-sm">
            <p className="font-heading text-base font-semibold text-[#D0E187]">
              Public Site Map
            </p>
            <ul className="space-y-2 text-[#C0D3C3]">
              <li>
                <Link href="/" className="hover:text-white transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/services" className="hover:text-white transition-colors">
                  Services & Guardrails
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-white transition-colors">
                  About Us & Anonymized Roster
                </Link>
              </li>
              <li>
                <Link href="/book" className="hover:text-white transition-colors">
                  Book a Session (Fallback & Booking)
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-2.5 text-sm">
            <p className="font-heading text-base font-semibold text-[#D0E187]">
              Flow C Role Dashboards
            </p>
            <ul className="space-y-2 text-[#C0D3C3]">
              <li>
                <Link href="/personas" className="hover:text-white transition-colors">
                  Client Personas & Booking Form
                </Link>
              </li>
              <li>
                <Link href="/bookings" className="hover:text-white transition-colors">
                  Client Bookings & Proposal Picker
                </Link>
              </li>
              <li>
                <Link href="/psych/queue" className="hover:text-white transition-colors">
                  Psychologist Pending Queue
                </Link>
              </li>
              <li>
                <Link href="/psych/schedule" className="hover:text-white transition-colors">
                  Psychologist My Schedules
                </Link>
              </li>
              <li>
                <Link href="/admin/verifications" className="hover:text-white transition-colors">
                  Admin Credential Verification
                </Link>
              </li>
              <li>
                <Link href="/admin/cms" className="hover:text-white transition-colors">
                  Admin Payload CMS Editors
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
            No personal quotes · No identifiable resident names · Canonical Flow C
          </p>
        </div>
      </div>
    </footer>
  );
}
