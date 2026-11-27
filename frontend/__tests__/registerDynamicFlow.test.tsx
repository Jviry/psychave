import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RegisterPage from '../app/(auth)/register/page';
import { api } from '../lib/api';
import { authApi } from '../authApi';
import { DEFAULT_WIZARD_PAGES } from '../lib/consent';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('../lib/api', () => ({
  api: {
    getActiveConsentForm: vi.fn(),
    getServices: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../authApi', () => ({
  authApi: {
    checkAvailability: vi.fn(),
    registerUser: vi.fn(),
    confirmUser: vi.fn(),
    resendCode: vi.fn(),
  },
}));

describe('RegisterPage dynamic CMS flow with Account Sign-Up last', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.clearAllMocks();
    vi.mocked(api.getServices).mockResolvedValue([]);
    vi.mocked(api.getActiveConsentForm).mockResolvedValue({
      templateId: 'tpl-v2',
      consentVersion: 'v2',
      informedConsentText: 'Consent text',
      typingStatement: 'Type your name',
      scopeLimitationsText: 'Scope text',
      scopeAckText: 'I acknowledge scope',
      overseasLimitationsText: 'Overseas text',
      overseasAckText: 'I acknowledge overseas',
      finalConsentStatement: 'Final consent',
      wizardPages: DEFAULT_WIZARD_PAGES,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
  });

  it('starts on CMS Step 1 of 5, hides dependent-only fields, and completes Account & privacy as final step', async () => {
    vi.mocked(authApi.checkAvailability).mockResolvedValueOnce({
      emailAvailable: true,
      usernameAvailable: true,
    });
    vi.mocked(authApi.registerUser).mockResolvedValueOnce({
      message: 'register successful, check email for code',
    });

    render(<RegisterPage />);

    // Step 1: Informed consent & agreement (dependent-only relation fields hidden for self)
    await waitFor(() => {
      expect(
        screen.getByText(/Step 1 of 5 · Informed consent & agreement/i)
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByLabelText(/Relation to account holder/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/Signer's relation to the client/i)
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Signer full name/i), {
      target: { value: 'Maria Santos' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 2: Services & acknowledgements
    await waitFor(() => {
      expect(
        screen.getByText(/Step 2 of 5 · Services & acknowledgements/i)
      ).toBeInTheDocument();
    });
    fireEvent.click(
      screen.getByLabelText(/I have read and understood the scope/i)
    );
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 3: Demographics (split first_name + last_name)
    await waitFor(() => {
      expect(
        screen.getByText(/Step 3 of 5 · Demographics/i)
      ).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText(/First name/i), {
      target: { value: 'Maria' },
    });
    fireEvent.change(screen.getByLabelText(/Last name/i), {
      target: { value: 'Santos' },
    });
    fireEvent.change(screen.getByLabelText(/Date of birth/i), {
      target: { value: '1995-04-12' },
    });
    fireEvent.change(screen.getByLabelText(/Nationality/i), {
      target: { value: 'Filipino' },
    });
    fireEvent.change(screen.getByLabelText(/^Contact number$/i), {
      target: { value: '09171234567' },
    });
    fireEvent.change(screen.getByLabelText(/^Permanent address$/i), {
      target: { value: 'Makati City' },
    });
    fireEvent.click(
      screen.getByLabelText(/Present address is the same as permanent address/i)
    );
    fireEvent.change(screen.getByLabelText(/Emergency contact name/i), {
      target: { value: 'Jose Santos' },
    });
    fireEvent.change(screen.getByLabelText(/Emergency contact relation/i), {
      target: { value: 'Brother' },
    });
    fireEvent.change(screen.getByLabelText(/Emergency contact number/i), {
      target: { value: '09181234567' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 4: Confirmation & final consent
    await waitFor(() => {
      expect(
        screen.getByText(/Step 4 of 5 · Confirmation & final consent/i)
      ).toBeInTheDocument();
    });
    fireEvent.click(
      screen.getByLabelText(/I confirm that the information provided is accurate/i)
    );
    fireEvent.change(screen.getByLabelText(/Final consent signer full name/i), {
      target: { value: 'Maria Santos' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 5 (Final): Account & privacy
    await waitFor(() => {
      expect(
        screen.getByText(/Step 5 of 5 · Account & privacy/i)
      ).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText(/Email address/i), {
      target: { value: 'maria@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^Username$/i), {
      target: { value: 'maria_santos' },
    });
    fireEvent.change(screen.getByLabelText(/^Password$/i), {
      target: { value: 'PsychAve!2026#Safe' },
    });
    fireEvent.change(screen.getByLabelText(/Confirm password/i), {
      target: { value: 'PsychAve!2026#Safe' },
    });
    fireEvent.click(screen.getByLabelText(/I have read and agree to the/i));
    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

    await waitFor(() => {
      expect(authApi.registerUser).toHaveBeenCalledTimes(1);
    });

    const callArg = vi.mocked(authApi.registerUser).mock.calls[0][0];
    expect(callArg.email).toBe('maria@example.com');
    expect(callArg.username).toBe('maria_santos');
    expect(callArg.profile.relation_to_account_holder).toBe('self');
    expect(callArg.profile.profile_name).toBe('Maria Santos');
    expect(callArg.profile.details?.first_name).toBe('Maria');
    expect(callArg.profile.details?.last_name).toBe('Santos');
    expect(callArg.profile.details?.present_address).toBe('Makati City');
    expect(callArg.consent.terms_signer_relation).toBe('self');
    expect(callArg.consent.terms_signer_name).toBe('Maria Santos');
    expect(callArg.consent.consent_signer_name).toBe('Maria Santos');
  });
});
