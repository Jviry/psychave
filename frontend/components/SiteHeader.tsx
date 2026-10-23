'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAppStore } from '../stores/useAppStore';
import { useAuthStore } from '../authStore';
import { CognitoRole } from '../lib/types';
import { API_BASE_URL, AUTH_MODE } from '../lib/api';
import { LogOut, User, ChevronDown, Info, Bell, Lock } from 'lucide-react';

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    activePsychologistId,
    setActivePsychologistId,
    simulatePaymentFailure,
    setSimulatePaymentFailure,
    lastFlowEvent,
    clearFlowEvent,
  } = useAppStore();

  const { isAuthenticated, user, logout: authLogout } = useAuthStore();
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Home scroll-spy: the nav underline follows Home → Services → About as the
  // single-scroll home page moves. Other routes light up nothing (all three
  // links point back into the home page).
  const isHome = pathname === '/';
  const [activeSection, setActiveSection] = useState<'home' | 'services' | 'about'>('home');

  useEffect(() => {
    if (!isHome) return;
    let raf = 0;
    const compute = () => {
      raf = 0;
      const threshold = 160; // just below the sticky banner + header
      const servicesTop =
        document.getElementById('services')?.getBoundingClientRect().top ?? Infinity;
      const aboutTop = document.getElementById('about')?.getBoundingClientRect().top ?? Infinity;
      if (aboutTop <= threshold) setActiveSection('about');
      else if (servicesTop <= threshold) setActiveSection('services');
      else setActiveSection('home');
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [isHome]);

  // Mock-mode-only widgets (payment simulator, psych identity) must never
  // appear when the app is pointed at the real backend.
  const isMock = AUTH_MODE === 'mock';

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
    <div className="sticky top-0 z-40 bg-surface-raised border-b border-mist">
      {/* Canonical Prototype Demo Banner */}
      <div className="bg-pine text-white px-4 lg:px-8 py-1.5 text-xs">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-lime-soft shrink-0" aria-hidden="true" />
            <span className="font-medium text-parchment">
              {isMock
                ? 'Frontend prototype — mock mode (in-memory data, no backend calls).'
                : `Frontend prototype — live mode (NEXT_PUBLIC_API_URL: ${API_BASE_URL}).`}
            </span>
          </div>

          {/* Interactive State Simulation Controls — mock mode only (they are fake toggles) */}
          <div className="flex items-center gap-4 text-xs text-parchment/70">
            {isMock && user?.role === 'psychologist' && (
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

            {isMock && user?.role === 'client' && (
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

            <span className="hidden sm:inline text-parchment/60">
              AUTH_MODE: {AUTH_MODE}
            </span>
          </div>
        </div>
      </div>

      {/* Top Bar Contract: Zone 1 (Single Wordmark) — Zone 2 (Clean Text Nav Links) — Zone 3 (Actions) */}
      <header className="max-w-6xl mx-auto px-4 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Brand Title, single text element in Proxima Nova Condensed */}
        <Link
          href="/"
          className="font-heading text-2xl font-medium tracking-tight text-pine whitespace-nowrap shrink-0"
        >
          PSYCHAVE PH
        </Link>

        {/* Zone 2: Primary Public Site Map Navigation Links + Booking CTA */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-pine/80">
          {[
            // Single public scroll page: Home / Services / About are in-page anchors.
            { label: 'Home', section: 'home', href: '/#top' },
            { label: 'Services', section: 'services', href: '/#services' },
            { label: 'About Us', section: 'about', href: '/#about' },
          ].map((item) => {
            const isActive = isHome && activeSection === item.section;
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

          {/* Booking CTA — an action, not a home-section link, so it reads as a
              pill button instead of a nav item with the underline treatment. */}
          <Link
            id="nav-book-cta"
            href="/book"
            className="rounded-full bg-sage px-4 py-2 text-xs font-semibold text-white hover:bg-accent-ink transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-sage focus-visible:outline-offset-2"
          >
            Book a session
          </Link>
        </nav>

        {/* Zone 3: Auth Actions */}
        <div className="flex items-center gap-3">
          {isAuthenticated && user ? (
            // ── Authenticated: avatar + user menu ──────────────────────
            <div className="flex items-center gap-2">
              {/* User avatar dropdown */}
              <div className="relative">
                <button
                  type="button"
                  id="user-menu-trigger"
                  onClick={() => setShowUserMenu((v) => !v)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-mist hover:bg-mist/30 transition-colors cursor-pointer"
                  aria-haspopup="true"
                  aria-expanded={showUserMenu}
                >
                  <div className="w-6 h-6 rounded-full bg-sage/20 flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5 text-sage" />
                  </div>
                  <span className="hidden sm:block text-xs font-medium text-pine max-w-[100px] truncate">
                    {user.username}
                  </span>
                  <span
                    className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-surface-sunken text-pine"
                  >
                    {user.role}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-pine/50 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 top-full mt-1.5 w-52 bg-surface-raised rounded-lg border border-mist shadow-lg py-1.5 z-50">
                    <div className="px-4 py-2.5 border-b border-mist/60">
                      <p className="text-xs font-semibold text-pine truncate">{user.email || user.username}</p>
                      <p className="text-xs text-pine/50 capitalize mt-0.5">{user.role}</p>
                    </div>
                    <Link
                      id="user-menu-dashboard"
                      href={user.role === 'admin' ? '/admin/verifications' : user.role === 'psychologist' ? '/psych/queue' : '/bookings'}
                      className="flex items-center gap-2 px-4 py-2 text-xs text-pine hover:bg-mist/40 transition-colors"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <User className="w-3.5 h-3.5 text-sage" />
                      My Dashboard
                    </Link>
                    <button
                      type="button"
                      id="user-menu-logout"
                      onClick={() => {
                        authLogout();
                        setShowUserMenu(false);
                        router.push('/');
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Log Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // ── Unauthenticated: Log In + Register ────────────────────
            <div className="flex items-center gap-2">
              <Link
                id="header-login-link"
                href="/login"
                className="px-3.5 py-2 text-xs font-semibold rounded-full text-pine border border-mist hover:bg-mist/40 transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-sage focus-visible:outline-offset-2"
              >
                Log In
              </Link>
              <Link
                id="header-register-link"
                href="/register"
                className="px-3.5 py-2 text-xs font-semibold rounded-full text-white transition-colors whitespace-nowrap bg-pine hover:bg-pine/90 focus-visible:outline-2 focus-visible:outline-sage focus-visible:outline-offset-2"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Contextual workspace sub-bar — authenticated users only (logged-out
          visitors see the public nav; role nav is meaningless for them) */}
      {isAuthenticated && user && (
        <div className="bg-surface-sunken border-t border-mist/70 px-4 lg:px-8 py-2">
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4 overflow-x-auto">
              <span className="text-pine/65 font-medium whitespace-nowrap">Workspace:</span>
              <div className="flex items-center gap-4">
                {roleNavItems[user.role].map((item) => {
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

            {/* Tiered Access Guardrail Summary */}
            <div className="hidden lg:flex items-center gap-1.5 text-pine/70">
              <Lock className="w-3.5 h-3.5 text-sage" aria-hidden="true" />
              {user.role === 'client' && (
                <span>Tiered Access: Viewing own Client #C-01 history & personas only</span>
              )}
              {user.role === 'psychologist' && (
                <span>
                  Tiered Access: Pending Queue + Sessions booked under #{activePsychologistId} only
                </span>
              )}
              {user.role === 'admin' && (
                <span>
                  Tiered Access: Verifications & CMS only · Private clinical session notes redacted
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Real-time Flow C Notification Banner when active */}
      {lastFlowEvent && (
        <div className="bg-surface-sunken border-t border-mist px-4 lg:px-8 py-2 text-xs text-pine">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-pine shrink-0" aria-hidden="true" />
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

