'use client';

import React, { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import {
  type PreferredContactMode,
  type RelationToAccountHolder,
  isMinorDob,
  isValidPhone,
} from '@/lib/consent';
import { wizardStep3Schema } from '@/lib/schemas';
import type { Profile } from '@/lib/types';
import { Toast } from '@/components/auth/Toast';
import {
  Button,
  Card,
  Checkbox,
  Input,
  Label,
  Modal,
  Select,
  Skeleton,
  Textarea,
} from '@/components/ui/primitives';

type EditableFieldKey =
  | 'profile_name'
  | 'relation_to_account_holder'
  | 'date_of_birth'
  | 'nationality'
  | 'occupation'
  | 'contact_number'
  | 'preferred_contact_mode'
  | 'social_media'
  | 'permanent_address'
  | 'present_address'
  | 'emergency_contact_name'
  | 'emergency_contact_relation'
  | 'emergency_contact_number';

interface ProfileFormValues {
  profile_name: string;
  relation_to_account_holder: RelationToAccountHolder;
  date_of_birth: string;
  occupation: string;
  nationality: string;
  permanent_address: string;
  present_address: string;
  contact_number: string;
  preferred_contact_mode: PreferredContactMode;
  socmed_platform: string;
  socmed_username: string;
  emergency_contact_name: string;
  emergency_contact_relation: string;
  emergency_contact_number: string;
}

const RELATION_LABELS: Record<RelationToAccountHolder, string> = {
  self: 'Self (Primary)',
  child: 'Child',
  spouse: 'Spouse',
  parent: 'Parent',
  sibling: 'Sibling',
  other: 'Other',
};

const CONTACT_MODE_LABELS: Record<PreferredContactMode, string> = {
  phone: 'Phone',
  email: 'Email',
  messenger: 'Messenger',
  instagram: 'Instagram',
};

const SOCMED_PLATFORM_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'messenger', label: 'Messenger' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'x', label: 'X' },
  { value: 'other', label: 'Other' },
];

const FIELD_META: Record<
  EditableFieldKey,
  { title: string; description: string }
> = {
  profile_name: {
    title: 'Edit full name',
    description: 'Update the full legal name associated with this profile.',
  },
  relation_to_account_holder: {
    title: 'Edit relation to account',
    description: 'Select how this dependent relates to the primary account holder.',
  },
  date_of_birth: {
    title: 'Edit date of birth',
    description: 'Used to determine age group and clinical eligibility.',
  },
  nationality: {
    title: 'Edit nationality',
    description: 'Update nationality for jurisdiction and contact formatting.',
  },
  occupation: {
    title: 'Edit occupation',
    description: 'Optional. Leave blank if not applicable.',
  },
  contact_number: {
    title: 'Edit contact number',
    description: 'Primary phone number used for appointment coordination.',
  },
  preferred_contact_mode: {
    title: 'Edit preferred contact mode',
    description: 'Choose how your psychologist or clinic staff should reach out.',
  },
  social_media: {
    title: 'Edit social media',
    description: 'Optional platform and handle for session coordination.',
  },
  permanent_address: {
    title: 'Edit permanent address',
    description: 'Update the permanent residential address on file.',
  },
  present_address: {
    title: 'Edit present address',
    description: 'Update the current residential address.',
  },
  emergency_contact_name: {
    title: 'Edit emergency contact name',
    description: 'Full name of the person to reach in an emergency.',
  },
  emergency_contact_relation: {
    title: 'Edit emergency contact relation',
    description: 'Relationship to the profile holder (e.g. Mother, Spouse).',
  },
  emergency_contact_number: {
    title: 'Edit emergency contact number',
    description: 'Phone number for the emergency contact.',
  },
};

function profileToValues(p: Profile): ProfileFormValues {
  const relation = (p.relationshipToClient ||
    (p.type === 'self' ? 'self' : 'child')) as RelationToAccountHolder;
  return {
    profile_name: p.label,
    relation_to_account_holder: relation,
    date_of_birth: p.dateOfBirth ?? '',
    occupation: p.occupation ?? '',
    nationality: p.nationality ?? '',
    permanent_address: p.permanentAddress ?? '',
    present_address: p.presentAddress ?? '',
    contact_number: p.contactNumber ?? '',
    preferred_contact_mode: p.preferredContactMode ?? 'phone',
    socmed_platform: p.socmedPlatform ?? '',
    socmed_username: p.socmedUsername ?? '',
    emergency_contact_name: p.emergencyContactName ?? '',
    emergency_contact_relation: p.emergencyContactRelation ?? '',
    emergency_contact_number: p.emergencyContactNumber ?? '',
  };
}

