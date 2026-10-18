import React from 'react';
import Link from 'next/link';

/**
 * Split-screen auth chrome. This is NOT a root layout — html/body belong to
 * app/layout.tsx. Renders inside the root layout's <body>, below <Providers>.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-parchment">
          {/* ── Left: Brand Panel ────────────────────────────────── */}
          <div
            className="hidden lg:flex lg:w-[45%] xl:w-[40%] flex-col justify-between p-12 relative overflow-hidden"
            style={{ background: 'linear-gradient(160deg, #1b2921 0%, #25372d 40%, #3a5c46 100%)' }}
          >
            {/* Decorative rings */}
            <div
              className="absolute -right-24 -top-24 w-96 h-96 rounded-full opacity-10"
              style={{ border: '2px solid #D0E187' }}
            />
            <div
              className="absolute -right-12 -top-12 w-64 h-64 rounded-full opacity-10"
              style={{ border: '2px solid #8FBE8F' }}
            />
            <div
              className="absolute -left-32 bottom-24 w-80 h-80 rounded-full opacity-10"
              style={{ border: '2px solid #D0E187' }}
            />

            {/* Logo */}
            <Link href="/" className="relative z-10">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(208, 225, 135, 0.2)', border: '1px solid rgba(208, 225, 135, 0.4)' }}
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#D0E187" strokeWidth="1.8">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </div>
                <span
                  className="font-heading text-xl font-bold tracking-tight"
                  style={{ color: '#F6F9F6' }}
                >
                  PSYCHAVE PH
                </span>
              </div>
            </Link>

            {/* Center content */}
            <div className="relative z-10 space-y-6">
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{
                  background: 'rgba(208, 225, 135, 0.15)',
                  border: '1px solid rgba(208, 225, 135, 0.3)',
                  color: '#D0E187',
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-lime-soft inline-block" />
                PRC-Licensed Resident Psychologists
              </div>
              <h1
                className="font-heading text-4xl xl:text-5xl font-bold leading-tight"
                style={{ color: '#F6F9F6' }}
              >
                Your mental health
                <br />
                journey starts
                <br />
                <span style={{ color: '#D0E187' }}>here.</span>
              </h1>
              <p className="text-base leading-relaxed" style={{ color: 'rgba(246, 249, 246, 0.7)' }}>
                Professional, confidential, and compassionate psychological care — when you need it most.
              </p>

              {/* Trust signals */}
              <div className="flex flex-col gap-3 pt-2">
                {[
                  'PRC-verified psychologists only',
                  'RA 10173 Data Privacy Act compliant',
                  'Secure, confidential sessions',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(208, 225, 135, 0.2)' }}
                    >
                      <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="#D0E187" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <span className="text-sm" style={{ color: 'rgba(246, 249, 246, 0.8)' }}>
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom tagline */}
            <div className="relative z-10">
              <p className="text-xs" style={{ color: 'rgba(246, 249, 246, 0.4)' }}>
                © {new Date().getFullYear()} PsychAvenuePH — All rights reserved
              </p>
            </div>
          </div>

          {/* ── Right: Form Panel ────────────────────────────────── */}
          <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 lg:px-12 overflow-y-auto">
            {/* Mobile-only logo */}
            <Link href="/" className="lg:hidden mb-8">
              <span className="font-heading text-xl font-bold tracking-tight text-pine">
                PSYCHAVE PH
              </span>
            </Link>

            {children}
          </div>
        </div>
  );
}
