'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  Lock,
  Plus,
  Trash2,
} from 'lucide-react';
import { api } from '@/lib/api';
import {
  DEFAULT_WIZARD_PAGES,
  didConsentBlocksChange,
} from '@/lib/consent';
import {
  cmsOverviewSchema,
  CmsOverviewFormValues,
  serviceCmsSchema,
  ServiceCmsFormValues,
} from '@/lib/schemas';
import type {
  WizardAppliesTo,
  WizardBlock,
  WizardBlockType,
  WizardFieldTarget,
  WizardPage,
} from '@/lib/types';
import { useAppStore } from '@/stores/useAppStore';
import {
  Button,
  Card,
  Checkbox,
  Input,
  Label,
  Select,
  Textarea,
} from '@/components/ui/primitives';

const BLOCK_TYPE_OPTIONS: { value: WizardBlockType; label: string }[] = [
  { value: 'text', label: 'Text Input' },
  { value: 'textarea', label: 'Multi-line Textarea' },
  { value: 'select', label: 'Dropdown Select' },
  { value: 'checkbox', label: 'Checkbox / Acknowledgement' },
  { value: 'date', label: 'Date Picker' },
  { value: 'phone', label: 'Phone Number' },
  { value: 'scrollable_doc', label: 'Scrollable Legal Document' },
  { value: 'info_text', label: 'Info Text / Notice Box' },
  { value: 'section_heading', label: 'Section Heading Divider' },
  { value: 'services_list', label: 'Active Services List (Read-only)' },
  { value: 'review_summary', label: 'Entries Review Summary' },
];

const INPUT_BLOCK_TYPES = new Set<WizardBlockType>([
  'text',
  'textarea',
  'select',
  'checkbox',
  'date',
  'phone',
]);

function formatDurationPreview(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '—';
  if (minutes < 60) return `${minutes} mins`;
  if (minutes === 60) return '1 hr (60 mins)';
  if (minutes === 90) return '1.5 hr (90 mins)';
  if (minutes % 60 === 0) return `${minutes / 60} hrs (${minutes} mins)`;
  return `${Math.floor(minutes / 60)} hr ${minutes % 60} mins`;
}

