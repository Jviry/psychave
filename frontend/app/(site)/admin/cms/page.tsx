'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../../lib/api';
import {
  cmsOverviewSchema,
  CmsOverviewFormValues,
  serviceGuardrailSchema,
  ServiceGuardrailFormValues,
} from '../../../../lib/schemas';
import { useAppStore } from '../../../../stores/useAppStore';
import {
  Button,
  Card,
  Input,
  Label,
  Textarea,
} from '../../../../components/ui/primitives';

export default function AdminCmsPage() {
  const queryClient = useQueryClient();
  const { publishFlowEvent } = useAppStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'services' | 'structures'>('overview');
  const [editingServiceId, setEditingServiceId] = useState<string>('srv-consultation');

  const { data: cms } = useQuery({
    queryKey: ['cms'],
    queryFn: () => api.getCmsContent(),
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.getServices(),
  });

  const { data: roster = [] } = useQuery({
    queryKey: ['roster', 'admin'],
    queryFn: () => api.getRoster(true),
  });

  const overviewForm = useForm<CmsOverviewFormValues>({
    resolver: zodResolver(cmsOverviewSchema),
    defaultValues: {
      vision: cms?.vision || '',
      mission: cms?.mission || '',
      clinicOverview: cms?.clinicOverview || '',
      impactNarrative: cms?.impactNarrative || '',
      consentFlagBanner: cms?.testimonialsConfig.consentFlagBanner || '',
    },
  });

  useEffect(() => {
    if (cms) {
      overviewForm.reset({
        vision: cms.vision,
        mission: cms.mission,
        clinicOverview: cms.clinicOverview,
        impactNarrative: cms.impactNarrative,
        consentFlagBanner: cms.testimonialsConfig.consentFlagBanner,
      });
    }
  }, [cms, overviewForm]);

  const currentService =
    services.find((s) => s.id === editingServiceId) || services[0];

  const serviceForm = useForm<ServiceGuardrailFormValues>({
    resolver: zodResolver(serviceGuardrailSchema),
    defaultValues: {
      durationLabel: '',
      guardrailTitle: '',
      guardrailNotice: '',
      description: '',
    },
  });

  useEffect(() => {
    if (currentService) {
      serviceForm.reset({
        durationLabel: currentService.durationLabel,
        guardrailTitle: currentService.guardrailTitle,
        guardrailNotice: currentService.guardrailNotice,
        description: currentService.description,
      });
    }
  }, [currentService, serviceForm]);

  const saveCmsMutation = useMutation({
    mutationFn: (values: CmsOverviewFormValues) => {
      if (!cms) throw new Error('CMS not loaded');
      return api.updateCmsContent({
        vision: values.vision,
        mission: values.mission,
        clinicOverview: values.clinicOverview,
        impactNarrative: values.impactNarrative,
        testimonialsConfig: {
          ...cms.testimonialsConfig,
          consentFlagBanner: values.consentFlagBanner,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms'] });
      publishFlowEvent(
        'Payload CMS Blocks Updated',
        'Vision, Mission, Clinic Overview, and Consent-Flag Testimonials banner synced to public pages.'
      );
    },
  });

  const saveServiceMutation = useMutation({
    mutationFn: (values: ServiceGuardrailFormValues) =>
      api.updateServiceGuardrail(editingServiceId, {
        durationLabel: values.durationLabel,
        guardrailTitle: values.guardrailTitle,
        guardrailNotice: values.guardrailNotice,
        description: values.description,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      publishFlowEvent(
        'Service Guardrail Updated',
        `Updated duration and scope guardrail for ${currentService?.title}.`
      );
    },
  });

  return (
    <div className="space-y-10">
      <header className="space-y-2 border-b border-mist pb-6">
        <div className="flex items-center gap-2 text-xs text-accent-ink font-semibold">
          <span>Admin Role Dashboard</span>
          <span aria-hidden="true">·</span>
          <span>Payload CMS Content &amp; Guardrail Editors</span>
        </div>
        <h1 className="font-heading text-4xl font-medium text-pine">
          CMS Editors: Services, Roster Structure, Testimonials &amp; Vision/Mission
        </h1>
        <p className="text-sm text-pine/80 max-w-3xl">
          Manage public institutional copy, service duration guardrails, anonymized resident roster
          structure, and consent-flagged testimonial cards. No private session notes are accessible.
        </p>
      </header>

      {/* Segmented CMS Section Switcher */}
      <div
        role="group"
        aria-label="Payload CMS Editor Sections"
        className="flex flex-wrap items-center gap-1 p-1 bg-surface-sunken rounded-lg border border-mist w-fit"
      >
        {[
          {
            id: 'overview',
            label: '1. Vision, Mission & Clinic Overview',
          },
          {
            id: 'services',
            label: '2. Services & Guardrails (7 Canonical)',
          },
          {
            id: 'structures',
            label: '3. Roster & Testimonials Structure',
          },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-surface-raised text-pine font-semibold shadow-xs'
                : 'text-pine/70 hover:text-pine'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Vision, Mission, Clinic Overview & Consent Banner */}
      {activeTab === 'overview' && (
        <Card className="space-y-6">
          <div className="border-b border-mist pb-3">
            <h2 className="font-heading text-2xl font-medium text-pine">
              Vision, Mission, Clinic Overview &amp; Consent-Flag Governance
            </h2>
            <p className="text-xs text-pine/70">
              Changes made here update the <code>/about</code> and <code>/</code> public pages immediately.
            </p>
          </div>

          <form
            onSubmit={overviewForm.handleSubmit((vals) => saveCmsMutation.mutate(vals))}
            className="space-y-5"
          >
            {cms &&
              (!cms.vision || !cms.mission || !cms.clinicOverview || !cms.impactNarrative) && (
                <div className="p-4 rounded-lg bg-parchment border border-dashed border-mint/50 text-xs text-pine/70">
                  Some CMS blocks are empty — public pages show awaiting-copy notes until copy is
                  published here. Minimum lengths apply per block.
                </div>
              )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <Label htmlFor="cms-vision">Vision Statement</Label>
                <Textarea id="cms-vision" rows={4} {...overviewForm.register('vision')} />
                {overviewForm.formState.errors.vision && (
                  <p className="text-xs text-red-700 mt-1">
                    {overviewForm.formState.errors.vision.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="cms-mission">Mission Statement</Label>
                <Textarea id="cms-mission" rows={4} {...overviewForm.register('mission')} />
                {overviewForm.formState.errors.mission && (
                  <p className="text-xs text-red-700 mt-1">
                    {overviewForm.formState.errors.mission.message}
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="cms-overview">Clinic Overview</Label>
              <Textarea
                id="cms-overview"
                rows={3}
                {...overviewForm.register('clinicOverview')}
              />
              {overviewForm.formState.errors.clinicOverview && (
                <p className="text-xs text-red-700 mt-1">
                  {overviewForm.formState.errors.clinicOverview.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="cms-impact">Impact Narrative</Label>
              <Textarea
                id="cms-impact"
                rows={2}
                {...overviewForm.register('impactNarrative')}
              />
            </div>

            <div>
              <Label htmlFor="cms-consent">
                Testimonials Consent-Flag Governance Note (No Personal Quotes Policy)
              </Label>
              <Textarea
                id="cms-consent"
                rows={2}
                {...overviewForm.register('consentFlagBanner')}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={saveCmsMutation.isPending}
            >
              {saveCmsMutation.isPending ? 'Publishing CMS Changes...' : 'Save & Publish CMS Blocks'}
            </Button>
          </form>
        </Card>
      )}

      {/* Tab 2: Services & Clinical Guardrails Editor */}
      {activeTab === 'services' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <Card className="lg:col-span-5 space-y-3">
            <h2 className="font-heading text-2xl font-medium text-pine border-b border-mist pb-2">
              Select Canonical Service
            </h2>
            <div className="space-y-2">
              {services.map((srv) => (
                <button
                  key={srv.id}
                  type="button"
                  onClick={() => setEditingServiceId(srv.id)}
                  className={`w-full text-left p-3.5 rounded-xl border text-xs transition-colors cursor-pointer ${
                    editingServiceId === srv.id
                      ? 'border-sage bg-surface-sunken'
                      : 'border-mist bg-surface-raised hover:border-mint hover:bg-surface-sunken/40'
                  }`}
                >
                  <div className="flex justify-between font-mono text-accent-ink font-semibold">
                    <span>{srv.indexNumber}</span>
                    <span>{srv.durationLabel}</span>
                  </div>
                  <p className="font-heading text-lg font-medium text-pine mt-0.5">
                    {srv.title}
                  </p>
                  <p className="text-pine/70 truncate">{srv.guardrailTitle}</p>
                </button>
              ))}
            </div>
          </Card>

          <Card className="lg:col-span-7 space-y-5">
            <div className="border-b border-mist pb-3">
              <p className="text-xs font-semibold text-accent-ink">
                Editing Service Specification
              </p>
              <h2 className="font-heading text-2xl font-medium text-pine">
                {currentService?.title}
              </h2>
            </div>

            <form
              onSubmit={serviceForm.handleSubmit((vals) => saveServiceMutation.mutate(vals))}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="srv-dur">Standard Duration Label</Label>
                <Input
                  id="srv-dur"
                  {...serviceForm.register('durationLabel')}
                />
                {serviceForm.formState.errors.durationLabel && (
                  <p className="text-xs text-red-700 mt-1">
                    {serviceForm.formState.errors.durationLabel.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="srv-gt">Guardrail Headline</Label>
                <Input
                  id="srv-gt"
                  {...serviceForm.register('guardrailTitle')}
                />
                {serviceForm.formState.errors.guardrailTitle && (
                  <p className="text-xs text-red-700 mt-1">
                    {serviceForm.formState.errors.guardrailTitle.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="srv-gn">Mandatory Scope Guardrail Notice</Label>
                <Textarea
                  id="srv-gn"
                  rows={3}
                  {...serviceForm.register('guardrailNotice')}
                />
                {serviceForm.formState.errors.guardrailNotice && (
                  <p className="text-xs text-red-700 mt-1">
                    {serviceForm.formState.errors.guardrailNotice.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="srv-desc">Public Service Description</Label>
                <Textarea
                  id="srv-desc"
                  rows={3}
                  {...serviceForm.register('description')}
                />
                {serviceForm.formState.errors.description && (
                  <p className="text-xs text-red-700 mt-1">
                    {serviceForm.formState.errors.description.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                disabled={saveServiceMutation.isPending}
              >
                {saveServiceMutation.isPending
                  ? 'Saving Service Guardrail...'
                  : 'Update Service & Guardrail'}
              </Button>
            </form>
          </Card>
        </div>
      )}

      {/* Tab 3: Anonymized Roster Structure & Testimonials Consent Structure */}
      {activeTab === 'structures' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="space-y-4">
            <div className="border-b border-mist pb-3">
              <h2 className="font-heading text-2xl font-medium text-pine">
                Resident Roster Structure (Anonymized Policy)
              </h2>
              <p className="text-xs text-pine/70">
                Strictly excludes personal names and photos. Public cards show PRC credential code
                and clinical specialization only.
              </p>
            </div>

            <div className="divide-y divide-mist/60 text-xs">
              {roster.map((r) => (
                <div
                  key={r.id}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-heading text-base font-medium text-pine">{r.anonymizedTitle}</p>
                    <p className="text-pine/75">{r.specialization}</p>
                  </div>
                  <span className="font-mono text-xs text-accent-ink font-semibold shrink-0">
                    {r.visibleOnPublicRoster ? 'Public' : 'Hidden'}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="space-y-4">
            <div className="border-b border-mist pb-3">
              <h2 className="font-heading text-2xl font-medium text-pine">
                Testimonials Structure (Consent Governance)
              </h2>
              <p className="text-xs text-pine/70">
                Enforces zero personal quotes across all public pages.
              </p>
            </div>

            {cms && cms.testimonialsConfig.emptyCards.length === 0 ? (
              <p className="text-xs text-pine/70 leading-relaxed">
                No testimonial slot structures seeded. Public pages render the consent governance
                banner only; the emptyCards contract field stays reserved for structured slots when
                the backend CMS lands.
              </p>
            ) : (
              <div className="divide-y divide-mist/60 text-xs">
                {cms?.testimonialsConfig.emptyCards.map((card) => (
                  <div
                    key={card.id}
                    className="py-3 space-y-1"
                  >
                    <div className="flex justify-between font-mono text-accent-ink">
                      <span>{card.slotCode}</span>
                      <span>Quote: Intentionally Empty</span>
                    </div>
                    <p className="font-semibold text-pine">{card.serviceCategory}</p>
                    <p className="text-pine/75">{card.governanceNote}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
