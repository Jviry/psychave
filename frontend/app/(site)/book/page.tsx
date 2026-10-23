'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Facebook, Mail } from 'lucide-react';
import { Button } from '../../../components/ui/primitives';

export default function BookFallbackPage() {
  const router = useRouter();
  const [copiedField, setCopiedField] = useState<'email' | 'fb' | 'template' | null>(null);

  const clinicEmail = 'psychaveph.info@gmail.com';
  const facebookFallbackUrl = 'https://facebook.com/PsychAvenuePH';
  const fallbackTemplate = `Subject: PsychAvenuePH Session Inquiry
Persona Type: [Self / Dependent]
Requested Service: [Consultation 45m / Individual 1hr / Couples 1.5hr / Family-Group 2hr / Life Coaching / Clinical Supervision / Academic Advisory]
Preferred Language: [English / Filipino / Taglish]
General Availability Window: [Days & Times]`;

  const handleCopy = (type: 'email' | 'fb' | 'template', text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedField(type);
    setTimeout(() => setCopiedField(null), 2500);
  };

  return (
    <div className="space-y-12">
      <header className="space-y-4 border-b border-mist pb-6">
        <h1 className="font-heading text-4xl font-medium text-pine">Book a session</h1>
        <p className="text-base text-pine/80">Start online — or reach us directly.</p>
        <div className="pt-2">
          <Button
            variant="primary"
            size="lg"
            onClick={() => router.push('/personas')}
          >
            Start booking
          </Button>
        </div>
      </header>

      {/* Direct channels — a quiet fallback row, not a competing path */}
      <section className="space-y-3">
        <p className="text-sm font-medium text-pine">Prefer to reach us directly?</p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-pine/80">
          <button
            type="button"
            onClick={() => handleCopy('fb', facebookFallbackUrl)}
            className="inline-flex items-center gap-2 underline underline-offset-4 hover:text-pine transition-colors duration-200 cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
          >
            <Facebook className="w-3.5 h-3.5 text-accent-ink" aria-hidden="true" />
            Facebook page
          </button>
          <button
            type="button"
            onClick={() => handleCopy('email', clinicEmail)}
            className="inline-flex items-center gap-2 underline underline-offset-4 hover:text-pine transition-colors duration-200 cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
          >
            <Mail className="w-3.5 h-3.5 text-accent-ink" aria-hidden="true" />
            {clinicEmail}
          </button>
          <button
            type="button"
            onClick={() => handleCopy('template', fallbackTemplate)}
            className="underline underline-offset-4 hover:text-pine transition-colors duration-200 cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
          >
            Copy inquiry template
          </button>
        </div>
        <p aria-live="polite" className="min-h-5 text-xs text-accent-ink">
          {copiedField === 'fb' && 'Facebook page link copied.'}
          {copiedField === 'email' && 'Clinic email copied.'}
          {copiedField === 'template' && 'Inquiry template copied.'}
        </p>
      </section>

      {/* Emergency / crisis protocol guardrail — kept visible on the booking page */}
      <section className="bg-surface-sunken border border-mist rounded-lg p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="font-heading text-lg font-medium text-pine">
            Important Clinical Safety Notice (Non-Emergency Platform)
          </p>
          <p className="text-xs text-pine/80 max-w-3xl">
            PsychAvenuePH is an outpatient scheduled booking platform and does not provide immediate
            crisis intervention. If you or your dependent are experiencing an acute mental-health
            emergency, please contact the National Center for Mental Health (NCMH) Crisis Hotline.
          </p>
        </div>
        <div className="text-sm font-semibold text-pine bg-surface-raised px-4 py-2.5 rounded-lg border border-mist shrink-0 tabular-nums">
          NCMH 24/7 Hotline: 1553 / 0917-899-8727
        </div>
      </section>
    </div>
  );
}
