'use client';

import React from 'react';
import Link from 'next/link';
import { useAuthStore } from '../authStore';

const WORKSPACE_LINKS = {
  client: [
    { href: '/personas', label: 'Client Personas & Booking Form' },
    { href: '/bookings', label: 'Client Bookings & Proposal Picker' },
  ],
  psychologist: [
    { href: '/psych/queue', label: 'Psychologist Pending Queue' },
    { href: '/psych/schedule', label: 'Psychologist My Schedules' },
    { href: '/psych/profile', label: 'Psychologist Profile' },
  ],
  admin: [
    { href: '/admin/verifications', label: 'Admin Credential Verification' },
    { href: '/admin/cms', label: 'Admin Payload CMS Editors' },
  ],
} as const;

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

/**
 * Tall editorial footer: the brand logo anchors the left half, the link
 * columns sit smaller on the right, and a slim small-print row closes it out.
 */
export function SiteFooter() {
  const { isAuthenticated, user } = useAuthStore();
  const workspaceLinks =
    isAuthenticated && user ? WORKSPACE_LINKS[user.role] : null;

  return (
    <footer className="bg-pine text-parchment border-t border-sage/40 mt-20">
      <div className="max-w-6xl mx-auto px-4 lg:px-8 py-16 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start lg:items-center">
          {/* Left: brand logo + platform note */}
          <div className="space-y-6">
            <img
              src="/psychave-logo.png"
              alt="PSYCHAVE PH — PsychAvenuePH logo"
              width={1024}
              height={720}
              className="h-auto w-64 sm:w-72 lg:w-80"
            />
            <p className="text-sm text-mist max-w-md leading-relaxed">
              PsychAvenuePH is a Philippine mental-health booking platform built around
              structured booking, PRC-verified resident psychologists, explicit clinical duration
              guardrails, and strict confidentiality governance.
            </p>
            <p className="text-xs text-mint">
              Direct Clinic Coordination: psychaveph.info@gmail.com
            </p>
          </div>

          {/* Right: smaller link columns */}
          <div className="grid grid-cols-2 gap-8 lg:gap-12">
            <div className="space-y-3 text-sm">
              <p className="text-xs font-medium uppercase tracking-wider text-lime-soft">
                Public Site Map
              </p>
              <ul className="space-y-2 text-mist">
                <li>
                  <FooterLink href="/">Home</FooterLink>
                </li>
                <li>
                  <FooterLink href="/#services">Services &amp; Guardrails</FooterLink>
                </li>
                <li>
                  <FooterLink href="/#about">About Us &amp; Anonymized Roster</FooterLink>
                </li>
                <li>
                  <FooterLink href="/book">Book a Session (Fallback &amp; Booking)</FooterLink>
                </li>
              </ul>
            </div>

            <div className="space-y-3 text-sm">
              <p className="text-xs font-medium uppercase tracking-wider text-lime-soft">
                {workspaceLinks ? 'Your Workspace' : 'Account'}
              </p>
              <ul className="space-y-2 text-mist">
                {workspaceLinks ? (
                  workspaceLinks.map((link) => (
                    <li key={link.href}>
                      <FooterLink href={link.href}>{link.label}</FooterLink>
                    </li>
                  ))
                ) : (
                  <>
                    <li>
                      <FooterLink href="/login">Log In</FooterLink>
                    </li>
                    <li>
                      <FooterLink href="/register">Create Account</FooterLink>
                    </li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 lg:mt-16 pt-6 border-t border-sage/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-mist/80">
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
