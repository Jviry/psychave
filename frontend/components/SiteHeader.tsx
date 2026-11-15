'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAppStore } from '@/stores/useAppStore';
import { useAuthStore } from '@/stores/authStore';
import { CognitoRole } from '@/lib/types';
import { LogOut, User, ChevronDown, Bell, Settings } from 'lucide-react';

const ROLE_NAV_ITEMS: Record<CognitoRole, { label: string; href: string }[]> = {
  client: [
    { label: 'Bookings', href: '/bookings' },
    { label: 'Profiles', href: '/profiles' },
  ],
  psychologist: [
    { label: 'Pending Bookings', href: '/psych/queue' },
    { label: 'Schedule', href: '/psych/schedule' },
  ],
  admin: [
    { label: 'Account Management', href: '/admin/users' },
    { label: 'CMS', href: '/admin/cms' },
  ],
};

function getDashboardHref(role: CognitoRole): string {
  if (role === 'admin') return '/admin/users';
  if (role === 'psychologist') return '/psych/queue';
  return '/bookings';
}

function getAccountHref(role: CognitoRole): string {
  return role === 'psychologist' ? '/psych/profile' : '/account';
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const lastFlowEvent = useAppStore((s) => s.lastFlowEvent);
  const clearFlowEvent = useAppStore((s) => s.clearFlowEvent);

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const authLogout = useAuthStore((s) => s.logout);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isHome = pathname === '/';
  const [activeSection, setActiveSection] = useState<'home' | 'services' | 'about'>('home');

  useEffect(() => {
    setShowUserMenu(false);
  }, [pathname]);

  useEffect(() => {
    if (!showUserMenu) return;
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowUserMenu(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [showUserMenu]);

  useEffect(() => {
    if (!isHome) return;
    let raf = 0;
    const compute = () => {
      raf = 0;
      const threshold = 160;
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
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [isHome]);

  const roleTabs = !isHome && isAuthenticated && user ? ROLE_NAV_ITEMS[user.role] : [];

  const renderRoleTabs = (extraClass = '') => (
    <nav
      aria-label="Workspace navigation"
      className={`flex items-center gap-6 text-sm font-medium text-pine/75 ${extraClass}`}
    >
      {roleTabs.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`py-1 transition-colors whitespace-nowrap border-b-2 ${
              active
                ? 'text-pine border-sage font-semibold'
                : 'border-transparent hover:text-pine hover:border-mist'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="sticky top-0 z-40 bg-surface-raised/95 backdrop-blur-sm border-b border-mist">
      <header className="max-w-6xl mx-auto px-4 lg:px-8 h-16 grid grid-cols-[auto_1fr_auto] items-center gap-4">
        {/* Left: PsychAve Logo */}
        <Link
          href="/"
          aria-label="PsychAve PH Home"
          className="flex items-center shrink-0"
        >
          <img
            src="/psychave-logo.png"
            alt="PsychAve PH logo"
            className="h-11 w-auto object-contain shrink-0"
          />
        </Link>

        {/* Middle: Public landing nav on / OR role-specific tabs on role pages */}
        <div className="flex justify-center">
          {isHome ? (
            <nav
              aria-label="Primary navigation"
              className="hidden md:flex items-center gap-7 text-sm font-medium text-pine/75"
            >
              {[
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
                        ? 'text-pine border-pine font-semibold'
                        : 'border-transparent hover:text-pine hover:border-mist'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          ) : (
            roleTabs.length > 0 && renderRoleTabs('hidden md:flex')
          )}
        </div>

        {/* Right: Account Tab / Auth Actions */}
        <div className="flex items-center justify-end gap-3">
          {isAuthenticated && user ? (
            <div className="relative" ref={menuRef}>
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
                <span className="hidden sm:block text-xs font-medium text-pine max-w-[110px] truncate">
                  {user.username}
                </span>
                <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-surface-sunken text-pine">
                  {user.role}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-pine/50 transition-transform ${showUserMenu ? 'rotate-180' : ''}`}
                />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-full mt-1.5 w-56 bg-surface-raised rounded-lg border border-mist shadow-lg py-1.5 z-50">
                  <div className="px-4 py-2.5 border-b border-mist/60">
                    <p className="text-xs font-semibold text-pine truncate">
                      {user.email || user.username}
                    </p>
                    <p className="text-xs text-pine/50 capitalize mt-0.5">{user.role}</p>
                  </div>
                  <Link
                    id="user-menu-account"
                    href={getAccountHref(user.role)}
                    className="flex items-center gap-2 px-4 py-2 text-xs text-pine hover:bg-mist/40 transition-colors"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <Settings className="w-3.5 h-3.5 text-sage" />
                    {user.role === 'psychologist' ? 'Account Management' : 'Account'}
                  </Link>
                  {isHome && (
                    <Link
                      id="user-menu-dashboard"
                      href={getDashboardHref(user.role)}
                      className="flex items-center gap-2 px-4 py-2 text-xs text-pine hover:bg-mist/40 transition-colors"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <User className="w-3.5 h-3.5 text-sage" />
                      My Dashboard
                    </Link>
                  )}
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
          ) : (
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

      {/* Mobile role tabs row */}
      {!isHome && roleTabs.length > 0 && (
        <div className="md:hidden border-t border-mist/70 px-4 py-2 overflow-x-auto bg-surface-raised">
          {renderRoleTabs('justify-center')}
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
