'use client';

import React from 'react';
import { CmsContent } from '../lib/types';

export function TestimonialsConsentSection({ cms }: { cms: CmsContent }) {
  const { sectionTitle, consentFlagBanner, ethicalStandardRef, emptyCards } =
    cms.testimonialsConfig;

  return (
    <section className="py-12 border-t border-[#C0D3C3]">
      <div className="space-y-4 max-w-3xl mb-8">
        <div className="flex items-center gap-2 text-xs text-[#5D8B69] font-medium">
          <span>Ethical Confidentiality Architecture</span>
          <span aria-hidden="true">·</span>
          <span>{ethicalStandardRef}</span>
        </div>

        <h2 className="font-heading text-3xl font-bold text-[#25372D]">
          {sectionTitle}
        </h2>

        {/* Explicit Consent-Flag Note */}
        <div className="bg-[#EBF2EC] border-l-4 border-[#5D8B69] p-4 rounded-r-lg text-sm text-[#25372D]">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-[#5D8B69] shrink-0 mt-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            <p className="leading-relaxed">{consentFlagBanner}</p>
          </div>
        </div>
      </div>

      {/* Empty Cards with Consent-Flag Note (Zero personal quotes or client identifiers) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {emptyCards.map((slot) => (
          <div
            key={slot.id}
            className="bg-white border border-dashed border-[#8FBE8F] rounded-xl p-6 flex flex-col justify-between min-h-[210px]"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-[#25372D]/60">
                <span className="font-mono tabular-nums">{slot.slotCode}</span>
                <span>
                  Consent Flag:{' '}
                  <strong className="text-[#25372D]">
                    {slot.consentFlagStatus === 'withheld_by_default'
                      ? 'Withheld by Default'
                      : 'Structure Only'}
                  </strong>
                </span>
              </div>

              <p className="font-heading text-lg font-semibold text-[#25372D]">
                {slot.serviceCategory}
              </p>

              {/* Intentionally Empty Quote Region */}
              <div className="py-5 px-4 bg-[#F6F9F6] rounded-lg border border-[#C0D3C3]/60 text-center">
                <p className="text-xs text-[#25372D]/65 italic">
                  [ Empty Card — No Personal Quotes Displayed ]
                </p>
              </div>
            </div>

            <p className="text-xs text-[#25372D]/75 pt-4 border-t border-[#C0D3C3]/50 mt-4 leading-relaxed">
              {slot.governanceNote}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
