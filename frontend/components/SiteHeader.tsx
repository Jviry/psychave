'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAppStore } from '../stores/useAppStore';
import { useAuthStore } from '../authStore';
import { CognitoRole } from '../lib/types';
import { API_BASE_URL, AUTH_MODE } from '../lib/api';
import { LogOut, User, ChevronDown, Settings, Info, Bell, Lock } from 'lucide-react';

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

  const { isAuthenticated, user, logout: authLogout } = useAuthStore();
  const [showDevTools, setShowDevTools] = useState(false);
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

  // Mock-mode-only widgets (role switcher, payment simulator, dev panel)
  // must never appear when the app is pointed at the real backend.
  const isMock = AUTH_MODE === 'mock';

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
            {isMock && cognitoRole === 'psychologist' && (
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

            {isMock && cognitoRole === 'client' && (
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
        {/* Zone 1: Brand Logo — same image + size as the footer logo */}
        <Link href="/" className="flex items-center gap-0">
          <img
            src="/psychave-logo.png"
            alt="PSYCHAVE PH"
            width={1024}
            height={720}
            className="h-auto w-64 sm:w-72 lg:w-80 shrink-0"
          />
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
              {/* Dev Tools toggle (collapsible mock switcher) — mock mode only */}
              {isMock && (
                <button
                  type="button"
                  id="dev-tools-toggle"
                  onClick={() => setShowDevTools((v) => !v)}
                  className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg text-pine/60 hover:text-pine hover:bg-mist/50 transition-colors cursor-pointer border border-mist/60"
                  title="Toggle Dev Tools (prototype mock switcher)"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Dev
                  <ChevronDown className={`w-3 h-3 transition-transform ${showDevTools ? 'rotate-180' : ''}`} />
                </button>
              )}

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
      {isAuthenticated && (
        <div className="bg-surface-sunken border-t border-mist/70 px-4 lg:px-8 py-2">
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Dev Tools panel (only shown when toggled) — mock mode only */}
            {isMock && showDevTools && (
            <div className="flex flex-wrap items-center gap-4 text-pine/70">
              <span className="font-semibold text-pine/50">Dev Tools (prototype mock switcher):</span>
              <div
                role="group"
                aria-label="Mock AWS Cognito Groups Role Switcher"
                className="flex items-center gap-0.5 p-1 bg-surface-sunken rounded-lg border border-mist"
              >
                {(['client', 'psychologist', 'admin'] as CognitoRole[]).map((role) => {
                  const active = cognitoRole === role;
                  const labels: Record<CognitoRole, string> = { client: 'Client', psychologist: 'Psychologist', admin: 'Admin' };
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => handleRoleSwitch(role)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        active ? 'bg-pine text-white shadow-xs' : 'text-pine/75 hover:text-pine'
                      }`}
                    >
                      {labels[role]}
                    </button>
                  );
                })}
              </div>
              <Link href="/personas" className="hidden sm:inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-sage text-white hover:bg-accent-ink transition-colors focus-visible:outline-2 focus-visible:outline-sage focus-visible:outline-offset-2">
                Start Booking
              </Link>
            </div>
          )}

          {/* Role workspace nav (shown when the dev-tools panel is collapsed) */}
          {!showDevTools && (
            <div className="flex items-center gap-4 overflow-x-auto">
              <span className="text-pine/65 font-medium whitespace-nowrap">
                {isMock ? `Cognito Group (${cognitoRole}) Workspace:` : 'Workspace:'}
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
          )}

          {/* Tiered Access Guardrail Summary */}
          <div className="hidden lg:flex items-center gap-1.5 text-pine/70">
            <Lock className="w-3.5 h-3.5 text-sage" aria-hidden="true" />
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

