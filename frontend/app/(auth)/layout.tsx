import React from 'react';
import Link from 'next/link';

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
    <div className="min-h-screen lg:h-screen lg:overflow-hidden flex bg-parchment">
      {/* ── Left: Brand Panel (fixed on desktop) ─────────────── */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[40%] lg:h-screen shrink-0 flex-col justify-between bg-pine p-14 xl:p-20 overflow-hidden">
        {/* Logo */}
        <div className="flex flex-col items-center gap-5">
          <Link href="/" className="inline-block">
            <img
              src="/psychave-logo.png"
              alt="PSYCHAVE PH"
              width={1024}
              height={720}
              className="h-auto w-48 sm:w-70 shrink-0"
            />
          </Link>
        </div>

        {/* Center content */}
        <div className="space-y-6">
          <h1 className="font-heading text-4xl xl:text-5xl font-semibold leading-tight tracking-tight text-parchment">
            Your mental health
            <br />
            journey starts
            <br />
            <span className="text-lime-soft">here.</span>
          </h1>
          <p className="text-base leading-relaxed text-parchment/70 max-w-sm">
            Professional, confidential, and compassionate psychological care — when you need it most.
          </p>
        </div>

        {/* Bottom tagline */}
        <p className="text-xs text-parchment/40">
          © {new Date().getFullYear()} PsychAvenuePH — All rights reserved
        </p>
      </div>

      {/* ── Right: Form Panel (only scrollable pane on desktop) ─ */}
      <div className="flex-1 flex flex-col items-center px-6 py-12 lg:px-12 lg:h-screen lg:overflow-y-auto">
        <div className="my-auto w-full flex flex-col items-center">
          {/* Mobile-only logo */}
          <Link href="/" className="lg:hidden mb-8">
            <span className="font-heading text-2xl font-semibold tracking-wide uppercase text-pine">
              PSYCHAVE PH
            </span>
          </Link>

          {children}
        </div>
      </div>
    </div>
  );
}
