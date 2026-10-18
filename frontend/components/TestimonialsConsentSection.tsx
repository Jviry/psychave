'use client';

import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { CmsContent } from '../lib/types';

export function TestimonialsConsentSection({ cms }: { cms: CmsContent }) {
  const { sectionTitle, consentFlagBanner, ethicalStandardRef, emptyCards } =
    cms.testimonialsConfig;

  return (
    <section id="ra-10173-consent" className="py-12 border-t border-mist scroll-mt-20">
      <div className="space-y-4 max-w-3xl mb-8">
        <div className="flex items-center gap-2 text-xs text-accent-ink font-medium">
          <span>Ethical Confidentiality Architecture</span>
          <span aria-hidden="true">·</span>
          <span>{ethicalStandardRef}</span>
        </div>

        <h2 className="font-heading text-3xl font-bold text-pine tracking-tight">
          {sectionTitle}
        </h2>

        {/* Explicit Consent-Flag Note */}
        <div className="bg-surface-sunken border-l-2 border-sage p-4 rounded-r-lg text-sm text-pine">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-accent-ink shrink-0 mt-0.5" aria-hidden="true" />
            <p className="leading-relaxed">{consentFlagBanner}</p>
          </div>
        </div>
      </div>

      {/* Empty Cards with Consent-Flag Note (Zero personal quotes or client identifiers) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {emptyCards.map((slot) => (
          <div
            key={slot.id}
            className="bg-surface-raised border border-dashed border-mint/50 rounded-lg p-6 flex flex-col justify-between min-h-[210px]"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-pine/60">
                <span className="font-mono tabular-nums">{slot.slotCode}</span>
                <span>
                  Consent Flag:{' '}
                  <strong className="text-pine">
                    {slot.consentFlagStatus === 'withheld_by_default'
                      ? 'Withheld by Default'
                      : 'Structure Only'}
                  </strong>
                </span>
              </div>

              <p className="font-heading text-lg font-semibold text-pine">
                {slot.serviceCategory}
              </p>

              {/* Intentionally Empty Quote Region */}
              <div className="py-5 px-4 bg-parchment rounded-lg border border-mist/60 text-center">
                <p className="text-xs text-pine/65 italic">
                  [ Empty Card — No Personal Quotes Displayed ]
                </p>
              </div>
            </div>

            <p className="text-xs text-pine/75 pt-4 border-t border-mist/50 mt-4 leading-relaxed">
              {slot.governanceNote}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
