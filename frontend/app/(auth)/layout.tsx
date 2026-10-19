import React from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';

/**
 * Split-screen auth chrome. This is NOT a root layout — html/body belong to
 * app/layout.tsx. Renders inside the root layout's <body>, below <Providers>.
 *
 * De-vibe-coding pass: the brand panel is a flat pine block — no gradients,
 * no decorative rings, no inline styles. Typography carries the hierarchy;
 * lime-soft is the single accent on dark (contrast-checked ≥8:1 on pine).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-parchment">
      {/* ── Left: Brand Panel ────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[40%] flex-col justify-between bg-pine p-12">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-0">
          <img
            src="/psychave-logo.png"
            alt="PSYCHAVE PH"
            width={1024}
            height={720}
            className="h-auto w-48 sm:w-64 shrink-0"
          />
        </Link>

        {/* Center content */}
        <div className="space-y-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-lime-soft">
            PRC-Licensed Resident Psychologists
          </p>
          <h1 className="font-heading text-4xl xl:text-5xl font-medium leading-tight tracking-tight text-parchment">
            Your mental health
            <br />
            journey starts
            <br />
            <span className="text-lime-soft">here.</span>
          </h1>
          <p className="text-base leading-relaxed text-parchment/70 max-w-sm">
            Professional, confidential, and compassionate psychological care — when you need it most.
          </p>

          {/* Trust signals */}
          <ul className="flex flex-col gap-3 pt-2">
            {[
              'PRC-verified psychologists only',
              'RA 10173 Data Privacy Act compliant',
              'Secure, confidential sessions',
            ].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 bg-lime-soft/15 text-lime-soft">
                  <Check className="w-3 h-3" aria-hidden="true" />
                </span>
                <span className="text-sm text-parchment/80">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom tagline */}
        <p className="text-xs text-parchment/40">
          © {new Date().getFullYear()} PsychAvenuePH — All rights reserved
        </p>
      </div>

      {/* ── Right: Form Panel ────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 lg:px-12 overflow-y-auto">
        {/* Mobile-only logo */}
        <Link href="/" className="lg:hidden mb-8">
          <span className="font-heading text-xl font-medium tracking-tight text-pine">
            PSYCHAVE PH
          </span>
        </Link>

        {children}
      </div>
    </div>
  );
}
