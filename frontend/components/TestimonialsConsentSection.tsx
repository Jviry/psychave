'use client';

import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { CmsContent } from '../lib/types';

/**
 * Consent governance section (RA 10173). Renders the section title and the
 * consent-flag governance banner only — no testimonial slot cards, no
 * placeholder testimonial content of any kind. Banner/title fallback to a
 * static governance notice if the CMS block is ever cleared, so the privacy
 * notice can never disappear from public pages.
 *
 * `emptyCards` stays in the CmsContent type (contract §6.6) but is
 * intentionally not rendered.
 */
const DEFAULT_SECTION_TITLE = 'Client Reflections & Consent Governance';
const DEFAULT_CONSENT_BANNER =
  'Consent-Flag Governance Active — No personal quotes, client names, or identifiable narratives are displayed. Public pages render no testimonial content, in line with clinical confidentiality rules and Philippine Data Privacy Act (RA 10173) standards.';
const DEFAULT_STANDARD_REF = 'PAP Code of Ethics · RA 10173 Privacy Baseline';

export function TestimonialsConsentSection({ cms }: { cms: CmsContent }) {
  const { sectionTitle, consentFlagBanner, ethicalStandardRef } = cms.testimonialsConfig;

  return (
    <section id="ra-10173-consent" className="py-12 border-t border-mist scroll-mt-20">
      <div className="space-y-4 max-w-3xl">
        <div className="flex items-center gap-2 text-xs text-accent-ink font-medium">
          <span>Ethical Confidentiality Architecture</span>
          <span aria-hidden="true">·</span>
          <span>{ethicalStandardRef || DEFAULT_STANDARD_REF}</span>
        </div>

        <h2 className="font-heading text-3xl font-bold text-pine tracking-tight">
          {sectionTitle || DEFAULT_SECTION_TITLE}
        </h2>

        {/* Explicit Consent-Flag Note */}
        <div className="bg-surface-sunken border-l-2 border-sage p-4 rounded-r-lg text-sm text-pine">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-accent-ink shrink-0 mt-0.5" aria-hidden="true" />
            <p className="leading-relaxed">{consentFlagBanner || DEFAULT_CONSENT_BANNER}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
