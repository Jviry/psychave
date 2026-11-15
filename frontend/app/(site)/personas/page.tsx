'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import {
  type PreferredContactMode,
  type RelationToAccountHolder,
  isValidPhone,
  normalizeName,
} from '@/lib/consent';
import { wizardStep3Schema } from '@/lib/schemas';
import type { Persona } from '@/lib/types';
import { useAppStore } from '@/stores/useAppStore';
import { usePersonaWizardStore } from '@/stores/usePersonaWizardStore';
import {
  Button,
  Card,
  Input,
  Label,
  Select,
  Skeleton,
} from '@/components/ui/primitives';

interface EditFormState {
  persona_name: string;
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

function toEditState(p: Persona): EditFormState {
  const relation = (p.relationshipToClient || (p.type === 'self' ? 'self' : 'child')) as RelationToAccountHolder;
  return {
    persona_name: p.label,
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

function PersonasContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const returnTo = searchParams.get('returnTo');
  const shouldOpenNew = searchParams.get('new') === '1';
  const newPersonaHref = returnTo === '/book' ? '/personas/new?returnTo=/book' : '/personas/new';

  const updateBookingDraft = useAppStore((s) => s.updateBookingDraft);
  const lastUsedPersonaId = usePersonaWizardStore((s) => s.lastUsedPersonaId);
  const setLastUsedPersonaId = usePersonaWizardStore((s) => s.setLastUsedPersonaId);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: personas = [], isLoading: personasLoading } = useQuery({
    queryKey: ['personas'],
    queryFn: () => api.getPersonas(),
  });

  useEffect(() => {
    if (shouldOpenNew) {
      router.replace(newPersonaHref);
    }
  }, [shouldOpenNew, newPersonaHref, router]);

  const updateMutation = useMutation({
    mutationFn: ({ id, form }: { id: string; form: EditFormState }) =>
      api.updatePersona(id, {
        relation_to_account_holder: form.relation_to_account_holder,
        persona_name: normalizeName(form.persona_name),
        date_of_birth: form.date_of_birth,
        occupation: form.occupation.trim() || null,
        nationality: form.nationality.trim(),
        permanent_address: form.permanent_address.trim(),
        present_address: form.present_address.trim(),
        contact_number: form.contact_number.trim(),
        socmed_platform: form.socmed_platform.trim() || null,
        socmed_username: form.socmed_username.trim() || null,
        preferred_contact_mode: form.preferred_contact_mode,
        emergency_contact_name: normalizeName(form.emergency_contact_name),
        emergency_contact_relation: form.emergency_contact_relation.trim(),
        emergency_contact_number: form.emergency_contact_number.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personas'] });
      setEditingId(null);
      setEditForm(null);
      setEditErrors({});
      setActionError(null);
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : 'Could not update persona.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deletePersona(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personas'] });
      setConfirmDeleteId(null);
      setActionError(null);
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : 'Could not delete persona.');
      setConfirmDeleteId(null);
    },
  });

  const handleBookWithPersona = (personaId: string) => {
    updateBookingDraft({ personaId });
    setLastUsedPersonaId(personaId);
    router.push('/book');
  };

  const startEditing = (persona: Persona) => {
    setActionError(null);
    setConfirmDeleteId(null);
    setEditErrors({});
    setEditingId(persona.id);
    setEditForm(toEditState(persona));
  };

  const handleSaveEdit = (e: React.FormEvent, personaId: string) => {
    e.preventDefault();
    if (!editForm) return;
    setActionError(null);

    const parsed = wizardStep3Schema.safeParse({
      ...editForm,
      sameAsPermanent: false,
    });
    const errs: Record<string, string> = {};
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        errs[String(issue.path[0])] = issue.message;
      });
    }
    const isOverseas = !['filipino', 'philippines', 'ph'].includes(
      editForm.nationality.trim().toLowerCase()
    );
    if (editForm.contact_number && !isValidPhone(editForm.contact_number, isOverseas)) {
      errs.contact_number = 'Enter a valid phone number.';
    }
    if (
      editForm.emergency_contact_number &&
      !isValidPhone(editForm.emergency_contact_number, isOverseas)
    ) {
      errs.emergency_contact_number = 'Enter a valid emergency contact number.';
    }

    if (Object.keys(errs).length > 0) {
      setEditErrors(errs);
      return;
    }

    setEditErrors({});
    updateMutation.mutate({ id: personaId, form: editForm });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <header className="space-y-4 border-b border-mist pb-6">
        {returnTo === '/book' && (
          <Link
            href="/book"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-ink hover:text-pine transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Back to booking
          </Link>
        )}

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <h1 className="font-heading text-4xl font-medium text-pine">Client Personas</h1>
            <p className="text-sm text-pine/75">
              Profiles with signed informed consent for yourself or a dependent.
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={() => router.push(newPersonaHref)}
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            New persona
          </Button>
        </div>
      </header>

      {actionError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {actionError}
        </div>
      )}

      {personasLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : personas.length === 0 ? (
        <Card className="p-6 sm:p-8 space-y-4">
          <div className="space-y-1.5">
            <h2 className="font-heading text-2xl font-medium text-pine">No personas yet</h2>
            <p className="text-sm text-pine/75 leading-relaxed">
              Create a persona with signed informed consent before booking a session.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => router.push(newPersonaHref)}
          >
            Create a persona
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {personas.map((persona) => {
            const isLastUsed = lastUsedPersonaId === persona.id;
            const isEditing = editingId === persona.id && editForm !== null;
            const isConfirmingDelete = confirmDeleteId === persona.id;

            return (
              <Card key={persona.id} className="p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-pine/70">
                      <span className="font-semibold text-accent-ink">
                        {persona.type === 'self' ? 'Self (Primary)' : 'Dependent'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{persona.ageGroup}</span>
                      {persona.type !== 'self' && persona.relationshipToClient && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="capitalize">{persona.relationshipToClient}</span>
                        </>
                      )}
                      {isLastUsed && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-accent-ink font-medium">Last used</span>
                        </>
                      )}
                    </div>
                    <p className="font-heading text-xl font-medium text-pine">{persona.label}</p>
                    {persona.contactNumber && (
                      <p className="text-xs text-pine/65 tabular-nums">
                        {persona.contactNumber}
                        {persona.preferredContactMode ? ` · Prefers ${persona.preferredContactMode}` : ''}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => (isEditing ? setEditingId(null) : startEditing(persona))}
                    >
                      <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                      {isEditing ? 'Close' : 'Edit'}
                    </Button>
                    {!isConfirmingDelete ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setActionError(null);
                          setEditingId(null);
                          setConfirmDeleteId(persona.id);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        Delete
                      </Button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={deleteMutation.isPending}
                          onClick={() => deleteMutation.mutate(persona.id)}
                        >
                          {deleteMutation.isPending ? 'Deleting…' : 'Confirm delete'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBookWithPersona(persona.id)}
                    >
                      Book a session
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>

                {isEditing && editForm && (
                  <form
                    onSubmit={(e) => handleSaveEdit(e, persona.id)}
                    className="border-t border-mist pt-4 space-y-4"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`edit-name-${persona.id}`}>Full name</Label>
                        <Input
                          id={`edit-name-${persona.id}`}
                          value={editForm.persona_name}
                          onChange={(e) =>
                            setEditForm({ ...editForm, persona_name: e.target.value })
                          }
                          aria-invalid={editErrors.persona_name ? true : undefined}
                        />
                        {editErrors.persona_name && (
                          <p className="text-xs text-red-700 mt-1">{editErrors.persona_name}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor={`edit-relation-${persona.id}`}>Relation to account</Label>
                        <Select
                          id={`edit-relation-${persona.id}`}
                          value={editForm.relation_to_account_holder}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              relation_to_account_holder: e.target.value as RelationToAccountHolder,
                            })
                          }
                        >
                          <option value="self">Self</option>
                          <option value="child">Child</option>
                          <option value="spouse">Spouse</option>
                          <option value="parent">Parent</option>
                          <option value="sibling">Sibling</option>
                          <option value="other">Other</option>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor={`edit-dob-${persona.id}`}>Date of birth</Label>
                        <Input
                          id={`edit-dob-${persona.id}`}
                          type="date"
                          value={editForm.date_of_birth}
                          onChange={(e) =>
                            setEditForm({ ...editForm, date_of_birth: e.target.value })
                          }
                          aria-invalid={editErrors.date_of_birth ? true : undefined}
                        />
                        {editErrors.date_of_birth && (
                          <p className="text-xs text-red-700 mt-1">{editErrors.date_of_birth}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor={`edit-nationality-${persona.id}`}>Nationality</Label>
                        <Input
                          id={`edit-nationality-${persona.id}`}
                          value={editForm.nationality}
                          onChange={(e) =>
                            setEditForm({ ...editForm, nationality: e.target.value })
                          }
                          aria-invalid={editErrors.nationality ? true : undefined}
                        />
                        {editErrors.nationality && (
                          <p className="text-xs text-red-700 mt-1">{editErrors.nationality}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor={`edit-occupation-${persona.id}`}>Occupation (optional)</Label>
                        <Input
                          id={`edit-occupation-${persona.id}`}
                          value={editForm.occupation}
                          onChange={(e) =>
                            setEditForm({ ...editForm, occupation: e.target.value })
                          }
                        />
                      </div>

                      <div>
                        <Label htmlFor={`edit-contact-${persona.id}`}>Contact number</Label>
                        <Input
                          id={`edit-contact-${persona.id}`}
                          value={editForm.contact_number}
                          onChange={(e) =>
                            setEditForm({ ...editForm, contact_number: e.target.value })
                          }
                          aria-invalid={editErrors.contact_number ? true : undefined}
                        />
                        {editErrors.contact_number && (
                          <p className="text-xs text-red-700 mt-1">{editErrors.contact_number}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor={`edit-mode-${persona.id}`}>Preferred contact mode</Label>
                        <Select
                          id={`edit-mode-${persona.id}`}
                          value={editForm.preferred_contact_mode}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
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

                      <div>
                        <Label htmlFor={`edit-socmed-${persona.id}`}>
                          Social media handle (optional)
                        </Label>
                        <Input
                          id={`edit-socmed-${persona.id}`}
                          placeholder="@handle"
                          value={editForm.socmed_username}
                          onChange={(e) =>
                            setEditForm({ ...editForm, socmed_username: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`edit-perm-${persona.id}`}>Permanent address</Label>
                        <Input
                          id={`edit-perm-${persona.id}`}
                          value={editForm.permanent_address}
                          onChange={(e) =>
                            setEditForm({ ...editForm, permanent_address: e.target.value })
                          }
                          aria-invalid={editErrors.permanent_address ? true : undefined}
                        />
                        {editErrors.permanent_address && (
                          <p className="text-xs text-red-700 mt-1">
                            {editErrors.permanent_address}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor={`edit-pres-${persona.id}`}>Present address</Label>
                        <Input
                          id={`edit-pres-${persona.id}`}
                          value={editForm.present_address}
                          onChange={(e) =>
                            setEditForm({ ...editForm, present_address: e.target.value })
                          }
                          aria-invalid={editErrors.present_address ? true : undefined}
                        />
                        {editErrors.present_address && (
                          <p className="text-xs text-red-700 mt-1">
                            {editErrors.present_address}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor={`edit-ec-name-${persona.id}`}>Emergency contact</Label>
                        <Input
                          id={`edit-ec-name-${persona.id}`}
                          value={editForm.emergency_contact_name}
                          onChange={(e) =>
                            setEditForm({ ...editForm, emergency_contact_name: e.target.value })
                          }
                          aria-invalid={editErrors.emergency_contact_name ? true : undefined}
                        />
                        {editErrors.emergency_contact_name && (
                          <p className="text-xs text-red-700 mt-1">
                            {editErrors.emergency_contact_name}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor={`edit-ec-rel-${persona.id}`}>Relation</Label>
                        <Input
                          id={`edit-ec-rel-${persona.id}`}
                          value={editForm.emergency_contact_relation}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              emergency_contact_relation: e.target.value,
                            })
                          }
                          aria-invalid={editErrors.emergency_contact_relation ? true : undefined}
                        />
                        {editErrors.emergency_contact_relation && (
                          <p className="text-xs text-red-700 mt-1">
                            {editErrors.emergency_contact_relation}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor={`edit-ec-num-${persona.id}`}>Emergency number</Label>
                        <Input
                          id={`edit-ec-num-${persona.id}`}
                          value={editForm.emergency_contact_number}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              emergency_contact_number: e.target.value,
                            })
                          }
                          aria-invalid={editErrors.emergency_contact_number ? true : undefined}
                        />
                        {editErrors.emergency_contact_number && (
                          <p className="text-xs text-red-700 mt-1">
                            {editErrors.emergency_contact_number}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingId(null);
                          setEditForm(null);
                          setEditErrors({});
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        disabled={updateMutation.isPending}
                      >
                        {updateMutation.isPending ? 'Saving…' : 'Save changes'}
                      </Button>
                    </div>
                  </form>
                )}
              </Card>
            );
          })}
        </div>
      )}

    </div>
  );
}

export default function PersonasPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-3xl mx-auto space-y-4">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-24" />
        </div>
      }
    >
      <PersonasContent />
    </Suspense>
  );
}
