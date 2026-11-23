import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProfileWizard } from '../components/ProfileWizard';
import { useProfileWizardStore } from '../stores/useProfileWizardStore';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    getServices: vi.fn().mockResolvedValue([]),
    createProfileWithConsent: vi.fn(),
  },
}));

function renderWizard() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <ProfileWizard returnTo="manage" />
    </QueryClientProvider>
  );
}

describe('ProfileWizard validation & highlighting', () => {
  beforeEach(() => {
    useProfileWizardStore.getState().resetDraft();
    vi.clearAllMocks();
  });

  it('trims whitespace in step validation so trailing spaces do not slip past Step 1', async () => {
    renderWizard();
    const signerInput = screen.getByLabelText(/Signer full name/i);
    fireEvent.change(signerInput, { target: { value: 'A ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(signerInput).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByText(/Type the full name of the person signing consent/i)).toBeInTheDocument();
    });
  });

  it('does not offer a "Myself" / "self" option on Step 1 — only family member or other relations', () => {
    renderWizard();
    expect(screen.queryByLabelText(/Who is this profile for\?/i)).not.toBeInTheDocument();

    const relationSelect = screen.getByLabelText(/Relation to account holder/i) as HTMLSelectElement;
    const options = Array.from(relationSelect.options).map((o) => o.value);
    expect(options).toEqual(['child', 'spouse', 'parent', 'sibling', 'other']);
    expect(options).not.toContain('self');
  });

  it('surfaces backend FIELDS errors on the matching field instead of discarding them', async () => {
    vi.mocked(api.createProfileWithConsent).mockRejectedValueOnce(
      new Error('FIELDS:{"profile.nationality":"Invalid nationality code."}')
    );

    const store = useProfileWizardStore.getState();
    store.updateDraft({
      relation_to_account_holder: 'child',
      terms_signer_relation: 'parent',
      terms_signer_name: 'Adult Guardian',
      scope_acknowledged: true,
      profile_name: 'Dependent Client',
      date_of_birth: '2012-05-01',
      nationality: 'Filipino',
      permanent_address: '123 Main Street, Manila',
      present_address: '123 Main Street, Manila',
      contact_number: '09171234567',
      emergency_contact_name: 'Adult Guardian',
      emergency_contact_relation: 'Parent',
      emergency_contact_number: '09171234568',
      information_confirmed: true,
      consent_signer_name: 'Adult Guardian',
    });
    store.setStep(4);

    renderWizard();
    fireEvent.click(screen.getByRole('button', { name: /Submit profile & consent/i }));

    await waitFor(() => {
      expect(screen.getByText('Please fix the highlighted fields.')).toBeInTheDocument();
      const nationalityInput = screen.getByLabelText(/Nationality/i);
      expect(nationalityInput).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByText('Invalid nationality code.')).toBeInTheDocument();
    });
  });
});
