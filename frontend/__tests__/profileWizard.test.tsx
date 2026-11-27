import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProfileWizard } from '../components/ProfileWizard';
import { useProfileWizardStore } from '../stores/useProfileWizardStore';
import { api } from '../lib/api';
import { DEFAULT_WIZARD_PAGES } from '../lib/consent';
import type { Profile } from '../lib/types';

vi.mock('../lib/api', () => ({
  api: {
    getActiveConsentForm: vi.fn().mockResolvedValue(null),
    getServices: vi.fn().mockResolvedValue([]),
    createProfileWithConsent: vi.fn(),
    resignProfileConsent: vi.fn(),
  },
}));

function renderWizard(props?: { resignProfile?: Profile | null }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <ProfileWizard returnTo="manage" resignProfile={props?.resignProfile} />
    </QueryClientProvider>
  );
}

describe('ProfileWizard dynamic CMS flow', () => {
  beforeEach(() => {
    useProfileWizardStore.getState().resetDraft();
    vi.clearAllMocks();
    vi.mocked(api.getActiveConsentForm).mockResolvedValue(null as never);
    vi.mocked(api.getServices).mockResolvedValue([]);
  });

  it('starts on the first CMS page (Step 1 of 4 · Informed consent & agreement) and omits "self" from relation options', () => {
    renderWizard();
    expect(
      screen.getByText(/Step 1 of 4 · Informed consent & agreement/i)
    ).toBeInTheDocument();

    const relationSelect = screen.getByLabelText(
      /Relation to account holder/i
    ) as HTMLSelectElement;
    const options = Array.from(relationSelect.options).map((o) => o.value);
    expect(options).toEqual(['child', 'spouse', 'parent', 'sibling', 'other']);
    expect(options).not.toContain('self');
  });

  it('renders custom CMS pages and auto-renders "Same as permanent address" before present_address', async () => {
    const customPages = JSON.parse(JSON.stringify(DEFAULT_WIZARD_PAGES));
    customPages[2].blocks.push({
      blockId: 'referral_source',
      type: 'text',
      label: 'How did you hear about us?',
      placeholder: 'Friend, social media, etc.',
      target: 'custom',
      fieldKey: 'referral_source',
      appliesTo: 'all',
      required: false,
      options: [],
      showIf: null,
      systemLocked: false,
    });

    vi.mocked(api.getActiveConsentForm).mockResolvedValueOnce({
      templateId: 'tpl-1',
      consentVersion: 'v2.1',
      informedConsentText: '',
      typingStatement: '',
      scopeLimitationsText: '',
      scopeAckText: '',
      overseasLimitationsText: '',
      overseasAckText: '',
      finalConsentStatement: '',
      wizardPages: customPages,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });

    useProfileWizardStore.getState().setStep(3);
    renderWizard();

    await waitFor(() => {
      expect(screen.getByText(/Step 3 of 4 · Demographics/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/First name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Last name/i)).toBeInTheDocument();
      expect(
        screen.getByLabelText(/How did you hear about us\?/i)
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(/Present address is the same as permanent address/i)
      ).toBeInTheDocument();
    });
  });

  it('auto-filters out pure demographic pages in resign mode', () => {
    const resignProfile: Profile = {
      id: 'prof-1',
      clientId: 'client-1',
      type: 'dependent',
      label: 'Dependent Client',
      ageGroup: 'Child',
      relationshipToClient: 'child',
      preferredLanguage: 'en',
      createdAt: '2026-01-01T00:00:00Z',
      dateOfBirth: '2014-05-01',
    };

    renderWizard({ resignProfile });
    // Default 4 CMS pages -> Demographics (page 3) has only profile blocks, so resign has 3 steps
    expect(
      screen.getByText(/Step 1 of 3 · Informed consent & agreement/i)
    ).toBeInTheDocument();
  });

  it('surfaces backend FIELDS errors on the matching field and jumps to its CMS step', async () => {
    vi.mocked(api.createProfileWithConsent).mockRejectedValueOnce(
      new Error('FIELDS:{"profile.nationality":"Invalid nationality code."}')
    );

    const store = useProfileWizardStore.getState();
    store.updateDraft({
      relation_to_account_holder: 'child',
      first_name: 'Dependent',
      last_name: 'Client',
      date_of_birth: '2012-05-01',
      nationality: 'Filipino',
      permanent_address: '123 Main Street, Manila',
      present_address: '123 Main Street, Manila',
      contact_number: '09171234567',
      emergency_contact_name: 'Adult Guardian',
      emergency_contact_relation: 'Parent',
      emergency_contact_number: '09171234568',
      scope_acknowledged: true,
      terms_agreed: true,
      terms_signer_relation: 'parent',
      information_confirmed: true,
    });
    store.setStep(4);

    renderWizard();
    fireEvent.click(screen.getByRole('button', { name: /Create Profile/i }));

    await waitFor(() => {
      expect(screen.getByText('Please fix the highlighted fields.')).toBeInTheDocument();
      const nationalityInput = screen.getByLabelText(/Nationality/i);
      expect(nationalityInput).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByText('Invalid nationality code.')).toBeInTheDocument();
    });
  });
});
