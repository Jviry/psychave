'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAppStore } from '../stores/useAppStore';
import { CognitoRole } from '../lib/types';
import { API_BASE_URL } from '../lib/api';

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    cognitoRole,
    setCognitoRole,
    activePsychologistId,
    setActivePsychologistId,
    simulatePaymentFailure,
    setSimulatePaymentFailure,
    lastFlowEvent,
    clearFlowEvent,
  } = useAppStore();

  const handleRoleSwitch = (nextRole: CognitoRole) => {
    setCognitoRole(nextRole);
    if (nextRole === 'client' && (pathname.startsWith('/psych') || pathname.startsWith('/admin'))) {
      router.push('/bookings');
    } else if (nextRole === 'psychologist' && (pathname.startsWith('/bookings') || pathname.startsWith('/admin'))) {
      router.push('/psych/queue');
    } else if (nextRole === 'admin' && (pathname.startsWith('/bookings') || pathname.startsWith('/psych'))) {
      router.push('/admin/verifications');
    }
  };

  const roleNavItems: Record<CognitoRole, { label: string; href: string }[]> = {
    client: [
      { label: 'Personas & Booking', href: '/personas' },
      { label: 'My Bookings', href: '/bookings' },
      { label: 'Proposal Picker (#102)', href: '/proposal/BK-2026-102' },
    ],
    psychologist: [
      { label: 'Pending Requests', href: '/psych/queue' },
      { label: 'My Schedule', href: '/psych/schedule' },
      { label: 'Profile', href: '/psych/profile' },
    ],
    admin: [
      { label: 'Credential Verifications', href: '/admin/verifications' },
      { label: 'Payload CMS Editors', href: '/admin/cms' },
    ],
  };

  return (
    <div className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-mist">
      {/* Canonical Prototype Demo Banner */}
      <div className="bg-pine text-white px-4 lg:px-8 py-1.5 text-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <svg
              className="w-3.5 h-3.5 text-lime-soft shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4l2.5 2.5" />
            </svg>
            <span className="font-medium text-parchment">
              Frontend prototype — mock mode, Flow C canonical, plugs into existing backend/ via NEXT_PUBLIC_API_URL ({API_BASE_URL}).
            </span>
          </div>

          {/* Interactive State Simulation Controls for Prototype Evaluation */}
          <div className="flex items-center gap-4 text-[11px] text-mist">
            {cognitoRole === 'psychologist' && (
              <div className="flex items-center gap-1.5">
                <span>Psych Identity:</span>
                <button
                  type="button"
                  onClick={() =>
                    setActivePsychologistId(activePsychologistId === 'RP-01' ? 'RP-04' : 'RP-01')
                  }
                  className="underline text-lime-soft hover:text-white font-medium cursor-pointer whitespace-nowrap"
                >
                  {activePsychologistId === 'RP-01'
                    ? 'Resident #RP-01 (Verified)'
                    : 'Associate #RP-04 (Unverified · Cannot Pick Up)'}
                </button>
              </div>
            )}

            {cognitoRole === 'client' && (
              <div className="flex items-center gap-1.5">
                <span>Stripe Gateway Simulation:</span>
                <button
                  type="button"
                  onClick={() => setSimulatePaymentFailure(!simulatePaymentFailure)}
                  className="underline text-lime-soft hover:text-white font-medium cursor-pointer whitespace-nowrap"
                >
                  {simulatePaymentFailure ? 'Simulate Payment Failed' : 'Payment Succeeds'}
                </button>
              </div>
            )}

            <span className="hidden sm:inline text-mint">
              NEXT_PUBLIC_AUTH_MODE=mock
            </span>
          </div>
        </div>
      </div>

      {/* Top Bar Contract: Zone 1 (Single Wordmark) — Zone 2 (Clean Text Nav Links) — Zone 3 (Actions) */}
      <header className="max-w-7xl mx-auto px-4 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Brand Title, single text element in Proxima Nova Condensed */}
        <Link
          href="/"
          className="font-heading text-2xl font-bold tracking-tight text-pine whitespace-nowrap shrink-0"
        >
          PSYCHAVE PH
        </Link>

        {/* Zone 2: Primary Public Site Map Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-pine/80">
          {[
            { label: 'Home', href: '/' },
            { label: 'Services', href: '/services' },
            { label: 'About Us', href: '/about' },
            { label: 'Book a session', href: '/book' },
          ].map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`py-1 transition-colors whitespace-nowrap border-b-2 ${
                  isActive
                    ? 'text-pine border-sage font-semibold'
                    : 'border-transparent hover:text-pine hover:border-mist'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Zone 3: Cognito Groups Role Switcher + Primary Action */}
        <div className="flex items-center gap-3">
          <div
            role="group"
            aria-label="Mock AWS Cognito Groups Role Switcher"
            className="flex items-center gap-0.5 p-1 bg-[#EBF2EC] rounded-lg border border-mist"
          >
            {(['client', 'psychologist', 'admin'] as CognitoRole[]).map((role) => {
              const active = cognitoRole === role;
              const labels: Record<CognitoRole, string> = {
                client: 'Client',
                psychologist: 'Psychologist',
                admin: 'Admin',
              };
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => handleRoleSwitch(role)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-pine text-white shadow-xs'
                      : 'text-pine/75 hover:text-pine'
                  }`}
                >
                  {labels[role]}
                </button>
              );
            })}
          </div>

          <Link
            href="/personas"
            className="hidden sm:inline-flex items-center justify-center px-3.5 py-2 text-xs font-semibold rounded-lg bg-sage text-white hover:bg-[#4c7557] transition-colors whitespace-nowrap shrink-0"
          >
            Start Flow C Booking
          </Link>
        </div>
      </header>

      {/* Secondary Contextual Workspace Sub-Bar for Role Dashboards & Mobile Nav */}
      <div className="bg-[#F1F6F2] border-t border-mist/70 px-4 lg:px-8 py-2">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 overflow-x-auto">
            <span className="text-pine/65 font-medium whitespace-nowrap">
              Cognito Group ({cognitoRole}) Workspace:
            </span>
            <div className="flex items-center gap-4">
              {roleNavItems[cognitoRole].map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href.startsWith('/proposal/') && pathname.startsWith('/proposal/'));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`whitespace-nowrap transition-colors py-0.5 ${
                      active
                        ? 'text-pine font-semibold underline decoration-sage decoration-2 underline-offset-4'
                        : 'text-pine/75 hover:text-pine'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Mobile public nav mirror */}
          <div className="flex md:hidden items-center gap-3 text-xs text-pine/80">
            <Link href="/" className="hover:underline">Home</Link>
            <span>·</span>
            <Link href="/services" className="hover:underline">Services</Link>
            <span>·</span>
            <Link href="/about" className="hover:underline">About</Link>
            <span>·</span>
            <Link href="/book" className="hover:underline">Book</Link>
          </div>

          {/* Tiered Access Guardrail Summary */}
          <div className="hidden lg:flex items-center gap-1.5 text-pine/70">
            <svg
              className="w-3.5 h-3.5 text-sage"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            {cognitoRole === 'client' && (
              <span>Tiered Access: Viewing own Client #C-01 history & personas only</span>
            )}
            {cognitoRole === 'psychologist' && (
              <span>
                Tiered Access: Pending Queue + Sessions booked under #{activePsychologistId} only
              </span>
            )}
            {cognitoRole === 'admin' && (
              <span>
                Tiered Access: Verifications & CMS only · Private clinical session notes redacted
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Real-time Flow C Notification Banner when active */}
      {lastFlowEvent && (
        <div className="bg-lime-soft/45 border-t border-mint px-4 lg:px-8 py-2 text-xs text-pine">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-pine shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <div>
                <span className="font-semibold">{lastFlowEvent.title}:</span>{' '}
                <span>{lastFlowEvent.detail}</span>
                <span className="ml-2 text-pine/60">({lastFlowEvent.timestamp})</span>
              </div>
            </div>
            <button
              type="button"
              onClick={clearFlowEvent}
              className="text-xs font-medium text-pine/70 hover:text-pine underline cursor-pointer whitespace-nowrap"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
