'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import {
  testimonialCmsSchema,
  TestimonialCmsFormValues,
} from '@/lib/schemas';
import type { TestimonialItem } from '@/lib/types';
import { useAppStore } from '@/stores/useAppStore';
import {
  Button,
  Checkbox,
  Input,
  Label,
  Skeleton,
  Textarea,
} from '@/components/ui/primitives';

interface TestimonialsTabProps {
  testimonials: TestimonialItem[];
  isLoading?: boolean;
  isError?: boolean;
}

export function TestimonialsTab({
  testimonials,
  isLoading = false,
  isError = false,
}: TestimonialsTabProps) {
  const queryClient = useQueryClient();
  const { publishFlowEvent } = useAppStore();

  const [isCreatingTestimonial, setIsCreatingTestimonial] = useState(false);
  const [editingTestimonialId, setEditingTestimonialId] = useState<string>('');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null
  );
  const [testimonialStatusMsg, setTestimonialStatusMsg] = useState<
    string | null
  >(null);

  const currentTestimonial: TestimonialItem | null = useMemo(() => {
    if (isCreatingTestimonial) return null;
    return (
      testimonials.find((t) => t.id === editingTestimonialId) ||
      testimonials[0] ||
      null
    );
  }, [testimonials, editingTestimonialId, isCreatingTestimonial]);

  useEffect(() => {
    if (
      !isCreatingTestimonial &&
      !editingTestimonialId &&
      testimonials.length > 0
    ) {
      setEditingTestimonialId(testimonials[0].id);
    }
  }, [testimonials, editingTestimonialId, isCreatingTestimonial]);

  const testimonialForm = useForm<TestimonialCmsFormValues>({
    resolver: zodResolver(testimonialCmsSchema),
    defaultValues: {
      quote: '',
      authorLabel: '',
      serviceCategory: '',
      isActive: true,
    },
  });

  useEffect(() => {
    setConfirmingDeleteId(null);
    if (isCreatingTestimonial) {
      testimonialForm.reset({
        quote: '',
        authorLabel: '',
        serviceCategory: '',
        isActive: true,
      });
    } else if (currentTestimonial) {
      testimonialForm.reset({
        quote: currentTestimonial.quote,
        authorLabel: currentTestimonial.authorLabel,
        serviceCategory: currentTestimonial.serviceCategory,
        isActive: currentTestimonial.isActive,
      });
    }
  }, [currentTestimonial, isCreatingTestimonial, testimonialForm]);

  const saveTestimonialMutation = useMutation({
    mutationFn: (values: TestimonialCmsFormValues) => {
      if (isCreatingTestimonial || !currentTestimonial) {
        return api.createTestimonial({
          quote: values.quote,
          authorLabel: values.authorLabel,
          serviceCategory: values.serviceCategory,
          isActive: values.isActive,
          displayOrder: testimonials.length + 1,
        });
      }
      return api.updateTestimonial(currentTestimonial.id, {
        quote: values.quote,
        authorLabel: values.authorLabel,
        serviceCategory: values.serviceCategory,
        isActive: values.isActive,
      });
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['cms'] });
      setIsCreatingTestimonial(false);
      setEditingTestimonialId(saved.id);
      setTestimonialStatusMsg(`Saved testimonial by "${saved.authorLabel}".`);
      publishFlowEvent(
        'Testimonials Updated',
        `Saved testimonial for ${saved.serviceCategory}.`
      );
    },
  });

  const deleteTestimonialMutation = useMutation({
    mutationFn: (id: string) => api.deleteTestimonial(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms'] });
      setEditingTestimonialId('');
      setConfirmingDeleteId(null);
      setTestimonialStatusMsg('Deleted testimonial.');
    },
  });

  if (isLoading) {
    return (
      <div
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
        aria-busy="true"
        aria-label="Loading testimonials"
      >
        <Skeleton className="lg:col-span-5 h-72 rounded-2xl" />
        <Skeleton className="lg:col-span-7 h-80 rounded-2xl" />
      </div>
    );
  }

  const mutationError =
    saveTestimonialMutation.error || deleteTestimonialMutation.error;

  return (
    <div className="space-y-4">
      {isError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-900"
        >
          Could not load testimonials from the server. Try refreshing the page.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Flat Testimonials List */}
        <section
          aria-label="Testimonials list"
          className="lg:col-span-5 rounded-2xl border border-mist bg-surface-raised overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-mist">
            <h2 className="text-sm font-semibold text-pine">
              Testimonials ({testimonials.length})
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setTestimonialStatusMsg(null);
                setIsCreatingTestimonial(true);
              }}
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              New
            </Button>
          </div>

          {testimonials.length === 0 ? (
            <p className="text-xs text-pine/70 py-8 px-4 text-center">
              No testimonials yet. Add a consent-verified reflection to publish
              on the homepage.
            </p>
          ) : (
            <ul className="divide-y divide-mist">
              {testimonials.map((item) => {
                const isSelected =
                  !isCreatingTestimonial && currentTestimonial?.id === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setTestimonialStatusMsg(null);
                        setIsCreatingTestimonial(false);
                        setEditingTestimonialId(item.id);
                      }}
                      className={`w-full text-left px-4 py-3.5 text-xs transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sage ${
                        isSelected
                          ? 'bg-surface-sunken'
                          : 'hover:bg-surface-sunken/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-pine">
                          {item.authorLabel}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 text-[11px] font-medium shrink-0 ${
                            item.isActive ? 'text-accent-ink' : 'text-pine/65'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              item.isActive ? 'bg-sage' : 'bg-mist'
                            }`}
                            aria-hidden="true"
                          />
                          {item.isActive ? 'Published' : 'Hidden'}
                        </span>
                      </div>
                      <p className="text-pine/80 mt-1 line-clamp-2 leading-relaxed">
                        &ldquo;{item.quote}&rdquo;
                      </p>
                      <p className="text-pine/65 mt-1">{item.serviceCategory}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Right: Testimonial Form */}
        <section className="lg:col-span-7 rounded-2xl border border-mist bg-surface-raised p-5 space-y-5">
          <div className="border-b border-mist pb-3 flex items-center justify-between gap-4">
            <h2 className="font-heading text-xl font-medium text-pine">
              {isCreatingTestimonial || testimonials.length === 0
                ? 'New Testimonial'
                : currentTestimonial?.authorLabel || 'Select a testimonial'}
            </h2>
            {isCreatingTestimonial && testimonials.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsCreatingTestimonial(false)}
              >
                Cancel
              </Button>
            )}
          </div>

          {testimonialStatusMsg && (
            <div
              role="status"
              className="rounded-lg border border-sage/40 bg-surface-sunken px-3.5 py-2.5 text-xs text-pine font-medium"
            >
              {testimonialStatusMsg}
            </div>
          )}

          {mutationError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-900"
            >
              {mutationError instanceof Error
                ? mutationError.message
                : 'Could not update testimonial.'}
            </div>
          )}

          <form
            onSubmit={testimonialForm.handleSubmit((vals) => {
              setTestimonialStatusMsg(null);
              saveTestimonialMutation.mutate(vals);
            })}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="t-quote">Reflection Quote</Label>
              <Textarea
                id="t-quote"
                rows={4}
                placeholder="Share an anonymized, consent-verified client reflection…"
                aria-invalid={Boolean(testimonialForm.formState.errors.quote)}
                {...testimonialForm.register('quote')}
              />
              {testimonialForm.formState.errors.quote && (
                <p className="text-xs text-red-700 mt-1">
                  {testimonialForm.formState.errors.quote.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="t-author">Attribution Label</Label>
                <Input
                  id="t-author"
                  placeholder="e.g. Client · Individual Counseling"
                  aria-invalid={Boolean(
                    testimonialForm.formState.errors.authorLabel
                  )}
                  {...testimonialForm.register('authorLabel')}
                />
                {testimonialForm.formState.errors.authorLabel && (
                  <p className="text-xs text-red-700 mt-1">
                    {testimonialForm.formState.errors.authorLabel.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="t-category">Service Category</Label>
                <Input
                  id="t-category"
                  placeholder="e.g. Couples Counseling"
                  aria-invalid={Boolean(
                    testimonialForm.formState.errors.serviceCategory
                  )}
                  {...testimonialForm.register('serviceCategory')}
                />
                {testimonialForm.formState.errors.serviceCategory && (
                  <p className="text-xs text-red-700 mt-1">
                    {testimonialForm.formState.errors.serviceCategory.message}
                  </p>
                )}
              </div>
            </div>

            <label className="flex items-center gap-2.5 pt-1 text-sm font-medium text-pine cursor-pointer">
              <Checkbox {...testimonialForm.register('isActive')} />
              <span>Published on homepage</span>
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <Button
                type="submit"
                variant="primary"
                disabled={saveTestimonialMutation.isPending}
              >
                {saveTestimonialMutation.isPending
                  ? 'Saving…'
                  : isCreatingTestimonial || testimonials.length === 0
                    ? 'Add Testimonial'
                    : 'Save Testimonial'}
              </Button>

              {!isCreatingTestimonial && currentTestimonial && (
                <div className="flex items-center gap-2">
                  {confirmingDeleteId === currentTestimonial.id ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmingDeleteId(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        disabled={deleteTestimonialMutation.isPending}
                        onClick={() =>
                          deleteTestimonialMutation.mutate(
                            currentTestimonial.id
                          )
                        }
                      >
                        {deleteTestimonialMutation.isPending
                          ? 'Deleting…'
                          : 'Confirm delete'}
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setConfirmingDeleteId(currentTestimonial.id)
                      }
                    >
                      <Trash2
                        className="w-3.5 h-3.5 text-red-700"
                        aria-hidden="true"
                      />
                      Delete
                    </Button>
                  )}
                </div>
              )}
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