function maskPhone(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) return 'Not set';
  if (trimmed.length <= 4) return '•'.repeat(trimmed.length);
  return `${'*'.repeat(Math.max(4, trimmed.length - 4))}${trimmed.slice(-4)}`;
}

function formatDateDisplay(iso: string | undefined): string {
  if (!iso) return 'Not set';
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatSocialMedia(platform?: string | null, username?: string | null): string {
  const p = (platform ?? '').trim();
  const u = (username ?? '').trim();
  if (!p && !u) return 'Not set';
  const platformLabel =
    SOCMED_PLATFORM_OPTIONS.find((opt) => opt.value === p)?.label ?? p;
  if (platformLabel && u) return `${platformLabel} · ${u}`;
  return u || platformLabel;
}

function SettingsRow({
  label,
  value,
  mutedValue = false,
  revealable,
  revealed,
  onToggleReveal,
  onEdit,
  editLabel = 'Edit',
  editDisabled = false,
  editDisabledReason,
}: {
  label: string;
  value?: string;
  mutedValue?: boolean;
  revealable?: boolean;
  revealed?: boolean;
  onToggleReveal?: () => void;
  onEdit?: () => void;
  editLabel?: string;
  editDisabled?: boolean;
  editDisabledReason?: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-pine">{label}</p>
        {editDisabledReason && (
          <p className="text-xs text-pine/55 mt-0.5">{editDisabledReason}</p>
        )}
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-5 min-w-0">
        {value !== undefined && (
          <div className="flex items-center gap-2.5 min-w-0 text-right">
            <span
              className={`text-sm truncate max-w-[260px] sm:max-w-[320px] ${
                mutedValue ? 'text-pine/45' : 'text-pine/85'
              } ${revealable ? 'tabular-nums' : ''}`}
              title={revealed || !revealable ? value : undefined}
            >
              {value}
            </span>
            {revealable && onToggleReveal && (
              <button
                type="button"
                onClick={onToggleReveal}
                className="text-sm font-medium text-accent-ink hover:text-pine transition-colors cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage rounded"
              >
                {revealed ? 'Hide' : 'Reveal'}
              </button>
            )}
          </div>
        )}

        {onEdit && (
          <button
            type="button"
            disabled={editDisabled}
            onClick={onEdit}
            aria-label={`${editLabel} ${label}`}
            className="inline-flex items-center justify-center min-w-[76px] rounded-lg border border-mist bg-surface-sunken px-4 py-1.5 text-sm font-medium text-pine transition-colors duration-150 hover:bg-mist/50 hover:border-mint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage disabled:opacity-45 disabled:pointer-events-none cursor-pointer shrink-0"
          >
            {editLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function ProfileEditContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const profileId = typeof params?.id === 'string' ? params.id : '';
  const returnTo = searchParams.get('returnTo');
  const backHref = returnTo === '/book' ? '/profiles?returnTo=/book' : '/profiles';

  const cachedProfile = useMemo(() => {
    const list = queryClient.getQueryData<Profile[]>(['profiles']);
    return list?.find((p) => p.id === profileId);
  }, [queryClient, profileId]);

  const {
    data: profile,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['profile', profileId],
    queryFn: () => api.getProfile(profileId),
    enabled: Boolean(profileId),
    initialData: cachedProfile,
  });

  const [revealedFields, setRevealedFields] = useState<Record<string, boolean>>({});
  const [activeField, setActiveField] = useState<EditableFieldKey | null>(null);
  const [draft, setDraft] = useState<ProfileFormValues | null>(null);
  const [sameAsPermanent, setSameAsPermanent] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(
    null
  );

  const toggleReveal = (key: string) => {
    setRevealedFields((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const openEditModal = (field: EditableFieldKey) => {
    if (!profile) return;
    const initial = profileToValues(profile);
    setDraft(initial);
    setSameAsPermanent(
      field === 'present_address' &&
        Boolean(initial.permanent_address) &&
        initial.present_address === initial.permanent_address
    );
    setFieldError(null);
    setActiveField(field);
  };

  const closeEditModal = () => {
    if (updateMutation.isPending) return;
    setActiveField(null);
    setDraft(null);
    setFieldError(null);
  };

  const updateMutation = useMutation({
    mutationFn: (form: ProfileFormValues) =>
      api.updateProfile(profileId, {
        relation_to_account_holder: form.relation_to_account_holder,
        profile_name: form.profile_name.trim().replace(/\s+/g, ' '),
        date_of_birth: form.date_of_birth,
        occupation: form.occupation.trim(),
        nationality: form.nationality.trim(),
        permanent_address: form.permanent_address.trim(),
        present_address: form.present_address.trim(),
        contact_number: form.contact_number.trim(),
        socmed_platform: form.socmed_platform.trim(),
        socmed_username: form.socmed_username.trim(),
        preferred_contact_mode: form.preferred_contact_mode,
        emergency_contact_name: form.emergency_contact_name.trim().replace(/\s+/g, ' '),
        emergency_contact_relation: form.emergency_contact_relation.trim(),
        emergency_contact_number: form.emergency_contact_number.trim(),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['profile', profileId], updated);
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      setActiveField(null);
      setDraft(null);
      setFieldError(null);
      setToast({ message: 'Profile information updated.', type: 'success' });
    },
    onError: (err) => {
      setFieldError(err instanceof Error ? err.message : 'Could not update profile.');
    },
  });

  const validateFieldAndSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft || !activeField || !profile) return;

    const candidate: ProfileFormValues = {
      ...draft,
      present_address:
        activeField === 'present_address' && sameAsPermanent
          ? draft.permanent_address
          : draft.present_address,
    };

    const isOverseas = !['filipino', 'philippines', 'ph'].includes(
      candidate.nationality.trim().toLowerCase()
    );

    // Validate the specific field being edited first for crisp inline feedback
    if (activeField === 'social_media') {
      if (candidate.socmed_username.trim() && !candidate.socmed_platform) {
        setFieldError('Choose the platform for this username.');
        return;
      }
    } else if (activeField === 'contact_number') {
      if (!candidate.contact_number.trim()) {
        setFieldError('Enter a contact number.');
        return;
      }
      if (!isValidPhone(candidate.contact_number, isOverseas)) {
        setFieldError('Enter a valid phone number.');
        return;
      }
    } else if (activeField === 'emergency_contact_number') {
      if (!candidate.emergency_contact_number.trim()) {
        setFieldError('Enter an emergency contact number.');
        return;
      }
      if (!isValidPhone(candidate.emergency_contact_number, isOverseas)) {
        setFieldError('Enter a valid emergency contact number.');
        return;
      }
    } else if (activeField === 'date_of_birth') {
      if (
        candidate.relation_to_account_holder === 'self' &&
        candidate.date_of_birth &&
        isMinorDob(candidate.date_of_birth)
      ) {
        setFieldError('Primary account holder must be at least 18 years old.');
        return;
      }
    }

    const parsed = wizardStep3Schema.safeParse({
      ...candidate,
      sameAsPermanent: false,
    });
    if (!parsed.success) {
      const relevant =
        parsed.error.issues.find((issue) => String(issue.path[0]) === activeField) ??
        parsed.error.issues[0];
      if (relevant) {
        setFieldError(relevant.message);
        return;
      }
    }

    setFieldError(null);
    updateMutation.mutate(candidate);
  };

  if (isLoading && !profile) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-64" />
        <Card className="p-6 sm:p-8 space-y-5">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </Card>
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-ink hover:text-pine transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          Back to profiles
        </Link>
        <Card className="p-6 sm:p-8 space-y-3">
          <h1 className="font-heading text-2xl font-medium text-pine">Profile not found</h1>
          <p className="text-sm text-pine/70">
            {error instanceof Error
              ? error.message
              : 'We could not load this profile. It may have been removed or you may not have access.'}
          </p>
          <div className="pt-2">
            <Button variant="outline" size="sm" onClick={() => router.push(backHref)}>
              Return to profiles
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const relationKey = (profile.relationshipToClient ||
    (profile.type === 'self' ? 'self' : 'child')) as RelationToAccountHolder;
  const relationDisplay = RELATION_LABELS[relationKey] ?? profile.relationshipToClient;
  const contactModeDisplay = profile.preferredContactMode
    ? CONTACT_MODE_LABELS[profile.preferredContactMode] ?? profile.preferredContactMode
    : 'Not set';
  const socialDisplay = formatSocialMedia(profile.socmedPlatform, profile.socmedUsername);

  const contactNumberDisplay = profile.contactNumber
    ? revealedFields.contact_number
      ? profile.contactNumber
      : maskPhone(profile.contactNumber)
    : 'Not set';

  const emergencyNumberDisplay = profile.emergencyContactNumber
    ? revealedFields.emergency_contact_number
      ? profile.emergencyContactNumber
      : maskPhone(profile.emergencyContactNumber)
    : 'Not set';

  const modalMeta = activeField ? FIELD_META[activeField] : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="space-y-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-ink hover:text-pine transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          Back to profiles
        </Link>

        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h1 className="font-heading text-3xl sm:text-4xl font-medium text-pine">
              {profile.label}
            </h1>
            <p className="text-sm text-pine/65 mt-1">
              {profile.type === 'self' ? 'Self (Primary)' : `Dependent · ${relationDisplay}`}
              {profile.ageGroup ? ` · ${profile.ageGroup}` : ''}
            </p>
          </div>
        </div>
      </div>

      <Card className="p-6 sm:p-8 divide-y divide-mist">
        {/* Section 1: Personal Info */}
        <section aria-labelledby="section-personal-info" className="pb-6">
          <h2
            id="section-personal-info"
            className="font-heading text-2xl font-medium text-pine mb-3"
          >
            Personal Info
          </h2>
          <div>
            <SettingsRow
              label="Full Name"
              value={profile.label || 'Not set'}
              mutedValue={!profile.label}
              onEdit={() => openEditModal('profile_name')}
            />
            <SettingsRow
              label="Relation to Account"
              value={relationDisplay}
              onEdit={() => openEditModal('relation_to_account_holder')}
              editDisabled={profile.type === 'self'}
              editDisabledReason={
                profile.type === 'self'
                  ? 'Primary account holder relation cannot be changed.'
                  : undefined
              }
            />
            <SettingsRow
              label="Date of Birth"
              value={formatDateDisplay(profile.dateOfBirth)}
              mutedValue={!profile.dateOfBirth}
              onEdit={() => openEditModal('date_of_birth')}
            />
            <SettingsRow
              label="Nationality"
              value={profile.nationality || 'Not set'}
              mutedValue={!profile.nationality}
              onEdit={() => openEditModal('nationality')}
            />
            <SettingsRow
              label="Occupation"
              value={profile.occupation || 'Not set'}
              mutedValue={!profile.occupation}
              onEdit={() => openEditModal('occupation')}
            />
          </div>
        </section>

        {/* Section 2: Contact & Address */}
        <section aria-labelledby="section-contact-address" className="py-6">
          <h2
            id="section-contact-address"
            className="font-heading text-2xl font-medium text-pine mb-3"
          >
            Contact &amp; Address
          </h2>
          <div>
            <SettingsRow
              label="Phone Number"
              value={contactNumberDisplay}
              mutedValue={!profile.contactNumber}
              revealable={Boolean(profile.contactNumber)}
              revealed={Boolean(revealedFields.contact_number)}
              onToggleReveal={() => toggleReveal('contact_number')}
              onEdit={() => openEditModal('contact_number')}
            />
            <SettingsRow
              label="Preferred Contact Mode"
              value={contactModeDisplay}
              mutedValue={!profile.preferredContactMode}
              onEdit={() => openEditModal('preferred_contact_mode')}
            />
            <SettingsRow
              label="Social Media"
              value={socialDisplay}
              mutedValue={socialDisplay === 'Not set'}
              onEdit={() => openEditModal('social_media')}
            />
            <SettingsRow
              label="Permanent Address"
              value={profile.permanentAddress || 'Not set'}
              mutedValue={!profile.permanentAddress}
              onEdit={() => openEditModal('permanent_address')}
            />
            <SettingsRow
              label="Present Address"
              value={profile.presentAddress || 'Not set'}
              mutedValue={!profile.presentAddress}
              onEdit={() => openEditModal('present_address')}
            />
          </div>
        </section>

        {/* Section 3: Emergency Contact */}
        <section aria-labelledby="section-emergency-contact" className="py-6">
          <h2
            id="section-emergency-contact"
            className="font-heading text-2xl font-medium text-pine mb-3"
          >
            Emergency Contact
          </h2>
          <div>
            <SettingsRow
              label="Contact Name"
              value={profile.emergencyContactName || 'Not set'}
              mutedValue={!profile.emergencyContactName}
              onEdit={() => openEditModal('emergency_contact_name')}
            />
            <SettingsRow
              label="Relation"
              value={profile.emergencyContactRelation || 'Not set'}
              mutedValue={!profile.emergencyContactRelation}
              onEdit={() => openEditModal('emergency_contact_relation')}
            />
            <SettingsRow
              label="Emergency Number"
              value={emergencyNumberDisplay}
              mutedValue={!profile.emergencyContactNumber}
              revealable={Boolean(profile.emergencyContactNumber)}
              revealed={Boolean(revealedFields.emergency_contact_number)}
              onToggleReveal={() => toggleReveal('emergency_contact_number')}
              onEdit={() => openEditModal('emergency_contact_number')}
            />
          </div>
        </section>

        {/* Section 4: Consent & Agreements */}
        <section aria-labelledby="section-consent" className="pt-6">
          <h2
            id="section-consent"
            className="font-heading text-2xl font-medium text-pine mb-3"
          >
            Informed Consent
          </h2>
          <div>
            <SettingsRow
              label="Consent Agreement"
              value={
                profile.consentOutdated
                  ? `Update required (${profile.activeConsentVersion ?? 'new version'})`
                  : profile.signedConsentVersion
                    ? `Signed (${profile.signedConsentVersion})`
                    : 'Signed'
              }
              onEdit={
                profile.consentOutdated
                  ? () => router.push(`/profiles/new?resign=${profile.id}`)
                  : undefined
              }
              editLabel="Re-sign"
            />
          </div>
        </section>
      </Card>

      {/* Focused Edit Modal */}
      <Modal
        open={Boolean(activeField && draft && modalMeta)}
        onClose={closeEditModal}
        title={modalMeta?.title ?? 'Edit field'}
        description={modalMeta?.description}
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={closeEditModal}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="profile-field-edit-form"
              variant="primary"
              size="sm"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        {activeField && draft && (
          <form
            id="profile-field-edit-form"
            onSubmit={validateFieldAndSave}
            noValidate
            className="space-y-4"
          >
            {activeField === 'profile_name' && (
              <div>
                <Label htmlFor="modal-profile-name">Full name</Label>
                <Input
                  id="modal-profile-name"
                  data-autofocus
                  value={draft.profile_name}
                  onChange={(e) => setDraft({ ...draft, profile_name: e.target.value })}
                  aria-invalid={fieldError ? true : undefined}
                />
              </div>
            )}

            {activeField === 'relation_to_account_holder' && (
              <div>
                <Label htmlFor="modal-relation">Relation to account</Label>
                <Select
                  id="modal-relation"
                  data-autofocus
                  value={draft.relation_to_account_holder}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      relation_to_account_holder: e.target
                        .value as RelationToAccountHolder,
                    })
                  }
                >
                  <option value="child">Child</option>
                  <option value="spouse">Spouse</option>
                  <option value="parent">Parent</option>
                  <option value="sibling">Sibling</option>
                  <option value="other">Other</option>
                </Select>
              </div>
            )}

            {activeField === 'date_of_birth' && (
              <div>
                <Label htmlFor="modal-dob">Date of birth</Label>
                <Input
                  id="modal-dob"
                  data-autofocus
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={draft.date_of_birth}
                  onChange={(e) => setDraft({ ...draft, date_of_birth: e.target.value })}
                  aria-invalid={fieldError ? true : undefined}
                />
              </div>
            )}

            {activeField === 'nationality' && (
              <div>
                <Label htmlFor="modal-nationality">Nationality</Label>
                <Input
                  id="modal-nationality"
                  data-autofocus
                  placeholder="e.g. Filipino"
                  value={draft.nationality}
                  onChange={(e) => setDraft({ ...draft, nationality: e.target.value })}
                  aria-invalid={fieldError ? true : undefined}
                />
              </div>
            )}

            {activeField === 'occupation' && (
              <div>
                <Label htmlFor="modal-occupation">Occupation (optional)</Label>
                <Input
                  id="modal-occupation"
                  data-autofocus
                  placeholder="e.g. Software Engineer"
                  value={draft.occupation}
                  onChange={(e) => setDraft({ ...draft, occupation: e.target.value })}
                />
              </div>
            )}

            {activeField === 'contact_number' && (
              <div>
                <Label htmlFor="modal-contact-number">Phone number</Label>
                <Input
                  id="modal-contact-number"
                  data-autofocus
                  type="tel"
                  placeholder="09XXXXXXXXX"
                  value={draft.contact_number}
                  onChange={(e) => setDraft({ ...draft, contact_number: e.target.value })}
                  aria-invalid={fieldError ? true : undefined}
                />
              </div>
            )}

            {activeField === 'preferred_contact_mode' && (
              <div>
                <Label htmlFor="modal-contact-mode">Preferred contact mode</Label>
                <Select
                  id="modal-contact-mode"
                  data-autofocus
                  value={draft.preferred_contact_mode}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      preferred_contact_mode: e.target.value as PreferredContactMode,
                    })
                  }
                >
                  <option value="phone">Phone</option>
                  <option value="email">Email</option>
                  <option value="messenger">Messenger</option>
                  <option value="instagram">Instagram</option>
                </Select>
              </div>
            )}

            {activeField === 'social_media' && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="modal-socmed-platform">Platform (optional)</Label>
                  <Select
                    id="modal-socmed-platform"
                    data-autofocus
                    value={draft.socmed_platform}
                    onChange={(e) =>
                      setDraft({ ...draft, socmed_platform: e.target.value })
                    }
                    aria-invalid={fieldError ? true : undefined}
                  >
                    {SOCMED_PLATFORM_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="modal-socmed-username">Username / Handle (optional)</Label>
                  <Input
                    id="modal-socmed-username"
                    placeholder="@handle"
                    value={draft.socmed_username}
                    onChange={(e) =>
                      setDraft({ ...draft, socmed_username: e.target.value })
                    }
                  />
                </div>
              </div>
            )}

            {activeField === 'permanent_address' && (
              <div>
                <Label htmlFor="modal-permanent-address">Permanent address</Label>
                <Textarea
                  id="modal-permanent-address"
                  data-autofocus
                  rows={3}
                  value={draft.permanent_address}
                  onChange={(e) =>
                    setDraft({ ...draft, permanent_address: e.target.value })
                  }
                  aria-invalid={fieldError ? true : undefined}
                />
              </div>
            )}

            {activeField === 'present_address' && (
              <div className="space-y-3">
                <label className="inline-flex items-center gap-2 text-sm text-pine cursor-pointer">
                  <Checkbox
                    checked={sameAsPermanent}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSameAsPermanent(checked);
                      if (checked) {
                        setDraft({ ...draft, present_address: draft.permanent_address });
                      }
                    }}
                  />
                  <span>Same as permanent address</span>
                </label>
                <div>
                  <Label htmlFor="modal-present-address">Present address</Label>
                  <Textarea
                    id="modal-present-address"
                    data-autofocus
                    rows={3}
                    disabled={sameAsPermanent}
                    value={sameAsPermanent ? draft.permanent_address : draft.present_address}
                    onChange={(e) =>
                      setDraft({ ...draft, present_address: e.target.value })
                    }
                    aria-invalid={fieldError ? true : undefined}
                  />
                </div>
              </div>
            )}

            {activeField === 'emergency_contact_name' && (
              <div>
                <Label htmlFor="modal-ec-name">Emergency contact name</Label>
                <Input
                  id="modal-ec-name"
                  data-autofocus
                  value={draft.emergency_contact_name}
                  onChange={(e) =>
                    setDraft({ ...draft, emergency_contact_name: e.target.value })
                  }
                  aria-invalid={fieldError ? true : undefined}
                />
              </div>
            )}

            {activeField === 'emergency_contact_relation' && (
              <div>
                <Label htmlFor="modal-ec-relation">Relation</Label>
                <Input
                  id="modal-ec-relation"
                  data-autofocus
                  placeholder="e.g. Mother"
                  value={draft.emergency_contact_relation}
                  onChange={(e) =>
                    setDraft({ ...draft, emergency_contact_relation: e.target.value })
                  }
                  aria-invalid={fieldError ? true : undefined}
                />
              </div>
            )}

            {activeField === 'emergency_contact_number' && (
              <div>
                <Label htmlFor="modal-ec-number">Emergency contact number</Label>
                <Input
                  id="modal-ec-number"
                  data-autofocus
                  type="tel"
                  placeholder="09XXXXXXXXX"
                  value={draft.emergency_contact_number}
                  onChange={(e) =>
                    setDraft({ ...draft, emergency_contact_number: e.target.value })
                  }
                  aria-invalid={fieldError ? true : undefined}
                />
              </div>
            )}

            {fieldError && (
              <p role="alert" className="text-xs text-red-700">
                {fieldError}
              </p>
            )}
          </form>
        )}
      </Modal>
    </div>
  );
}

export default function ProfileEditPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-3xl mx-auto space-y-6">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-72" />
        </div>
      }
    >
      <ProfileEditContent />
    </Suspense>
  );
}