export default function AdminCmsPage() {
  const queryClient = useQueryClient();
  const { publishFlowEvent } = useAppStore();
  const [activeTab, setActiveTab] = useState<
    'services' | 'wizard' | 'overview' | 'structures'
  >('services');

  // ─── Services Catalog State ─────────────────────────────────────────────────
  const { data: services = [] } = useQuery({
    queryKey: ['services', 'admin'],
    queryFn: () => api.getAdminServices(),
  });

  const [isCreatingService, setIsCreatingService] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string>('');
  const [serviceStatusMsg, setServiceStatusMsg] = useState<string | null>(null);

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
        notice: '',
        description: '',
        isActive: true,
      });
    } else if (currentService) {
      serviceForm.reset({
        title: currentService.title,
        durationMinutes: currentService.durationMinutes || 60,
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
          guardrailNotice: values.notice || null,
          isActive: values.isActive,
        });
      }
      return api.updateService(currentService.id, {
        title: values.title,
        description: values.description,
        durationMinutes: values.durationMinutes,
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

  // ─── Multi-Page Wizard & Consent Builder State ──────────────────────────────
  const { data: activeTemplate } = useQuery({
    queryKey: ['consentForm', 'active'],
    queryFn: () => api.getActiveConsentForm(),
  });

  const { data: templateHistory = [] } = useQuery({
    queryKey: ['consentForm', 'templates'],
    queryFn: () => api.getConsentFormTemplates(),
  });

  const [wizardPages, setWizardPages] = useState<WizardPage[]>(
    () => JSON.parse(JSON.stringify(DEFAULT_WIZARD_PAGES)) as WizardPage[]
  );
  const [selectedPageIdx, setSelectedPageIdx] = useState(0);
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);
  const [bumpType, setBumpType] = useState<'auto' | 'minor' | 'major'>('auto');
  const [wizardStatusMsg, setWizardStatusMsg] = useState<string | null>(null);
  const [wizardErrorMsg, setWizardErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (activeTemplate?.wizardPages && activeTemplate.wizardPages.length > 0) {
      setWizardPages(
        JSON.parse(JSON.stringify(activeTemplate.wizardPages)) as WizardPage[]
      );
    }
  }, [activeTemplate]);

  const baselinePages = useMemo(
    () =>
      activeTemplate?.wizardPages && activeTemplate.wizardPages.length > 0
        ? activeTemplate.wizardPages
        : DEFAULT_WIZARD_PAGES,
    [activeTemplate]
  );

  const hasWizardChanges = useMemo(
    () => JSON.stringify( baselinePages) !== JSON.stringify(wizardPages),
    [baselinePages, wizardPages]
  );

  const consentBlocksModified = useMemo(
    () => didConsentBlocksChange(baselinePages, wizardPages),
    [baselinePages, wizardPages]
  );

  const willTriggerMajorBump =
    bumpType === 'major' || (bumpType === 'auto' && consentBlocksModified);

  const currentPage = wizardPages[selectedPageIdx] || wizardPages[0];

  const allAvailableFieldKeys = useMemo(() => {
    const keys: { key: string; label: string }[] = [];
    for (const p of wizardPages) {
      for (const b of p.blocks) {
        if (b.fieldKey) {
          keys.push({ key: b.fieldKey, label: `${b.label} (${b.fieldKey})` });
        }
      }
    }
    return keys;
  }, [wizardPages]);

  const updateCurrentPage = (updater: (page: WizardPage) => WizardPage) => {
    setWizardPages((prev) =>
      prev.map((page, idx) => (idx === selectedPageIdx ? updater(page) : page))
    );
  };

  const handleAddPage = () => {
    const nextNum = wizardPages.length + 1;
    const newPageId = `step-${nextNum}-${Date.now().toString(36).slice(-4)}`;
    const newBlockId = `custom_field_${Date.now().toString(36).slice(-4)}`;
    const newPage: WizardPage = {
      pageId: newPageId,
      title: `Step ${nextNum}: New Section`,
      description: 'Provide the details requested below.',
      blocks: [
        {
          blockId: newBlockId,
          type: 'text',
          label: 'New Question',
          placeholder: 'Enter response',
          target: 'custom',
          fieldKey: newBlockId,
          appliesTo: 'all',
          required: false,
          options: [],
          showIf: null,
          systemLocked: false,
        },
      ],
    };
    setWizardPages((prev) => [...prev, newPage]);
    setSelectedPageIdx(wizardPages.length);
    setExpandedBlockId(newBlockId);
  };

  const handleMovePage = (idx: number, direction: -1 | 1) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= wizardPages.length) return;
    setWizardPages((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(targetIdx, 0, item);
      return copy;
    });
    setSelectedPageIdx(targetIdx);
  };

  const handleDeletePage = (idx: number) => {
    if (wizardPages.length <= 1) return;
    const page = wizardPages[idx];
    if (page.blocks.some((b) => b.systemLocked)) return;
    setWizardPages((prev) => prev.filter((_, i) => i !== idx));
    setSelectedPageIdx((prev) => Math.max(0, Math.min(prev, wizardPages.length - 2)));
  };

  const handleAddBlock = (type: WizardBlockType) => {
    const suffix = Date.now().toString(36).slice(-4);
    const isInput = INPUT_BLOCK_TYPES.has(type);
    const blockId = `block_${type}_${suffix}`;
    const newBlock: WizardBlock = {
      blockId,
      type,
      label:
        type === 'scrollable_doc'
          ? 'New Policy or Consent Document'
          : type === 'section_heading'
            ? 'New Section Heading'
            : type === 'info_text'
              ? 'Informational Notice'
              : 'New Question',
      content:
        type === 'scrollable_doc' || type === 'info_text'
          ? 'Enter document or notice text here.'
          : null,
      helperText: null,
      placeholder: isInput ? 'Enter response' : null,
      target: isInput ? 'custom' : null,
      fieldKey: isInput ? `custom_${suffix}` : null,
      appliesTo: 'all',
      required: false,
      options:
        type === 'select'
          ? [
              { value: 'option_1', label: 'Option 1' },
              { value: 'option_2', label: 'Option 2' },
            ]
          : [],
      showIf: null,
      systemLocked: false,
    };
    updateCurrentPage((page) => ({
      ...page,
      blocks: [...page.blocks, newBlock],
    }));
    setExpandedBlockId(blockId);
  };

  const handleMoveBlock = (blockIdx: number, direction: -1 | 1) => {
    if (!currentPage) return;
    const targetIdx = blockIdx + direction;
    if (targetIdx < 0 || targetIdx >= currentPage.blocks.length) return;
    updateCurrentPage((page) => {
      const blocks = [...page.blocks];
      const [item] = blocks.splice(blockIdx, 1);
      blocks.splice(targetIdx, 0, item);
      return { ...page, blocks };
    });
  };

  const handleMoveBlockToPage = (blockIdx: number, destPageIdx: number) => {
    if (!currentPage || destPageIdx === selectedPageIdx) return;
    const blockToMove = currentPage.blocks[blockIdx];
    if (!blockToMove || currentPage.blocks.length <= 1) return;
    setWizardPages((prev) =>
      prev.map((page, idx) => {
        if (idx === selectedPageIdx) {
          return {
            ...page,
            blocks: page.blocks.filter((_, i) => i !== blockIdx),
          };
        }
        if (idx === destPageIdx) {
          return {
            ...page,
            blocks: [...page.blocks, blockToMove],
          };
        }
        return page;
      })
    );
  };

  const handleUpdateBlock = (
    blockId: string,
    partial: Partial<WizardBlock>
  ) => {
    updateCurrentPage((page) => ({
      ...page,
      blocks: page.blocks.map((b) =>
        b.blockId === blockId ? { ...b, ...partial } : b
      ),
    }));
  };

  const handleDeleteBlock = (blockId: string) => {
    if (!currentPage || currentPage.blocks.length <= 1) return;
    const block = currentPage.blocks.find((b) => b.blockId === blockId);
    if (!block || block.systemLocked) return;
    updateCurrentPage((page) => ({
      ...page,
      blocks: page.blocks.filter((b) => b.blockId !== blockId),
    }));
  };

  const saveWizardMutation = useMutation({
    mutationFn: () => {
      setWizardStatusMsg(null);
      setWizardErrorMsg(null);
      return api.updateActiveConsentForm({
        consentVersion: activeTemplate?.consentVersion || 'v2',
        bumpType,
        wizardPages,
      });
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['consentForm'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      setWizardStatusMsg(
        `Published Wizard & Consent Form version "${saved.consentVersion}" (${saved.wizardPages.length} pages).`
      );
      publishFlowEvent(
        'Wizard & Consent Form Published',
        `Active wizard version is now ${saved.consentVersion}.`
      );
    },
    onError: (err) => {
      setWizardErrorMsg(
        err instanceof Error ? err.message : 'Could not save wizard template.'
      );
    },
  });

  // ─── Institutional Copy & Testimonials Governance State (Tabs 3 & 4) ────────
  const { data: cms } = useQuery({
    queryKey: ['cms'],
    queryFn: () => api.getCmsContent(),
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
          'CMS Overview Updated',
          'Vision, Mission, and Clinic Overview updated.'
        );
      },
  });

  const watchedDuration = serviceForm.watch('durationMinutes');

  return (
    <div className="space-y-10">
      <header className="space-y-2 border-b border-mist pb-6">
        <div className="flex items-center gap-2 text-xs text-accent-ink font-semibold">
          <span>Admin Dashboard</span>
          <span aria-hidden="true">·</span>
          <span>Services &amp; Multi-Page Wizard CMS</span>
        </div>
        <h1 className="font-heading text-4xl font-medium text-pine">
          CMS Editors: Services Catalog &amp; Multi-Page Intake/Consent Wizard
        </h1>
        <p className="text-sm text-pine/80 max-w-3xl">
          Create and manage clinical services, customize the multi-page client intake and consent
          wizard, and manage institutional copy and testimonials governance. No private session notes are accessible.
        </p>
      </header>

      {/* Segmented CMS Section Switcher */}
      <div
        role="group"
        aria-label="CMS Editor Sections"
        className="flex flex-wrap items-center gap-1 p-1 bg-surface-sunken rounded-lg border border-mist w-fit"
      >
        {[
          {
            id: 'services',
            label: '1. Services Catalog',
          },
          {
            id: 'wizard',
            label: '2. Wizard & Consent Forms',
          },
          {
            id: 'overview',
            label: '3. Vision, Mission & Overview',
          },
          {
            id: 'structures',
            label: '4. Testimonials Governance',
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

      {/* Tab 1: Services Catalog Editor (Live Backend CRUD) */}
      {activeTab === 'services' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <Card className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between border-b border-mist pb-3">
              <div>
                <h2 className="font-heading text-2xl font-medium text-pine">
                  Services Catalog
                </h2>
                <p className="text-xs text-pine/70">
                  {services.length} total services in database
                </p>
              </div>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => {
                  setServiceStatusMsg(null);
                  setIsCreatingService(true);
                }}
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                New Service
              </Button>
            </div>

            <div className="space-y-2">
              {services.map((srv) => {
                const isSelected =
                  !isCreatingService && currentService?.id === srv.id;
                const active = srv.isActive !== false;
                return (
                  <button
                    key={srv.id}
                    type="button"
                    onClick={() => {
                      setServiceStatusMsg(null);
                      setIsCreatingService(false);
                      setEditingServiceId(srv.id);
                    }}
                    className={`w-full text-left p-3.5 rounded-xl border text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-sage bg-surface-sunken'
                        : 'border-mist bg-surface-raised hover:border-mint hover:bg-surface-sunken/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-accent-ink font-semibold">
                        {srv.durationLabel}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          active
                            ? 'bg-sage/20 text-pine'
                            : 'bg-mist/70 text-pine/60'
                        }`}
                      >
                        {active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="font-heading text-lg font-medium text-pine mt-1">
                      {srv.title}
                    </p>
                    <p className="text-pine/70 line-clamp-2 mt-0.5">
                      {srv.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="lg:col-span-7 space-y-5">
            <div className="border-b border-mist pb-3 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-accent-ink">
                  {isCreatingService
                    ? 'Creating New Service'
                    : 'Editing Service Details'}
                </p>
                <h2 className="font-heading text-2xl font-medium text-pine">
                  {isCreatingService
                    ? 'New Clinical or Advisory Service'
                    : currentService?.title || 'Select a service'}
                </h2>
              </div>
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
                className="rounded-lg border border-sage/50 bg-surface-sunken p-3 text-xs text-pine font-medium"
              >
                {serviceStatusMsg}
              </div>
            )}

            {saveServiceMutation.isError && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900"
              >
                {saveServiceMutation.error instanceof Error
                  ? saveServiceMutation.error.message
                  : 'Failed to save service.'}
              </div>
            )}

            <form
              onSubmit={serviceForm.handleSubmit((vals) =>
                saveServiceMutation.mutate(vals)
              )}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <Label htmlFor="srv-title">Service Name</Label>
                  <Input
                    id="srv-title"
                    placeholder="e.g. Individual Counseling & Psychotherapy"
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
                    Duration (minutes) ·{' '}
                    <span className="font-mono text-accent-ink">
                      {formatDurationPreview(Number(watchedDuration))}
                    </span>
                  </Label>
                  <Input
                    id="srv-dur"
                    type="number"
                    min={15}
                    max={480}
                    step={15}
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
                <Label htmlFor="srv-desc">Service Description</Label>
                <Textarea
                  id="srv-desc"
                  rows={4}
                  placeholder="Describe what the session covers and how clients prepare."
                  {...serviceForm.register('description')}
                />
                {serviceForm.formState.errors.description && (
                  <p className="text-xs text-red-700 mt-1">
                    {serviceForm.formState.errors.description.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="srv-notice">Important Notice (Optional)</Label>
                <Textarea
                  id="srv-notice"
                  rows={2}
                  placeholder="Optional scope notice shown on booking cards (e.g. 'Life coaching is not a substitute for therapy.')"
                  {...serviceForm.register('notice')}
                />
                {serviceForm.formState.errors.notice && (
                  <p className="text-xs text-red-700 mt-1">
                    {serviceForm.formState.errors.notice.message}
                  </p>
                )}
              </div>

              <label className="flex items-center gap-3 p-3.5 rounded-xl border border-mist bg-surface-sunken/50 text-xs text-pine cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-mist accent-sage cursor-pointer"
                  {...serviceForm.register('isActive')}
                />
                <div>
                  <p className="font-semibold">
                    Active in public directory &amp; client booking selector
                  </p>
                  <p className="text-pine/70">
                    Uncheck to hide this service from new bookings while preserving past appointment
                    records.
                  </p>
                </div>
              </label>

              <Button
                type="submit"
                variant="primary"
                disabled={saveServiceMutation.isPending}
              >
                {saveServiceMutation.isPending
                  ? 'Saving Service…'
                  : isCreatingService
                    ? 'Create Service'
                    : 'Save Service Changes'}
              </Button>
            </form>
          </Card>
        </div>
      )}

      {/* Tab 2: Multi-Page Wizard & Consent Forms Builder (Live Backend) */}
      {activeTab === 'wizard' && (
        <div className="space-y-6">
          {/* Top Bar: Active Version, Live Diff Indicator & Publish Controls */}
          <Card className="space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-mist pb-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-heading text-2xl font-medium text-pine">
                    Multi-Page Intake &amp; Consent Wizard Builder
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-sage/20 text-pine">
                    Active Version: {activeTemplate?.consentVersion || 'v2'}
                  </span>
                </div>
                <p className="text-xs text-pine/75">
                  Customize wizard pages, legal consent documents, demographic fields, and custom
                  intake questions.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <Label htmlFor="wiz-bump-type" className="mb-0 whitespace-nowrap">
                    Versioning mode:
                  </Label>
                  <Select
                    id="wiz-bump-type"
                    value={bumpType}
                    onChange={(e) =>
                      setBumpType(e.target.value as 'auto' | 'minor' | 'major')
                    }
                    className="w-56"
                  >
                    <option value="auto">Auto-detect (Recommended)</option>
                    <option value="minor">
                      Minor decimal bump (no re-sign)
                    </option>
                    <option value="major">
                      Major version bump (require re-sign)
                    </option>
                  </Select>
                </div>

                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => saveWizardMutation.mutate()}
                  disabled={saveWizardMutation.isPending}
                >
                  {saveWizardMutation.isPending
                    ? 'Publishing Wizard…'
                    : 'Save & Publish Wizard'}
                </Button>
              </div>
            </div>

            {/* Live Version Impact Banner */}
            <div
              className={`rounded-lg border p-3.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                !hasWizardChanges
                  ? 'border-mist bg-surface-sunken/50 text-pine/75'
                  : willTriggerMajorBump
                    ? 'border-amber-300 bg-amber-50 text-amber-950'
                    : 'border-sage/50 bg-surface-sunken text-pine'
              }`}
            >
              {!hasWizardChanges ? (
                <p>
                  <strong>No unsaved changes.</strong> Edit any page, field, or consent document
                  below to preview how versioning will be applied.
                </p>
              ) : willTriggerMajorBump ? (
                <p>
                  <strong>Major Version Bump Detected:</strong> Consent blocks or legal text were
                  modified. Saving will publish a new major version (e.g.{' '}
                  <code>v3</code>) and prompt existing clients to re-sign consent before their next
                  booking.
                </p>
              ) : (
                <p>
                  <strong>Minor Decimal Bump Detected:</strong> Only profile/demographic or UI
                  fields were modified. Saving will publish a decimal update (e.g.{' '}
                  <code>{activeTemplate?.consentVersion || 'v2'}.1</code>) — existing clients will{' '}
                  <strong>not</strong> need to re-sign consent.
                </p>
              )}

              {hasWizardChanges && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setWizardPages(
                      JSON.parse(JSON.stringify(baselinePages)) as WizardPage[]
                    )
                  }
                >
                  Discard Unsaved Edits
                </Button>
              )}
            </div>

            {/* Version History Pills */}
            {templateHistory.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                <span className="text-pine/60 font-medium">
                  Saved Version History:
                </span>
                {templateHistory.map((tpl) => (
                  <button
                    key={tpl.templateId}
                    type="button"
                    onClick={() => {
                      setWizardPages(
                        JSON.parse(JSON.stringify(tpl.wizardPages)) as WizardPage[]
                      );
                      setSelectedPageIdx(0);
                      setWizardStatusMsg(
                        `Loaded version "${tpl.consentVersion}" into the editor.`
                      );
                    }}
                    className={`px-2.5 py-1 rounded-md border font-mono text-xs cursor-pointer transition-colors ${
                      tpl.isActive
                        ? 'border-sage bg-surface-sunken font-semibold text-pine'
                        : 'border-mist bg-surface-raised text-pine/70 hover:border-mint'
                    }`}
                  >
                    {tpl.consentVersion}
                    {tpl.isActive ? ' (active)' : ''}
                  </button>
                ))}
              </div>
            )}

            {wizardStatusMsg && (
              <div
                role="status"
                className="rounded-lg border border-sage/50 bg-surface-sunken p-3 text-xs text-pine font-medium"
              >
                {wizardStatusMsg}
              </div>
            )}

            {wizardErrorMsg && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900"
              >
                {wizardErrorMsg}
              </div>
            )}
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Wizard Pages List */}
            <Card className="lg:col-span-4 space-y-4">
              <div className="flex items-center justify-between border-b border-mist pb-3">
                <div>
                  <h3 className="font-heading text-xl font-medium text-pine">
                    Wizard Pages ({wizardPages.length})
                  </h3>
                  <p className="text-xs text-pine/65">
                    Steps shown in the client wizard
                  </p>
                </div>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleAddPage}
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  Add Page
                </Button>
              </div>

              <div className="space-y-2">
                {wizardPages.map((page, idx) => {
                  const isSelected = idx === selectedPageIdx;
                  const hasLockedBlock = page.blocks.some((b) => b.systemLocked);
                  return (
                    <div
                      key={page.pageId}
                      className={`p-3 rounded-xl border text-xs transition-colors ${
                        isSelected
                          ? 'border-sage bg-surface-sunken'
                          : 'border-mist bg-surface-raised hover:border-mint'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedPageIdx(idx)}
                          className="text-left flex-1 cursor-pointer"
                        >
                          <p className="font-mono text-[11px] text-accent-ink font-semibold">
                            Step {idx + 1} · {page.blocks.length}{' '}
                            {page.blocks.length === 1 ? 'block' : 'blocks'}
                          </p>
                          <p className="font-heading text-base font-medium text-pine mt-0.5">
                            {page.title}
                          </p>
                        </button>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleMovePage(idx, -1)}
                            disabled={idx === 0}
                            aria-label={`Move page ${page.title} up`}
                            className="p-1 rounded hover:bg-surface-raised disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMovePage(idx, 1)}
                            disabled={idx === wizardPages.length - 1}
                            aria-label={`Move page ${page.title} down`}
                            className="p-1 rounded hover:bg-surface-raised disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePage(idx)}
                            disabled={
                              hasLockedBlock || wizardPages.length <= 1
                            }
                            title={
                              hasLockedBlock
                                ? 'Move locked core fields to another page before deleting this page'
                                : 'Delete page'
                            }
                            aria-label={`Delete page ${page.title}`}
                            className="p-1 rounded text-pine/60 hover:text-red-700 disabled:opacity-30 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Right Column: Selected Page & Blocks Editor */}
            {currentPage && (
              <Card className="lg:col-span-8 space-y-6">
                <div className="border-b border-mist pb-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-semibold text-accent-ink">
                      Editing Step {selectedPageIdx + 1} of {wizardPages.length}
                    </span>
                    <span className="text-xs font-mono text-pine/60">
                      ID: {currentPage.pageId}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="page-title">Page Title</Label>
                      <Input
                        id="page-title"
                        value={currentPage.title}
                        onChange={(e) =>
                          updateCurrentPage((p) => ({
                            ...p,
                            title: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="page-desc">
                        Page Subtitle / Description (Optional)
                      </Label>
                      <Input
                        id="page-desc"
                        value={currentPage.description || ''}
                        onChange={(e) =>
                          updateCurrentPage((p) => ({
                            ...p,
                            description: e.target.value || null,
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Blocks List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-heading text-lg font-medium text-pine">
                      Page Blocks &amp; Fields ({currentPage.blocks.length})
                    </h4>
                    <span className="text-xs text-pine/60">
                      Click any block to edit its label, options, or rules
                    </span>
                  </div>

                  {currentPage.blocks.map((block, bIdx) => {
                    const isExpanded = expandedBlockId === block.blockId;
                    const isInput = INPUT_BLOCK_TYPES.has(block.type);
                    const typeLabel =
                      BLOCK_TYPE_OPTIONS.find((t) => t.value === block.type)
                        ?.label || block.type;

                    return (
                      <div
                        key={block.blockId}
                        className={`rounded-xl border transition-colors ${
                          isExpanded
                            ? 'border-sage bg-surface-sunken/60'
                            : 'border-mist bg-surface-raised'
                        }`}
                      >
                        {/* Block Summary Row */}
                        <div className="p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedBlockId(
                                isExpanded ? null : block.blockId
                              )
                            }
                            className="text-left flex-1 min-w-[14rem] cursor-pointer space-y-1"
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded bg-surface-sunken font-mono text-[11px] font-semibold text-accent-ink border border-mist">
                                {typeLabel}
                              </span>
                              {block.target && (
                                <span
                                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                    block.target === 'consent'
                                      ? 'bg-amber-100 text-amber-900'
                                      : block.target === 'profile'
                                        ? 'bg-sage/20 text-pine'
                                        : 'bg-mist/70 text-pine/80'
                                  }`}
                                >
                                  Target: {block.target}
                                </span>
                              )}
                              {block.appliesTo !== 'all' && (
                                <span className="px-2 py-0.5 rounded bg-parchment border border-mist text-[11px] text-pine/80">
                                  Scope: {block.appliesTo} only
                                </span>
                              )}
                              {block.required && (
                                <span className="px-2 py-0.5 rounded bg-pine text-white text-[10px] font-semibold">
                                  Required
                                </span>
                              )}
                              {block.systemLocked && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-sunken border border-sage/50 text-[11px] font-semibold text-pine">
                                  <Lock className="w-3 h-3" aria-hidden="true" />
                                  Locked Core Field
                                </span>
                              )}
                            </div>
                            <p className="font-medium text-sm text-pine">
                              {block.label}
                            </p>
                            {block.fieldKey && (
                              <p className="font-mono text-[11px] text-pine/60">
                                field_key: {block.fieldKey}
                              </p>
                            )}
                          </button>

                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setExpandedBlockId(
                                  isExpanded ? null : block.blockId
                                )
                              }
                            >
                              {isExpanded ? 'Collapse' : 'Edit'}
                            </Button>
                            <button
                              type="button"
                              onClick={() => handleMoveBlock(bIdx, -1)}
                              disabled={bIdx === 0}
                              aria-label={`Move block ${block.label} up`}
                              className="p-1.5 rounded hover:bg-surface-sunken disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveBlock(bIdx, 1)}
                              disabled={bIdx === currentPage.blocks.length - 1}
                              aria-label={`Move block ${block.label} down`}
                              className="p-1.5 rounded hover:bg-surface-sunken disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBlock(block.blockId)}
                              disabled={
                                block.systemLocked ||
                                currentPage.blocks.length <= 1
                              }
                              title={
                                block.systemLocked
                                  ? 'Core operational field cannot be deleted (you can edit its label or move it to another page)'
                                  : 'Delete block'
                              }
                              aria-label={`Delete block ${block.label}`}
                              className="p-1.5 rounded text-pine/60 hover:text-red-700 disabled:opacity-30 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Expanded Block Editor */}
                        {isExpanded && (
                          <div className="border-t border-mist p-4 space-y-4 text-xs bg-surface-raised rounded-b-xl">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="sm:col-span-2">
                                <Label htmlFor={`blk-lbl-${block.blockId}`}>
                                  Label / Question Text
                                </Label>
                                <Input
                                  id={`blk-lbl-${block.blockId}`}
                                  value={block.label}
                                  onChange={(e) =>
                                    handleUpdateBlock(block.blockId, {
                                      label: e.target.value,
                                    })
                                  }
                                />
                              </div>

                              <div>
                                <Label htmlFor={`blk-type-${block.blockId}`}>
                                  Block Type
                                </Label>
                                <Select
                                  id={`blk-type-${block.blockId}`}
                                  value={block.type}
                                  disabled={block.systemLocked}
                                  onChange={(e) => {
                                    const nextType = e.target
                                      .value as WizardBlockType;
                                    const nextIsInput =
                                      INPUT_BLOCK_TYPES.has(nextType);
                                    handleUpdateBlock(block.blockId, {
                                      type: nextType,
                                      target: nextIsInput
                                        ? block.target || 'custom'
                                        : null,
                                      fieldKey: nextIsInput
                                        ? block.fieldKey || block.blockId
                                        : null,
                                      options:
                                        nextType === 'select' &&
                                        block.options.length === 0
                                          ? [
                                              {
                                                value: 'option_1',
                                                label: 'Option 1',
                                              },
                                            ]
                                          : block.options,
                                    });
                                  }}
                                >
                                  {BLOCK_TYPE_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </Select>
                              </div>

                              <div>
                                <Label htmlFor={`blk-scope-${block.blockId}`}>
                                  Applies To (Self vs. Dependent)
                                </Label>
                                <Select
                                  id={`blk-scope-${block.blockId}`}
                                  value={block.appliesTo}
                                  onChange={(e) =>
                                    handleUpdateBlock(block.blockId, {
                                      appliesTo: e.target
                                        .value as WizardAppliesTo,
                                    })
                                  }
                                >
                                  <option value="all">
                                    All Profiles (Self &amp; Dependent)
                                  </option>
                                  <option value="self">
                                    Self Profile / Registration Only
                                  </option>
                                  <option value="dependent">
                                    Dependent Profiles Only
                                  </option>
                                </Select>
                              </div>

                              {isInput && (
                                <>
                                  <div>
                                    <Label htmlFor={`blk-key-${block.blockId}`}>
                                      Field Key (JSON attribute key)
                                    </Label>
                                    <Input
                                      id={`blk-key-${block.blockId}`}
                                      value={block.fieldKey || ''}
                                      disabled={block.systemLocked}
                                      onChange={(e) =>
                                        handleUpdateBlock(block.blockId, {
                                          fieldKey: e.target.value.replace(
                                            /\s+/g,
                                            '_'
                                          ),
                                        })
                                      }
                                    />
                                  </div>

                                  <div>
                                    <Label
                                      htmlFor={`blk-target-${block.blockId}`}
                                    >
                                      Storage &amp; Versioning Target
                                    </Label>
                                    <Select
                                      id={`blk-target-${block.blockId}`}
                                      value={block.target || 'custom'}
                                      disabled={block.systemLocked}
                                      onChange={(e) =>
                                        handleUpdateBlock(block.blockId, {
                                          target: e.target
                                            .value as WizardFieldTarget,
                                        })
                                      }
                                    >
                                      <option value="profile">
                                        Profile Demographics (profile.details — minor version bump)
                                      </option>
                                      <option value="consent">
                                        Legal Consent Record (forms.responses — major version bump)
                                      </option>
                                      <option value="custom">
                                        Custom Intake Field (forms.responses)
                                      </option>
                                      <option value="ui">
                                        UI Helper Control Only
                                      </option>
                                    </Select>
                                  </div>

                                  <div>
                                    <Label htmlFor={`blk-ph-${block.blockId}`}>
                                      Placeholder (Optional)
                                    </Label>
                                    <Input
                                      id={`blk-ph-${block.blockId}`}
                                      value={block.placeholder || ''}
                                      onChange={(e) =>
                                        handleUpdateBlock(block.blockId, {
                                          placeholder: e.target.value || null,
                                        })
                                      }
                                    />
                                  </div>

                                  <div>
                                    <Label
                                      htmlFor={`blk-help-${block.blockId}`}
                                    >
                                      Helper Text (Optional)
                                    </Label>
                                    <Input
                                      id={`blk-help-${block.blockId}`}
                                      value={block.helperText || ''}
                                      onChange={(e) =>
                                        handleUpdateBlock(block.blockId, {
                                          helperText: e.target.value || null,
                                        })
                                      }
                                    />
                                  </div>
                                </>
                              )}
                            </div>

                            {/* Document / Info Content Editor */}
                            {(block.type === 'scrollable_doc' ||
                              block.type === 'info_text') && (
                              <div>
                                <Label htmlFor={`blk-content-${block.blockId}`}>
                                  Document / Notice Content
                                </Label>
                                <Textarea
                                  id={`blk-content-${block.blockId}`}
                                  rows={6}
                                  value={block.content || ''}
                                  onChange={(e) =>
                                    handleUpdateBlock(block.blockId, {
                                      content: e.target.value,
                                    })
                                  }
                                />
                              </div>
                            )}

                            {/* Dropdown Select Options Editor */}
                            {block.type === 'select' && (
                              <div className="space-y-2 border-t border-mist pt-3">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-pine">
                                    Dropdown Options ({block.options.length})
                                  </span>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      handleUpdateBlock(block.blockId, {
                                        options: [
                                          ...block.options,
                                          {
                                            value: `option_${block.options.length + 1}`,
                                            label: `Option ${block.options.length + 1}`,
                                          },
                                        ],
                                      })
                                    }
                                  >
                                    <Plus className="w-3 h-3" />
                                    Add Option
                                  </Button>
                                </div>

                                <div className="space-y-2">
                                  {block.options.map((opt, optIdx) => (
                                    <div
                                      key={`${block.blockId}-opt-${optIdx}`}
                                      className="flex items-center gap-2"
                                    >
                                      <Input
                                        value={opt.value}
                                        placeholder="Value (stored)"
                                        onChange={(e) => {
                                          const nextOpts = [...block.options];
                                          nextOpts[optIdx] = {
                                            ...opt,
                                            value: e.target.value,
                                          };
                                          handleUpdateBlock(block.blockId, {
                                            options: nextOpts,
                                          });
                                        }}
                                      />
                                      <Input
                                        value={opt.label}
                                        placeholder="Display Label"
                                        onChange={(e) => {
                                          const nextOpts = [...block.options];
                                          nextOpts[optIdx] = {
                                            ...opt,
                                            label: e.target.value,
                                          };
                                          handleUpdateBlock(block.blockId, {
                                            options: nextOpts,
                                          });
                                        }}
                                      />
                                      <button
                                        type="button"
                                        disabled={block.options.length <= 1}
                                        onClick={() =>
                                          handleUpdateBlock(block.blockId, {
                                            options: block.options.filter(
                                              (_, i) => i !== optIdx
                                            ),
                                          })
                                        }
                                        className="p-1.5 rounded text-pine/60 hover:text-red-700 disabled:opacity-30 cursor-pointer"
                                        aria-label="Remove option"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Required Toggle, Conditional Visibility (showIf), and Move to Page */}
                            <div className="border-t border-mist pt-3 flex flex-wrap items-center justify-between gap-4">
                              {isInput && (
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <Checkbox
                                    checked={block.required}
                                    onChange={(e) =>
                                      handleUpdateBlock(block.blockId, {
                                        required: e.target.checked,
                                      })
                                    }
                                  />
                                  <span className="font-medium text-pine">
                                    Required field
                                  </span>
                                </label>
                              )}

                              {/* Conditional Visibility Rule */}
                              <div className="flex flex-wrap items-center gap-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <Checkbox
                                    checked={Boolean(block.showIf)}
                                    onChange={(e) =>
                                      handleUpdateBlock(block.blockId, {
                                        showIf: e.target.checked
                                          ? {
                                              fieldKey:
                                                allAvailableFieldKeys[0]?.key ||
                                                'is_overseas_or_foreign',
                                              equals: true,
                                            }
                                          : null,
                                      })
                                    }
                                  />
                                  <span>Conditional display (Show if)</span>
                                </label>

                                {block.showIf && (
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Select
                                      value={block.showIf.fieldKey}
                                      onChange={(e) =>
                                        handleUpdateBlock(block.blockId, {
                                          showIf: {
                                            ...block.showIf!,
                                            fieldKey: e.target.value,
                                          },
                                        })
                                      }
                                      className="w-44"
                                    >
                                      {allAvailableFieldKeys.map((fk) => (
                                        <option key={fk.key} value={fk.key}>
                                          {fk.key}
                                        </option>
                                      ))}
                                    </Select>
                                    <span>equals</span>
                                    <Input
                                      value={String(block.showIf.equals)}
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        const parsed =
                                          raw === 'true'
                                            ? true
                                            : raw === 'false'
                                              ? false
                                              : raw;
                                        handleUpdateBlock(block.blockId, {
                                          showIf: {
                                            ...block.showIf!,
                                            equals: parsed,
                                          },
                                        });
                                      }}
                                      className="w-28"
                                    />
                                  </div>
                                )}
                              </div>

                              {/* Move Block to Another Page */}
                              {wizardPages.length > 1 &&
                                currentPage.blocks.length > 1 && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-pine/60">
                                      Move to page:
                                    </span>
                                    <Select
                                      value={String(selectedPageIdx)}
                                      onChange={(e) =>
                                        handleMoveBlockToPage(
                                          bIdx,
                                          Number(e.target.value)
                                        )
                                      }
                                      className="w-44"
                                    >
                                      {wizardPages.map((p, pIdx) => (
                                        <option
                                          key={p.pageId}
                                          value={String(pIdx)}
                                        >
                                          Step {pIdx + 1}: {p.title}
                                        </option>
                                      ))}
                                    </Select>
                                  </div>
                                )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Add Block Bar */}
                <div className="border-t border-mist pt-4 space-y-2">
                  <p className="text-xs font-semibold text-pine">
                    Add a Block or Question to Step {selectedPageIdx + 1}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { type: 'text' as const, label: '+ Text Question' },
                      { type: 'textarea' as const, label: '+ Long Text Question' },
                      { type: 'select' as const, label: '+ Dropdown Question' },
                      { type: 'checkbox' as const, label: '+ Checkbox / Consent Ack' },
                      { type: 'date' as const, label: '+ Date Field' },
                      { type: 'phone' as const, label: '+ Phone Field' },
                      { type: 'scrollable_doc' as const, label: '+ Scrollable Legal Document' },
                      { type: 'section_heading' as const, label: '+ Section Heading' },
                      { type: 'info_text' as const, label: '+ Info Notice' },
                    ].map((btn) => (
                      <Button
                        key={btn.type}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddBlock(btn.type)}
                      >
                        {btn.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Vision, Mission, Clinic Overview & Consent Banner */}
      {activeTab === 'overview' && (
        <Card className="space-y-6">
          <div className="border-b border-mist pb-3">
            <h2 className="font-heading text-2xl font-medium text-pine">
              Vision, Mission, Clinic Overview &amp; Consent-Flag Governance
            </h2>
            <p className="text-xs text-pine/70">
              Manage Vision, Mission, Clinic Overview, Impact Narrative, and the Testimonials
              consent-flag governance banner. Services and Wizard/Consent Forms in Tabs 1 &amp; 2
              are persisted to the PostgreSQL database.
            </p>
          </div>

          <form
            onSubmit={overviewForm.handleSubmit((vals) =>
              saveCmsMutation.mutate(vals)
            )}
            className="space-y-5"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <Label htmlFor="cms-vision">Vision Statement</Label>
                <Textarea
                  id="cms-vision"
                  rows={4}
                  {...overviewForm.register('vision')}
                />
                {overviewForm.formState.errors.vision && (
                  <p className="text-xs text-red-700 mt-1">
                    {overviewForm.formState.errors.vision.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="cms-mission">Mission Statement</Label>
                <Textarea
                  id="cms-mission"
                  rows={4}
                  {...overviewForm.register('mission')}
                />
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
              {saveCmsMutation.isPending
                ? 'Saving…'
                : 'Save Overview'}
            </Button>
          </form>
        </Card>
      )}

      {/* Tab 4: Testimonials Consent Structure */}
      {activeTab === 'structures' && (
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
              banner only.
            </p>
          ) : (
            <div className="divide-y divide-mist/60 text-xs">
              {cms?.testimonialsConfig.emptyCards.map((card) => (
                <div key={card.id} className="py-3 space-y-1">
                  <div className="flex justify-between font-mono text-accent-ink">
                    <span>{card.slotCode}</span>
                    <span>Quote: Intentionally Empty</span>
                  </div>
                  <p className="font-semibold text-pine">
                    {card.serviceCategory}
                  </p>
                  <p className="text-pine/75">{card.governanceNote}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
