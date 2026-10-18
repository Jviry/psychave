'use client';

import React from 'react';
import Link from 'next/link';

/**
 * Footer link recipe (design refresh): the lime dot scales/fades in while the
 * label slides 4px right — directional hover, ≤200ms, no loops. The dot is
 * absolutely positioned so it never shifts the resting layout.
 */
function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group relative inline-flex items-center text-mist hover:text-white transition-colors duration-200"
    >
      <span
        aria-hidden="true"
        className="absolute -left-3 h-1 w-1 rounded-full bg-lime-soft opacity-0 scale-0 transition-all duration-200 group-hover:opacity-100 group-hover:scale-100"
      />
      <span className="transition-transform duration-200 group-hover:translate-x-1">
        {children}
      </span>
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-pine text-parchment border-t border-sage/40 mt-20">
      <div className="max-w-6xl mx-auto px-4 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-sage/30">
          <div className="md:col-span-2 space-y-3">
            <p className="font-heading text-2xl font-medium tracking-tight text-white">
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
                <FooterLink href="/">Home</FooterLink>
              </li>
              <li>
                <FooterLink href="/services">Services &amp; Guardrails</FooterLink>
              </li>
              <li>
                <FooterLink href="/about">About Us &amp; Anonymized Roster</FooterLink>
              </li>
              <li>
                <FooterLink href="/book">Book a Session (Fallback &amp; Booking)</FooterLink>
              </li>
            </ul>
          </div>

          <div className="space-y-2.5 text-sm">
            <p className="font-heading text-base font-semibold text-lime-soft">
              Role Dashboards
            </p>
            <ul className="space-y-2 text-mist">
              <li>
                <FooterLink href="/personas">Client Personas &amp; Booking Form</FooterLink>
              </li>
              <li>
                <FooterLink href="/bookings">Client Bookings &amp; Proposal Picker</FooterLink>
              </li>
              <li>
                <FooterLink href="/psych/queue">Psychologist Pending Queue</FooterLink>
              </li>
              <li>
                <FooterLink href="/psych/schedule">Psychologist My Schedules</FooterLink>
              </li>
              <li>
                <FooterLink href="/admin/verifications">Admin Credential Verification</FooterLink>
              </li>
              <li>
                <FooterLink href="/admin/cms">Admin Payload CMS Editors</FooterLink>
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
