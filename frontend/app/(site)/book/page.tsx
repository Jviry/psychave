'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '../../../stores/useAppStore';
import { Facebook, Mail } from 'lucide-react';
import { Button, Card } from '../../../components/ui/primitives';

export default function BookFallbackPage() {
  const router = useRouter();
  const { setCognitoRole } = useAppStore();
  const [copiedField, setCopiedField] = useState<'email' | 'fb' | 'template' | null>(null);

  const clinicEmail = 'psychaveph.info@gmail.com';
  const facebookFallbackUrl = 'https://facebook.com/PsychAvenuePH';
  const fallbackTemplate = `Subject: PsychAvenuePH Session Inquiry (External Fallback)
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
      <header className="space-y-3 border-b border-mist pb-6">
        <div className="flex items-center gap-2 text-xs text-accent-ink font-semibold">
          <span>Book a Session</span>
          <span aria-hidden="true">·</span>
          <span>Canonical Flow C Booking + Official External Fallback</span>
        </div>
        <h1 className="font-heading text-4xl font-bold text-pine">
          Book a Session with PSYCHAVE PH
        </h1>
        <p className="text-base text-pine/80 max-w-3xl">
          Initiate your booking through our structured Flow C platform booking, or reach our clinical
          coordination desk directly via our official Facebook page or email fallback.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Primary Option: Official Flow C Platform Booking */}
        <Card className="lg:col-span-7 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-accent-ink">
              <span>Recommended Primary Path</span>
              <span>Flow C Canonical Workflow</span>
            </div>
            <h2 className="font-heading text-3xl font-bold text-pine">
              Complete Persona &amp; Clinical Booking Online
            </h2>
            <p className="text-sm text-pine/80 leading-relaxed">
              Submit your booking under a Self or Dependent persona. Your request enters our secure
              pending queue where a PRC-verified resident psychologist reviews fit, sets the session
              fee, and proposes 3 distinct schedule slots for your selection.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-lg bg-surface-sunken border border-mist space-y-1">
              <p className="font-semibold text-pine">1. Select Persona &amp; Service</p>
              <p className="text-pine/75">
                Choose from all 7 services with built-in duration and clinical scope guardrails.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-surface-sunken border border-mist space-y-1">
              <p className="font-semibold text-pine">2. Review 3 Proposed Slots</p>
              <p className="text-pine/75">
                Pick 1 of 3 psychologist-proposed times and finalize via payment to unlock contact.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                setCognitoRole('client');
                router.push('/personas');
              }}
            >
              Launch Flow C Booking Form
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                setCognitoRole('client');
                router.push('/bookings');
              }}
            >
              View Existing Bookings
            </Button>
          </div>
        </Card>

        {/* Secondary Option: Official External Fallback (Facebook Button + Email) */}
        <Card className="lg:col-span-5 space-y-6 bg-surface-sunken/60">
          <div className="space-y-2 border-b border-mist pb-4">
            <p className="text-xs font-semibold text-accent-ink">
              Direct Coordination Channels
            </p>
            <h2 className="font-heading text-2xl font-bold text-pine">
              External Booking Fallback
            </h2>
            <p className="text-xs text-pine/75 leading-relaxed">
              Prefer manual coordination or assisting an institutional group? Reach our booking desk
              directly via Facebook or email.
            </p>
          </div>

          {/* Official Facebook Button */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-pine">
              1. Official Facebook Page
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="dark"
                className="flex-1"
                onClick={() => handleCopy('fb', facebookFallbackUrl)}
              >
                <Facebook className="w-4 h-4 text-lime-soft shrink-0" aria-hidden="true" />
                <span>Message PSYCHAVE PH on Facebook</span>
              </Button>
            </div>
            {copiedField === 'fb' && (
              <p className="text-xs text-accent-ink font-medium">
                Facebook fallback link copied ({facebookFallbackUrl}) — safe for sandbox preview.
              </p>
            )}
          </div>

          {/* Official Email Fallback */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-pine">
              2. Official Clinic Coordination Email
            </p>
            <div className="p-3.5 rounded-lg bg-surface-raised border border-mist flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Mail className="w-4 h-4 text-accent-ink shrink-0" aria-hidden="true" />
                <span className="font-mono text-sm font-semibold text-pine truncate">
                  {clinicEmail}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy('email', clinicEmail)}
              >
                {copiedField === 'email' ? 'Copied Email' : 'Copy Email'}
              </Button>
            </div>
          </div>

          {/* Copyable Inquiry Template */}
          <div className="space-y-2 pt-2 border-t border-mist">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-pine">
                Standard Email Fallback Template
              </p>
              <button
                type="button"
                onClick={() => handleCopy('template', fallbackTemplate)}
                className="text-xs font-semibold text-accent-ink hover:text-pine underline cursor-pointer"
              >
                {copiedField === 'template' ? 'Template Copied' : 'Copy Template'}
              </button>
            </div>
            <pre className="p-3 rounded-lg bg-surface-raised border border-mist text-xs text-pine/80 font-mono whitespace-pre-wrap leading-relaxed">
              {fallbackTemplate}
            </pre>
          </div>
        </Card>
      </div>

      {/* Philippine Emergency / Crisis Protocol Guardrail */}
      <section className="bg-surface-sunken border border-mist rounded-lg p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="font-heading text-lg font-bold text-pine">
            Important Clinical Safety Notice (Non-Emergency Platform)
          </p>
          <p className="text-xs text-pine/80 max-w-3xl">
            PsychAvenuePH is an outpatient scheduled booking platform and does not provide immediate
            crisis intervention. If you or your dependent are experiencing an acute mental-health
            emergency, please contact the National Center for Mental Health (NCMH) Crisis Hotline.
          </p>
        </div>
        <div className="text-xs font-mono font-semibold text-pine bg-surface-raised px-4 py-2.5 rounded-lg border border-mist shrink-0 tabular-nums">
          NCMH 24/7 Hotline: 1553 / 0917-899-8727
        </div>
      </section>
    </div>
  );
}
