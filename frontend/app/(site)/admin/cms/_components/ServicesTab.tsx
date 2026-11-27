'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { serviceCmsSchema, ServiceCmsFormValues } from '@/lib/schemas';
import type { ServiceItem } from '@/lib/types';
import { useAppStore } from '@/stores/useAppStore';
import {
  Button,
  Checkbox,
  Input,
  Label,
  Skeleton,
  Textarea,
} from '@/components/ui/primitives';

const SERVICES_PAGE_SIZE = 6;

function formatDurationPreview(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '—';
  if (minutes < 60) return `${minutes} mins`;
  if (minutes === 60) return '1 hr';
  if (minutes === 90) return '1.5 hr';
  if (minutes % 60 === 0) return `${minutes / 60} hrs`;
  return `${Math.floor(minutes / 60)} hr ${minutes % 60} mins`;
}

interface ServicesTabProps {
  services: ServiceItem[];
  isLoading?: boolean;
  isError?: boolean;
}

export function ServicesTab({
  services,
  isLoading = false,
  isError = false,
}: ServicesTabProps) {
  const queryClient = useQueryClient();
  const { publishFlowEvent } = useAppStore();

  const [isCreatingService, setIsCreatingService] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string>('');
  const [serviceStatusMsg, setServiceStatusMsg] = useState<string | null>(null);
  const [servicesPage, setServicesPage] = useState(1);

  const totalServicePages = Math.max(
    1,
    Math.ceil(services.length / SERVICES_PAGE_SIZE)
  );
  const safeServicesPage = Math.min(servicesPage, totalServicePages);
  const paginatedServices = useMemo(() => {
    const start = (safeServicesPage - 1) * SERVICES_PAGE_SIZE;
    return services.slice(start, start + SERVICES_PAGE_SIZE);
  }, [services, safeServicesPage]);

  const firstServiceRow =
    services.length === 0 ? 0 : (safeServicesPage - 1) * SERVICES_PAGE_SIZE + 1;
  const lastServiceRow = Math.min(
    safeServicesPage * SERVICES_PAGE_SIZE,
    services.length
  );

  useEffect(() => {
    if (servicesPage > totalServicePages) {
      setServicesPage(totalServicePages);
    }
  }, [servicesPage, totalServicePages]);

  const currentService = useMemo(() => {
    if (isCreatingService) return null;
    return services.find((s) => s.id === editingServiceId) || services[0] || null;
  }, [services, editingServiceId, isCreatingService]);

  useEffect(() => {
    if (!isCreatingService && !editingServiceId && services.length > 0) {
      setEditingServiceId(services[0].id);
    }
  }, [services, editingServiceId, isCreatingService]);

  const serviceForm = useForm<ServiceCmsFormValues>({
    resolver: zodResolver(serviceCmsSchema),
    defaultValues: {
      title: '',
      durationMinutes: 60,
      rateLabel: '',
      notice: '',
      description: '',
      isActive: true,
    },
  });

  useEffect(() => {
    if (isCreatingService) {
      serviceForm.reset({
        title: '',
        durationMinutes: 60,
        rateLabel: '',
        notice: '',
        description: '',
        isActive: true,
      });
    } else if (currentService) {
      serviceForm.reset({
        title: currentService.title,
        durationMinutes: currentService.durationMinutes || 60,
        rateLabel: currentService.rateLabel || '',
        notice: currentService.guardrailNotice || '',
        description: currentService.description || '',
        isActive: currentService.isActive ?? true,
      });
    }
  }, [currentService, isCreatingService, serviceForm]);

  const saveServiceMutation = useMutation({
    mutationFn: (values: ServiceCmsFormValues) => {
      if (isCreatingService || !currentService) {
        return api.createService({
          title: values.title,
          description: values.description,
          durationMinutes: values.durationMinutes,
          rateLabel: values.rateLabel || null,
          guardrailNotice: values.notice || null,
          isActive: values.isActive,
        });
      }
      return api.updateService(currentService.id, {
        title: values.title,
        description: values.description,
        durationMinutes: values.durationMinutes,
        rateLabel: values.rateLabel || null,
        guardrailNotice: values.notice || null,
        isActive: values.isActive,
      });
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['services', 'admin'] });
      setIsCreatingService(false);
      setEditingServiceId(saved.id);
      setServiceStatusMsg(
        `Saved "${saved.title}" (${saved.isActive ? 'Active' : 'Inactive'}).`
      );
      publishFlowEvent(
        'Services Catalog Updated',
        `Saved service "${saved.title}" (${saved.durationLabel}).`
      );
    },
  });

  const watchedDuration = serviceForm.watch('durationMinutes');

  if (isLoading) {
    return (
      <div
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
        aria-busy="true"
        aria-label="Loading services"
      >
        <Skeleton className="lg:col-span-5 h-80 rounded-2xl" />
        <Skeleton className="lg:col-span-7 h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-900"
        >
          Could not load services from the server. Try refreshing the page.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Flat Services List */}
        <section
          aria-label="Services list"
          className="lg:col-span-5 rounded-2xl border border-mist bg-surface-raised overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-mist">
            <h2 className="text-sm font-semibold text-pine">
              Services ({services.length})
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setServiceStatusMsg(null);
                setIsCreatingService(true);
              }}
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              New service
            </Button>
          </div>

          {services.length === 0 ? (
            <p className="text-xs text-pine/70 py-8 px-4 text-center">
              No services yet. Click <strong>New service</strong> to add your
              first offering.
            </p>
          ) : (
            <ul className="divide-y divide-mist">
              {paginatedServices.map((srv) => {
                const isSelected =
                  !isCreatingService && currentService?.id === srv.id;
                const active = srv.isActive !== false;
                return (
                  <li key={srv.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setServiceStatusMsg(null);
                        setIsCreatingService(false);
                        setEditingServiceId(srv.id);
                      }}
                      className={`w-full text-left px-4 py-3.5 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sage ${
                        isSelected
                          ? 'bg-surface-sunken'
                          : 'hover:bg-surface-sunken/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={`text-sm truncate ${
                            isSelected
                              ? 'font-semibold text-pine'
                              : 'font-medium text-pine'
                          }`}
                        >
                          {srv.title}
                        </p>
                        <span
                          className={`inline-flex items-center gap-1.5 text-[11px] font-medium shrink-0 ${
                            active ? 'text-accent-ink' : 'text-pine/65'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              active ? 'bg-sage' : 'bg-mist'
                            }`}
                            aria-hidden="true"
                          />
                          {active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-xs text-pine/70 mt-0.5">
                        {srv.durationLabel}
                        {srv.rateLabel ? ` · ${srv.rateLabel}` : ''}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {services.length > SERVICES_PAGE_SIZE && (
            <div className="flex items-center justify-between gap-2 border-t border-mist px-4 py-3 text-xs">
              <span className="text-pine/70 tabular-nums">
                {firstServiceRow}–{lastServiceRow} of {services.length}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={safeServicesPage <= 1}
                  onClick={() =>
                    setServicesPage((current) => Math.max(1, current - 1))
                  }
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={safeServicesPage >= totalServicePages}
                  onClick={() =>
                    setServicesPage((current) =>
                      Math.min(totalServicePages, current + 1)
                    )
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Right: Service Form */}
        <section className="lg:col-span-7 rounded-2xl border border-mist bg-surface-raised p-5 space-y-5">
          <div className="border-b border-mist pb-3 flex items-center justify-between gap-4">
            <h2 className="font-heading text-xl font-medium text-pine">
              {isCreatingService || services.length === 0
                ? 'New Service'
                : currentService?.title || 'Select a service'}
            </h2>
            {isCreatingService && services.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsCreatingService(false)}
              >
                Cancel
              </Button>
            )}
          </div>

          {serviceStatusMsg && (
            <div
              role="status"
              className="rounded-lg border border-sage/40 bg-surface-sunken px-3.5 py-2.5 text-xs text-pine font-medium"
            >
              {serviceStatusMsg}
            </div>
          )}

          {saveServiceMutation.isError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-900"
            >
              {saveServiceMutation.error instanceof Error
                ? saveServiceMutation.error.message
                : 'Failed to save service.'}
            </div>
          )}

          <form
            onSubmit={serviceForm.handleSubmit((vals) => {
              setServiceStatusMsg(null);
              saveServiceMutation.mutate(vals);
            })}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <Label htmlFor="srv-title">Service Name</Label>
                <Input
                  id="srv-title"
                  placeholder="e.g. Individual Counseling & Psychotherapy"
                  aria-invalid={Boolean(serviceForm.formState.errors.title)}
                  {...serviceForm.register('title')}
                />
                {serviceForm.formState.errors.title && (
                  <p className="text-xs text-red-700 mt-1">
                    {serviceForm.formState.errors.title.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="srv-dur">
                  Duration ·{' '}
                  <span className="text-accent-ink normal-case">
                    {formatDurationPreview(Number(watchedDuration))}
                  </span>
                </Label>
                <Input
                  id="srv-dur"
                  type="number"
                  min={15}
                  max={480}
                  step={15}
                  aria-invalid={Boolean(
                    serviceForm.formState.errors.durationMinutes
                  )}
                  {...serviceForm.register('durationMinutes', {
                    valueAsNumber: true,
                  })}
                />
                {serviceForm.formState.errors.durationMinutes && (
                  <p className="text-xs text-red-700 mt-1">
                    {serviceForm.formState.errors.durationMinutes.message}
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="srv-rate">Rate (Optional)</Label>
              <Input
                id="srv-rate"
                placeholder="e.g. ₱1,500 or ₱1,500 – ₱2,500"
                aria-invalid={Boolean(serviceForm.formState.errors.rateLabel)}
                {...serviceForm.register('rateLabel')}
              />
              {serviceForm.formState.errors.rateLabel && (
                <p className="text-xs text-red-700 mt-1">
                  {serviceForm.formState.errors.rateLabel.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="srv-desc">Description</Label>
              <Textarea
                id="srv-desc"
                rows={4}
                placeholder="Describe what the session covers and how clients prepare."
                aria-invalid={Boolean(serviceForm.formState.errors.description)}
                {...serviceForm.register('description')}
              />
              {serviceForm.formState.errors.description && (
                <p className="text-xs text-red-700 mt-1">
                  {serviceForm.formState.errors.description.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="srv-notice">Scope Notice (Optional)</Label>
              <Textarea
                id="srv-notice"
                rows={2}
                placeholder="e.g. Life coaching is not a substitute for therapy."
                aria-invalid={Boolean(serviceForm.formState.errors.notice)}
                {...serviceForm.register('notice')}
              />
              {serviceForm.formState.errors.notice && (
                <p className="text-xs text-red-700 mt-1">
                  {serviceForm.formState.errors.notice.message}
                </p>
              )}
            </div>

            <label className="flex items-start gap-3 pt-1 text-xs text-pine cursor-pointer">
              <Checkbox
                className="mt-0.5"
                {...serviceForm.register('isActive')}
              />
              <span>
                <span className="font-medium block text-sm">
                  Active in public directory &amp; booking
                </span>
                <span className="text-pine/70">
                  Uncheck to hide from new bookings while keeping past records.
                </span>
              </span>
            </label>

            <div className="pt-1">
              <Button
                type="submit"
                variant="primary"
                disabled={saveServiceMutation.isPending}
              >
                {saveServiceMutation.isPending
                  ? 'Saving…'
                  : isCreatingService || services.length === 0
                    ? 'Create Service'
                    : 'Save Changes'}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
