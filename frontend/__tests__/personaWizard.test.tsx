import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersonaWizard } from '../components/PersonaWizard';
import { usePersonaWizardStore } from '../stores/usePersonaWizardStore';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    getServices: vi.fn().mockResolvedValue([]),
    createPersonaWithConsent: vi.fn(),
  },
}));

function renderWizard() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <PersonaWizard returnTo="manage" />
    </QueryClientProvider>
  );
}

describe('PersonaWizard validation & highlighting', () => {
  beforeEach(() => {
    usePersonaWizardStore.getState().resetDraft();
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

  it('highlights whoFor on Step 1 when minor DOB is submitted with whoFor="myself"', async () => {
    const store = usePersonaWizardStore.getState();
    store.updateDraft({
      whoFor: 'myself',
      terms_signer_name: 'Minor Client',
      scope_acknowledged: true,
      persona_name: 'Minor Client',
      date_of_birth: '2015-05-01',
      nationality: 'Filipino',
      permanent_address: '123 Main Street, Manila',
      present_address: '123 Main Street, Manila',
      contact_number: '09171234567',
      emergency_contact_name: 'Parent Name',
      emergency_contact_relation: 'Mother',
      emergency_contact_number: '09171234568',
      information_confirmed: true,
      consent_signer_name: 'Minor Client',
    });
    store.setStep(4);

    renderWizard();
    fireEvent.click(screen.getByRole('button', { name: /Submit persona & consent/i }));

    await waitFor(() => {
      expect(screen.getByText('Please fix the highlighted fields.')).toBeInTheDocument();
      const whoForSelect = screen.getByLabelText(/Who is this persona for\?/i);
      expect(whoForSelect).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByText(/A minor persona cannot sign as "self"/i)).toBeInTheDocument();
    });
  });

  it('surfaces backend FIELDS errors on the matching field instead of discarding them', async () => {
    vi.mocked(api.createPersonaWithConsent).mockRejectedValueOnce(
      new Error('FIELDS:{"persona.nationality":"Invalid nationality code."}')
    );

    const store = usePersonaWizardStore.getState();
    store.updateDraft({
      whoFor: 'myself',
      terms_signer_name: 'Adult Client',
      scope_acknowledged: true,
      persona_name: 'Adult Client',
      date_of_birth: '1990-05-01',
      nationality: 'Filipino',
      permanent_address: '123 Main Street, Manila',
      present_address: '123 Main Street, Manila',
      contact_number: '09171234567',
      emergency_contact_name: 'Parent Name',
      emergency_contact_relation: 'Mother',
      emergency_contact_number: '09171234568',
      information_confirmed: true,
      consent_signer_name: 'Adult Client',
    });
    store.setStep(4);

    renderWizard();
    fireEvent.click(screen.getByRole('button', { name: /Submit persona & consent/i }));

    await waitFor(() => {
      expect(screen.getByText('Please fix the highlighted fields.')).toBeInTheDocument();
      const nationalityInput = screen.getByLabelText(/Nationality/i);
      expect(nationalityInput).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByText('Invalid nationality code.')).toBeInTheDocument();
    });
  });
});
