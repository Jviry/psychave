import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProfilesPage from '../app/(site)/profiles/page';
import ProfileEditPage from '../app/(site)/profiles/[id]/edit/page';
import { api } from '../lib/api';
import type { Profile } from '../lib/types';

const pushMock = vi.fn();
const replaceMock = vi.fn();
let mockParams: { id?: string } = { id: '7a3c11a2-1b2c-4d3e-8f90-112233445566' };
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
  useParams: () => mockParams,
  useSearchParams: () => mockSearchParams,
}));

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: '7a3c11a2-1b2c-4d3e-8f90-112233445566',
    clientId: 'client-1',
    type: 'self',
    label: 'Alex Rivera',
    ageGroup: 'Adult (30)',
    relationshipToClient: 'self',
    preferredLanguage: 'English',
    createdAt: '2026-11-01',
    dateOfBirth: '1996-05-15',
    occupation: 'Designer',
    nationality: 'Filipino',
    permanentAddress: '123 Maple St, Quezon City',
    presentAddress: '456 Oak Ave, Makati City',
    contactNumber: '09171239277',
    socmedPlatform: 'instagram',
    socmedUsername: '@alexrivera',
    preferredContactMode: 'phone',
    emergencyContactName: 'Maria Rivera',
    emergencyContactRelation: 'Mother',
    emergencyContactNumber: '09179876543',
    signedConsentVersion: 'v2',
    activeConsentVersion: 'v2',
    consentOutdated: false,
    ...overrides,
  };
}

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('Client profile edit redirect & dedicated settings page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    pushMock.mockReset();
    replaceMock.mockReset();
    mockParams = { id: '7a3c11a2-1b2c-4d3e-8f90-112233445566' };
    mockSearchParams = new URLSearchParams();
  });

  it('redirects to /profiles/:id/edit when clicking Edit on the profiles page', async () => {
    const profile = makeProfile();
    vi.spyOn(api, 'getProfiles').mockResolvedValue([profile]);

    renderWithQuery(<ProfilesPage />);

    const editBtn = await screen.findByRole('button', { name: /edit/i });
    fireEvent.click(editBtn);

    expect(pushMock).toHaveBeenCalledWith(`/profiles/${profile.id}/edit`);
  });

  it('preserves returnTo=/book when redirecting from profiles page to edit page', async () => {
    const profile = makeProfile();
    mockSearchParams = new URLSearchParams('returnTo=/book');
    vi.spyOn(api, 'getProfiles').mockResolvedValue([profile]);

    renderWithQuery(<ProfilesPage />);

    const editBtn = await screen.findByRole('button', { name: /edit/i });
    fireEvent.click(editBtn);

    expect(pushMock).toHaveBeenCalledWith(`/profiles/${profile.id}/edit?returnTo=/book`);
  });

  it('renders grouped sections with masked phone numbers and Reveal/Hide toggles', async () => {
    const profile = makeProfile();
    vi.spyOn(api, 'getProfile').mockResolvedValue(profile);

    renderWithQuery(<ProfileEditPage />);

    expect(await screen.findByRole('heading', { name: 'Personal Info' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Contact & Address' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Emergency Contact' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Informed Consent' })).toBeInTheDocument();

    // Phone number is masked initially and reveals on click
    expect(screen.getByText('*******9277')).toBeInTheDocument();
    const revealButtons = screen.getAllByRole('button', { name: 'Reveal' });
    expect(revealButtons).toHaveLength(2);

    fireEvent.click(revealButtons[0]);
    expect(screen.getByText('09171239277')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide' })).toBeInTheDocument();

    // Primary self-profile relation edit button is disabled
    expect(
      screen.getByRole('button', { name: 'Edit Relation to Account' })
    ).toBeDisabled();
  });

  it('opens a focused edit modal for a field, validates, and saves via api.updateProfile', async () => {
    const profile = makeProfile();
    const updatedProfile = makeProfile({ label: 'Alex Santos' });

    vi.spyOn(api, 'getProfile').mockResolvedValue(profile);
    const updateSpy = vi.spyOn(api, 'updateProfile').mockResolvedValue(updatedProfile);

    renderWithQuery(<ProfileEditPage />);

    const editNameBtn = await screen.findByRole('button', { name: 'Edit Full Name' });
    fireEvent.click(editNameBtn);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();

    const input = screen.getByLabelText('Full name');
    fireEvent.change(input, { target: { value: 'A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Enter the profile full name.')).toBeInTheDocument();
    expect(updateSpy).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: 'Alex Santos' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        profile.id,
        expect.objectContaining({
          profile_name: 'Alex Santos',
          relation_to_account_holder: 'self',
        })
      );
    });

    expect(await screen.findByText('Profile information updated.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Alex Santos' })).toBeInTheDocument();
  });
});
