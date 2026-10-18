'use client';

import React from 'react';
import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="bg-pine text-parchment border-t border-sage/40 mt-20">
      <div className="max-w-6xl mx-auto px-4 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-sage/30">
          <div className="md:col-span-2 space-y-3">
            <p className="font-heading text-2xl font-bold tracking-tight text-white">
              PSYCHAVE PH
            </p>
            <p className="text-sm text-mist max-w-md leading-relaxed">
              PsychAvenuePH is a Philippine mental-health booking platform built around
              structured booking, PRC-verified resident psychologists, explicit clinical duration
              guardrails, and strict confidentiality governance.
            </p>
            <p className="text-xs text-mint pt-1">
              Direct Clinic Coordination: psychaveph.info@gmail.com
            </p>
          </div>

          <div className="space-y-2.5 text-sm">
            <p className="font-heading text-base font-semibold text-lime-soft">
              Public Site Map
            </p>
            <ul className="space-y-2 text-mist">
              <li>
                <Link href="/" className="hover:text-white transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/services" className="hover:text-white transition-colors">
                  Services &amp; Guardrails
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-white transition-colors">
                  About Us &amp; Anonymized Roster
                </Link>
              </li>
              <li>
                <Link href="/book" className="hover:text-white transition-colors">
                  Book a Session (Fallback &amp; Booking)
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-2.5 text-sm">
            <p className="font-heading text-base font-semibold text-lime-soft">
              Role Dashboards
            </p>
            <ul className="space-y-2 text-mist">
              <li>
                <Link href="/personas" className="hover:text-white transition-colors">
                  Client Personas &amp; Booking Form
                </Link>
              </li>
              <li>
                <Link href="/bookings" className="hover:text-white transition-colors">
                  Client Bookings &amp; Proposal Picker
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

        <div className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-mist/80">
          <p>
            © {new Date().getFullYear()} PSYCHAVE PH (PsychAvenuePH). All clinical services adhere to PAP Ethical Guidelines &amp; RA 10173 Data Privacy standards.
          </p>
          <p className="text-mint">
            No personal quotes · No identifiable resident names · Structured Booking
          </p>
        </div>
      </div>
    </footer>
  );
}
