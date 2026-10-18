'use client';

import React from 'react';
import { CmsContent } from '../lib/types';

/**
 * Consent governance section (RA 10173). Renders the section title and the
 * consent-flag governance notice as plain text — no panels, no bands, no
 * placeholder testimonial content of any kind. The notice falls back to a
 * static governance line if the CMS block is ever cleared, so the privacy
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
      <div className="space-y-3 max-w-3xl">
        <div className="flex items-center gap-2 text-xs text-accent-ink font-medium">
          <span>Ethical Confidentiality Architecture</span>
          <span aria-hidden="true">·</span>
          <span>{ethicalStandardRef || DEFAULT_STANDARD_REF}</span>
        </div>

        <h2 className="font-heading text-3xl font-bold text-pine tracking-tight">
          {sectionTitle || DEFAULT_SECTION_TITLE}
        </h2>

        <p className="text-sm text-pine/80 leading-relaxed">
          {consentFlagBanner || DEFAULT_CONSENT_BANNER}
        </p>
      </div>
    </section>
  );
}
