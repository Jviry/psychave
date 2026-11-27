'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Eye,
  Lock,
  Plus,
  Trash2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';
import {
  DEFAULT_WIZARD_PAGES,
  didConsentBlocksChange,
  isWizardBlockVisible,
} from '@/lib/consent';
import {
  cmsOverviewSchema,
  CmsOverviewFormValues,
  serviceCmsSchema,
  ServiceCmsFormValues,
  testimonialCmsSchema,
  TestimonialCmsFormValues,
} from '@/lib/schemas';
import type {
  TestimonialItem,
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
  Modal,
  Select,
  Skeleton,
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

const SERVICES_PAGE_SIZE = 6;

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

  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    description?: string;
    body: string;
    confirmLabel: string;
    confirmVariant?: 'primary' | 'danger';
    onConfirm: () => void;
  } | null>(null);

  // ─── Services Catalog State ─────────────────────────────────────────────────
  const {
    data: services = [],
    isLoading: isLoadingServices,
    error: servicesError,
    refetch: refetchServices,
    isFetching: isRefetchingServices,
  } = useQuery({
    queryKey: ['services', 'admin'],
    queryFn: () => api.getAdminServices(),
  });

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

  // ─── Multi-Page Wizard & Consent Builder State ──────────────────────────────
  const {
    data: activeTemplate,
    isLoading: isLoadingTemplate,
    error: templateError,
    refetch: refetchTemplate,
    isFetching: isRefetchingTemplate,
  } = useQuery({
    queryKey: ['consentForm', 'active'],
    queryFn: () => api.getActiveConsentForm(),
  });

  const {
    data: templateHistory = [],
    isLoading: isLoadingTemplateHistory,
    error: templateHistoryError,
    refetch: refetchTemplateHistory,
  } = useQuery({
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
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewStep, setPreviewStep] = useState(1);
  const [previewValues, setPreviewValues] = useState<Record<string, unknown>>({});

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
        getFriendlyErrorMessage(err, 'Could not save wizard template. Please try again.')
      );
    },
  });

  // ─── Institutional Copy & Testimonials State (Tabs 3 & 4) ───────────────────
  const {
    data: cms,
    isLoading: isLoadingCms,
    error: cmsError,
    refetch: refetchCms,
    isFetching: isRefetchingCms,
  } = useQuery({
    queryKey: ['cms', 'admin'],
    queryFn: () => api.getAdminCmsContent(),
  });

  const [overviewStatusMsg, setOverviewStatusMsg] = useState<string | null>(null);
  const [overviewErrorMsg, setOverviewErrorMsg] = useState<string | null>(null);
  const overviewForm = useForm<CmsOverviewFormValues>({
    resolver: zodResolver(cmsOverviewSchema),
    defaultValues: {
      vision: cms?.vision || '',
      mission: cms?.mission || '',
      clinicOverview: cms?.clinicOverview || '',
      impactNarrative: cms?.impactNarrative || '',
      evaluationFormUrl: cms?.evaluationFormUrl || '',
    },
  });

  useEffect(() => {
    if (cms) {
      overviewForm.reset({
        vision: cms.vision,
        mission: cms.mission,
        clinicOverview: cms.clinicOverview,
        impactNarrative: cms.impactNarrative,
        evaluationFormUrl: cms.evaluationFormUrl || '',
      });
    }
  }, [cms, overviewForm]);

  const saveCmsMutation = useMutation({
    mutationFn: (values: CmsOverviewFormValues) =>
      api.updateCmsContent({
        vision: values.vision,
        mission: values.mission,
        clinicOverview: values.clinicOverview,
        impactNarrative: values.impactNarrative,
        evaluationFormUrl: values.evaluationFormUrl || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms'] });
      setOverviewErrorMsg(null);
      setOverviewStatusMsg('Saved Vision, Mission, Clinic Overview, and Impact Narrative.');
      publishFlowEvent(
        'CMS Overview Updated',
        'Vision, Mission, and Clinic Overview persisted to database.'
      );
    },
    onError: (err) => {
      setOverviewErrorMsg(
        getFriendlyErrorMessage(err, 'Could not save overview content. Please try again.')
      );
    },
  });

  const testimonials = cms?.testimonials ?? [];
  const [isCreatingTestimonial, setIsCreatingTestimonial] = useState(false);
  const [editingTestimonialId, setEditingTestimonialId] = useState<string>('');
  const [testimonialStatusMsg, setTestimonialStatusMsg] = useState<string | null>(null);
  const [testimonialErrorMsg, setTestimonialErrorMsg] = useState<string | null>(null);

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
      setTestimonialErrorMsg(null);
      setTestimonialStatusMsg(
        `Saved testimonial by "${saved.authorLabel}".`
      );
      publishFlowEvent(
        'Testimonials Updated',
        `Saved testimonial for ${saved.serviceCategory}.`
      );
    },
    onError: (err) => {
      setTestimonialErrorMsg(
        getFriendlyErrorMessage(err, 'Could not save this testimonial. Please try again.')
      );
    },
  });

  const deleteTestimonialMutation = useMutation({
    mutationFn: (id: string) => api.deleteTestimonial(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms'] });
      setEditingTestimonialId('');
      setTestimonialErrorMsg(null);
      setTestimonialStatusMsg('Deleted testimonial.');
    },
    onError: (err) => {
      setTestimonialErrorMsg(
        getFriendlyErrorMessage(err, 'Could not delete this testimonial. Please try again.')
      );
    },
  });

  const guardServiceSwitch = (proceed: () => void) => {
    if (serviceForm.formState.isDirty) {
      setConfirmDialog({
        title: 'Discard unsaved service edits?',
        body: 'You have unsaved changes in the current service form. Switching now will discard them.',
        confirmLabel: 'Discard Changes',
        confirmVariant: 'danger',
        onConfirm: () => {
          setConfirmDialog(null);
          proceed();
        },
      });
      return;
    }
    proceed();
  };

  const guardTestimonialSwitch = (proceed: () => void) => {
    if (testimonialForm.formState.isDirty) {
      setConfirmDialog({
        title: 'Discard unsaved testimonial edits?',
        body: 'You have unsaved changes in the current testimonial form. Switching now will discard them.',
        confirmLabel: 'Discard Changes',
        confirmVariant: 'danger',
        onConfirm: () => {
          setConfirmDialog(null);
          proceed();
        },
      });
      return;
    }
    proceed();
  };

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
            label: '4. Testimonials',
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
                onClick={() =>
                  guardServiceSwitch(() => {
                    setServiceStatusMsg(null);
                    setIsCreatingService(true);
                  })
                }
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                New Service
              </Button>
            </div>

            {servicesError && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900 flex items-center justify-between gap-2"
              >
                <span>
                  {getFriendlyErrorMessage(
                    servicesError,
                    'Could not load the services catalog.'
                  )}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => refetchServices()}
                  disabled={isRefetchingServices}
                  className="shrink-0"
                >
                  {isRefetchingServices ? 'Retrying…' : 'Try Again'}
                </Button>
              </div>
            )}

            <div className="space-y-2">
              {isLoadingServices ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-24" />
                ))
              ) : services.length === 0 ? (
                <p className="text-xs text-pine/70 py-6 text-center">
                  No services configured yet. Create your first service to populate the booking catalog.
                </p>
              ) : (
                paginatedServices.map((srv) => {
                  const isSelected =
                    !isCreatingService && currentService?.id === srv.id;
                  const active = srv.isActive !== false;
                  return (
                    <button
                      key={srv.id}
                      type="button"
                      onClick={() =>
                        guardServiceSwitch(() => {
                          setServiceStatusMsg(null);
                          setIsCreatingService(false);
                          setEditingServiceId(srv.id);
                        })
                      }
                      className={`w-full text-left p-3.5 rounded-xl border text-xs transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-sage bg-surface-sunken'
                          : 'border-mist bg-surface-raised hover:border-mint hover:bg-surface-sunken/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-accent-ink font-semibold">
                          {srv.durationLabel}
                          {srv.rateLabel ? ` · ${srv.rateLabel}` : ''}
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
                })
              )}
            </div>

            {services.length > SERVICES_PAGE_SIZE && (
              <div className="flex items-center justify-between gap-2 border-t border-mist pt-3 text-xs">
                <span className="text-pine/70 tabular-nums">
                  Showing {firstServiceRow}–{lastServiceRow} of {services.length}
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
                  <span className="px-2 text-pine/80 tabular-nums">
                    {safeServicesPage} / {totalServicePages}
                  </span>
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
                {getFriendlyErrorMessage(
                  saveServiceMutation.error,
                  'Failed to save service. Please try again.'
                )}
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
                <Label htmlFor="srv-rate">Rate (Optional)</Label>
                <Input
                  id="srv-rate"
                  placeholder="e.g. ₱1,500 or ₱1,500 – ₱2,500"
                  {...serviceForm.register('rateLabel')}
                />
                {serviceForm.formState.errors.rateLabel && (
                  <p className="text-xs text-red-700 mt-1">
                    {serviceForm.formState.errors.rateLabel.message}
                  </p>
                )}
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
          {(templateError || templateHistoryError) && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-red-900"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  {getFriendlyErrorMessage(
                    templateError || templateHistoryError,
                    'Could not load the active wizard template.'
                  )}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  refetchTemplate();
                  refetchTemplateHistory();
                }}
                disabled={isRefetchingTemplate}
                className="shrink-0"
              >
                {isRefetchingTemplate ? 'Retrying…' : 'Try Again'}
              </Button>
            </div>
          )}

          {isLoadingTemplate || isLoadingTemplateHistory ? (
            <div className="space-y-4">
              <Skeleton className="h-32" />
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <Skeleton className="lg:col-span-4 h-80" />
                <Skeleton className="lg:col-span-8 h-80" />
              </div>
            </div>
          ) : (
            <>
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
                  variant="outline"
                  size="md"
                  onClick={() => {
                    setPreviewStep(selectedPageIdx + 1);
                    setIsPreviewOpen(true);
                  }}
                >
                  <Eye className="w-4 h-4" aria-hidden="true" />
                  Preview Wizard
                </Button>

                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => {
                    if (willTriggerMajorBump) {
                      setConfirmDialog({
                        title: 'Publish Major Consent Version?',
                        description: 'Clients will be required to re-sign consent.',
                        body: 'Publishing a major version bump updates the legal consent version and will prompt all existing clients to review and re-sign consent before their next booking. Are you sure you want to publish now?',
                        confirmLabel: 'Publish Major Version',
                        confirmVariant: 'primary',
                        onConfirm: () => {
                          setConfirmDialog(null);
                          saveWizardMutation.mutate();
                        },
                      });
                    } else {
                      saveWizardMutation.mutate();
                    }
                  }}
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
                    setConfirmDialog({
                      title: 'Discard unsaved wizard edits?',
                      body: 'All unpublished page, block, and consent text edits will be reverted to the currently active template.',
                      confirmLabel: 'Discard Edits',
                      confirmVariant: 'danger',
                      onConfirm: () => {
                        setConfirmDialog(null);
                        setWizardPages(
                          JSON.parse(JSON.stringify(baselinePages)) as WizardPage[]
                        );
                      },
                    })
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
                            onClick={() =>
                              setConfirmDialog({
                                title: `Delete "${page.title}"?`,
                                body: `This will remove Step ${idx + 1} and its ${page.blocks.length} ${page.blocks.length === 1 ? 'block' : 'blocks'} from the draft wizard.`,
                                confirmLabel: 'Delete Page',
                                confirmVariant: 'danger',
                                onConfirm: () => {
                                  setConfirmDialog(null);
                                  handleDeletePage(idx);
                                },
                              })
                            }
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
                              onClick={() =>
                                setConfirmDialog({
                                  title: `Delete "${block.label}"?`,
                                  body: 'This block will be removed from the current wizard step. You can still discard edits before publishing.',
                                  confirmLabel: 'Delete Block',
                                  confirmVariant: 'danger',
                                  onConfirm: () => {
                                    setConfirmDialog(null);
                                    handleDeleteBlock(block.blockId);
                                  },
                                })
                              }
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

                                  <details className="sm:col-span-2 rounded-lg border border-mist bg-surface-sunken/40 p-3">
                                    <summary className="cursor-pointer font-medium text-pine/80 select-none">
                                      Advanced field settings (storage &amp; versioning)
                                    </summary>
                                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      <div>
                                        <Label htmlFor={`blk-key-${block.blockId}`}>
                                          Internal Field Key
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
                                          Data &amp; Versioning Category
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
                                            Client Profile Info (minor update)
                                          </option>
                                          <option value="consent">
                                            Legal Consent Record (requires client re-sign)
                                          </option>
                                          <option value="custom">
                                            Custom Intake Answer
                                          </option>
                                          <option value="ui">
                                            Display / Helper Only
                                          </option>
                                        </Select>
                                      </div>
                                    </div>
                                  </details>
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
                                  <div className="space-y-1.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Select
                                        aria-label="Condition source field"
                                        value={block.showIf.fieldKey}
                                        onChange={(e) =>
                                          handleUpdateBlock(block.blockId, {
                                            showIf: {
                                              ...block.showIf!,
                                              fieldKey: e.target.value,
                                            },
                                          })
                                        }
                                        className="w-56"
                                      >
                                        {allAvailableFieldKeys.map((fk) => (
                                          <option key={fk.key} value={fk.key}>
                                            {fk.label}
                                          </option>
                                        ))}
                                      </Select>
                                      <span>equals</span>
                                      <Input
                                        aria-label="Condition match value"
                                        placeholder="true"
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
                                    <p className="text-xs text-pine/65">
                                      For checkboxes, enter &ldquo;true&rdquo; or &ldquo;false&rdquo;.
                                      For dropdowns, enter the stored option value.
                                    </p>
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
            </>
          )}
        </div>
      )}

      {/* Tab 3: Vision, Mission, Clinic Overview & Impact */}
      {activeTab === 'overview' && (
        <Card className="space-y-6">
          <div className="border-b border-mist pb-3">
            <h2 className="font-heading text-2xl font-medium text-pine">
              Vision, Mission, Clinic Overview &amp; Impact Narrative
            </h2>
          </div>

          {cmsError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900 flex items-center justify-between gap-2"
            >
              <span>
                {getFriendlyErrorMessage(
                  cmsError,
                  'Could not load institutional overview copy.'
                )}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refetchCms()}
                disabled={isRefetchingCms}
                className="shrink-0"
              >
                {isRefetchingCms ? 'Retrying…' : 'Try Again'}
              </Button>
            </div>
          )}

          {overviewStatusMsg && (
            <div
              role="status"
              className="rounded-lg border border-sage/50 bg-surface-sunken p-3 text-xs text-pine font-medium"
            >
              {overviewStatusMsg}
            </div>
          )}

          {overviewErrorMsg && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900"
            >
              {overviewErrorMsg}
            </div>
          )}

          {isLoadingCms ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
              </div>
              <Skeleton className="h-24" />
              <Skeleton className="h-20" />
            </div>
          ) : (
          <form
            onSubmit={overviewForm.handleSubmit((vals) => {
              setOverviewStatusMsg(null);
              setOverviewErrorMsg(null);
              saveCmsMutation.mutate(vals);
            })}
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
              {overviewForm.formState.errors.impactNarrative && (
                <p className="text-xs text-red-700 mt-1">
                  {overviewForm.formState.errors.impactNarrative.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="cms-evaluation-form-url">
                Post-Session Evaluation Form Link (Google Form URL)
              </Label>
              <Input
                id="cms-evaluation-form-url"
                type="url"
                placeholder="https://docs.google.com/forms/..."
                {...overviewForm.register('evaluationFormUrl')}
              />
              <p className="text-xs text-pine/65 mt-1">
                Sent to clients by email and shown on completed bookings.
              </p>
              {overviewForm.formState.errors.evaluationFormUrl && (
                <p className="text-xs text-red-700 mt-1">
                  {overviewForm.formState.errors.evaluationFormUrl.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={saveCmsMutation.isPending}
            >
              {saveCmsMutation.isPending ? 'Saving…' : 'Save Overview'}
            </Button>
          </form>
          )}
        </Card>
      )}

      {/* Tab 4: Testimonials CMS (Live Backend CRUD) */}
      {activeTab === 'structures' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <Card className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between border-b border-mist pb-3">
              <div>
                <h2 className="font-heading text-2xl font-medium text-pine">
                  Testimonials
                </h2>
                <p className="text-xs text-pine/70">
                  {testimonials.length} total reflections
                </p>
              </div>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() =>
                  guardTestimonialSwitch(() => {
                    setTestimonialStatusMsg(null);
                    setTestimonialErrorMsg(null);
                    setIsCreatingTestimonial(true);
                  })
                }
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                New Testimonial
              </Button>
            </div>

            {cmsError && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900 flex items-center justify-between gap-2"
              >
                <span>
                  {getFriendlyErrorMessage(
                    cmsError,
                    'Could not load testimonials.'
                  )}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => refetchCms()}
                  disabled={isRefetchingCms}
                  className="shrink-0"
                >
                  {isRefetchingCms ? 'Retrying…' : 'Try Again'}
                </Button>
              </div>
            )}

            <div className="space-y-2">
              {isLoadingCms ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24" />
                ))
              ) : (
                testimonials.map((item) => {
                  const isSelected =
                    !isCreatingTestimonial && currentTestimonial?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        guardTestimonialSwitch(() => {
                          setTestimonialStatusMsg(null);
                          setTestimonialErrorMsg(null);
                          setIsCreatingTestimonial(false);
                          setEditingTestimonialId(item.id);
                        })
                      }
                      className={`w-full text-left p-3.5 rounded-xl border text-xs transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-sage bg-surface-sunken'
                          : 'border-mist bg-surface-raised hover:border-mint hover:bg-surface-sunken/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-accent-ink">
                          {item.serviceCategory}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            item.isActive
                              ? 'bg-sage/20 text-pine'
                              : 'bg-mist/70 text-pine/60'
                          }`}
                        >
                          {item.isActive ? 'Published' : 'Hidden'}
                        </span>
                      </div>
                      <p className="text-pine mt-1.5 line-clamp-2 leading-relaxed">
                        &ldquo;{item.quote}&rdquo;
                      </p>
                      <p className="text-pine/65 mt-1 font-medium">
                        — {item.authorLabel}
                      </p>
                    </button>
                  );
                })
              )}
              {!isLoadingCms && testimonials.length === 0 && (
                <p className="text-xs text-pine/70 py-4 text-center">
                  No testimonials yet.
                </p>
              )}
            </div>
          </Card>

          <Card className="lg:col-span-7 space-y-5">
            <div className="border-b border-mist pb-3 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-accent-ink">
                  {isCreatingTestimonial
                    ? 'Adding New Reflection'
                    : 'Editing Reflection'}
                </p>
                <h2 className="font-heading text-2xl font-medium text-pine">
                  {isCreatingTestimonial
                    ? 'New Client Testimonial'
                    : currentTestimonial?.authorLabel || 'Select a testimonial'}
                </h2>
              </div>
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
                className="rounded-lg border border-sage/50 bg-surface-sunken p-3 text-xs text-pine font-medium"
              >
                {testimonialStatusMsg}
              </div>
            )}

            {testimonialErrorMsg && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900"
              >
                {testimonialErrorMsg}
              </div>
            )}

            <form
              onSubmit={testimonialForm.handleSubmit((vals) => {
                setTestimonialStatusMsg(null);
                setTestimonialErrorMsg(null);
                saveTestimonialMutation.mutate(vals);
              })}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="t-quote">Reflection Quote</Label>
                <Textarea
                  id="t-quote"
                  rows={4}
                  placeholder="Share an anonymized client reflection…"
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
                    {...testimonialForm.register('serviceCategory')}
                  />
                  {testimonialForm.formState.errors.serviceCategory && (
                    <p className="text-xs text-red-700 mt-1">
                      {testimonialForm.formState.errors.serviceCategory.message}
                    </p>
                  )}
                </div>
              </div>

              <label className="flex items-center gap-3 p-3.5 rounded-xl border border-mist bg-surface-sunken/50 text-xs text-pine cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-mist accent-sage cursor-pointer"
                  {...testimonialForm.register('isActive')}
                />
                <span className="font-semibold">
                  Published on public homepage carousel
                </span>
              </label>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={saveTestimonialMutation.isPending}
                >
                  {saveTestimonialMutation.isPending
                    ? 'Saving…'
                    : isCreatingTestimonial
                      ? 'Add Testimonial'
                      : 'Save Testimonial'}
                </Button>

                {!isCreatingTestimonial && currentTestimonial && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={deleteTestimonialMutation.isPending}
                    onClick={() =>
                      setConfirmDialog({
                        title: 'Delete this testimonial?',
                        description: currentTestimonial.authorLabel,
                        body: 'This reflection will be permanently deleted and removed from the public homepage carousel.',
                        confirmLabel: 'Delete Testimonial',
                        confirmVariant: 'danger',
                        onConfirm: () => {
                          setConfirmDialog(null);
                          setTestimonialStatusMsg(null);
                          setTestimonialErrorMsg(null);
                          deleteTestimonialMutation.mutate(currentTestimonial.id);
                        },
                      })
                    }
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-700" aria-hidden="true" />
                    Delete
                  </Button>
                )}
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Interactive Wizard & Consent Form Preview Modal */}
      {(() => {
        const previewPages = wizardPages.length > 0 ? wizardPages : DEFAULT_WIZARD_PAGES;
        const safePreviewStep = Math.min(Math.max(1, previewStep), previewPages.length);
        const activePreviewPage = previewPages[safePreviewStep - 1] || previewPages[0];
        const previewVersion = activeTemplate?.consentVersion || 'v2';

        return (
          <Modal
            open={isPreviewOpen}
            onClose={() => setIsPreviewOpen(false)}
            maxWidth="2xl"
            title={activePreviewPage?.title || 'Wizard Preview'}
            description={`Interactive Client Preview · Step ${safePreviewStep} of ${previewPages.length} · Consent ${previewVersion}${
              hasWizardChanges ? ' (unsaved draft)' : ''
            }`}
            footer={
              <div className="flex flex-wrap items-center justify-between gap-3 w-full">
                <span className="text-xs text-pine/65">
                  Preview mode — no data is submitted.
                </span>
                <div className="flex items-center gap-2">
                  {safePreviewStep > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewStep(safePreviewStep - 1)}
                    >
                      Back
                    </Button>
                  )}
                  {safePreviewStep < previewPages.length ? (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => setPreviewStep(safePreviewStep + 1)}
                    >
                      Next
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => setIsPreviewOpen(false)}
                    >
                      Close Preview
                    </Button>
                  )}
                </div>
              </div>
            }
          >
            <div className="space-y-5">
              {/* Step progress bar */}
              <ol className="flex items-center gap-2" aria-label="Preview wizard progress">
                {previewPages.map((p, idx) => {
                  const stepNum = idx + 1;
                  return (
                    <li key={p.pageId} className="flex-1">
                      <button
                        type="button"
                        onClick={() => setPreviewStep(stepNum)}
                        title={`Step ${stepNum}: ${p.title}`}
                        className="w-full py-1 cursor-pointer"
                      >
                        <div
                          className={`h-1.5 rounded-full transition-colors ${
                            stepNum <= safePreviewStep ? 'bg-sage' : 'bg-mist/60'
                          }`}
                        />
                      </button>
                    </li>
                  );
                })}
              </ol>

              {activePreviewPage?.description && (
                <p className="text-xs text-pine/75">{activePreviewPage.description}</p>
              )}

              <div className="space-y-4">
                {activePreviewPage?.blocks.map((block) => {
                  if (block.blockId === 'who_for') return null;
                  if (!isWizardBlockVisible(block, false, previewValues)) return null;

                  if (block.type === 'scrollable_doc') {
                    return (
                      <div key={block.blockId}>
                        <Label variant="doc">
                          {block.label} ({previewVersion})
                        </Label>
                        <div className="mt-1.5 max-h-44 overflow-y-auto p-4 rounded-lg bg-parchment border border-mist text-xs text-pine/90 leading-relaxed whitespace-pre-wrap">
                          {block.content}
                        </div>
                      </div>
                    );
                  }

                  if (block.type === 'services_list') {
                    const activeServices = services.filter((s) => s.isActive !== false);
                    return (
                      <div key={block.blockId} className="space-y-2">
                        <h3 className="font-heading text-base font-medium text-pine">
                          {block.label}
                        </h3>
                        <ul className="space-y-2">
                          {activeServices.map((s) => (
                            <li
                              key={s.id}
                              className="p-3 rounded-lg bg-parchment border border-mist space-y-1"
                            >
                              <p className="text-xs font-semibold text-pine">
                                {s.title}{' '}
                                <span className="font-normal text-accent-ink">
                                  · {s.durationLabel}
                                  {s.rateLabel ? ` · ${s.rateLabel}` : ''}
                                </span>
                              </p>
                              {s.description && (
                                <p className="text-xs text-pine/85 leading-relaxed">
                                  {s.description}
                                </p>
                              )}
                              {s.guardrailNotice && (
                                <p className="text-xs text-pine/70 italic">
                                  {s.guardrailNotice}
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  }

                  if (block.type === 'section_heading') {
                    return (
                      <div
                        key={block.blockId}
                        className="border-t border-mist/70 pt-3 space-y-1"
                      >
                        <span className="text-xs font-medium uppercase tracking-wider text-pine/60">
                          {block.label}
                        </span>
                        {block.content && (
                          <p className="text-xs text-pine/70">{block.content}</p>
                        )}
                      </div>
                    );
                  }

                  if (block.type === 'info_text') {
                    return (
                      <div
                        key={block.blockId}
                        className="p-3.5 rounded-lg bg-surface-sunken border border-mist text-xs text-pine/85 leading-relaxed"
                      >
                        {block.content || block.label}
                      </div>
                    );
                  }

                  if (block.type === 'review_summary') {
                    const groups = previewPages
                      .map((p, idx) => {
                        if (p.pageId === activePreviewPage.pageId) return null;
                        const rows: [string, string][] = [];
                        for (const b of p.blocks) {
                          if (!INPUT_BLOCK_TYPES.has(b.type) || !b.fieldKey) continue;
                          if (!isWizardBlockVisible(b, false, previewValues)) continue;
                          const raw = previewValues[b.fieldKey];
                          const formatted =
                            b.type === 'checkbox'
                              ? raw
                                ? 'Yes'
                                : 'No'
                              : raw != null && String(raw).trim() !== ''
                                ? String(raw)
                                : '—';
                          rows.push([b.label, formatted]);
                        }
                        return rows.length > 0
                          ? { title: p.title, step: idx + 1, rows }
                          : null;
                      })
                      .filter((g): g is NonNullable<typeof g> => g !== null);

                    return (
                      <div
                        key={block.blockId}
                        className="rounded-lg border border-mist overflow-hidden"
                      >
                        {groups.map((group) => (
                          <div
                            key={`${group.title}-${group.step}`}
                            className="border-b border-mist last:border-b-0"
                          >
                            <div className="flex items-center justify-between px-3.5 py-2 border-b border-mist bg-surface-sunken/40">
                              <p className="text-xs font-medium uppercase tracking-wider text-pine/60">
                                {group.title}
                              </p>
                              <button
                                type="button"
                                onClick={() => setPreviewStep(group.step)}
                                className="text-xs font-medium text-sage hover:text-pine cursor-pointer"
                              >
                                Edit
                              </button>
                            </div>
                            <dl className="px-3.5 py-2 space-y-1">
                              {group.rows.map(([k, v]) => (
                                <div key={k} className="flex justify-between gap-4 text-xs">
                                  <dt className="text-pine/65">{k}</dt>
                                  <dd className="font-medium text-pine text-right">{v}</dd>
                                </div>
                              ))}
                            </dl>
                          </div>
                        ))}
                      </div>
                    );
                  }

                  const key = block.fieldKey || block.blockId;
                  const val = previewValues[key];
                  const setPreviewField = (nextVal: unknown) =>
                    setPreviewValues((prev) => ({ ...prev, [key]: nextVal }));

                  if (block.type === 'checkbox') {
                    return (
                      <label
                        key={block.blockId}
                        className="flex items-start gap-3 text-xs text-pine cursor-pointer p-3 rounded-xl border border-mist hover:border-mint transition-colors"
                      >
                        <Checkbox
                          className="mt-0.5"
                          checked={Boolean(val)}
                          onChange={(e) => setPreviewField(e.target.checked)}
                        />
                        <span className="leading-relaxed">{block.label}</span>
                      </label>
                    );
                  }

                  if (block.type === 'select') {
                    const strVal = val == null ? '' : String(val);
                    return (
                      <div key={block.blockId}>
                        <Label>
                          {block.label}
                          {block.required ? ' *' : ''}
                        </Label>
                        <Select
                          value={strVal}
                          onChange={(e) => setPreviewField(e.target.value)}
                        >
                          <option value="">Select an option…</option>
                          {block.options.map((opt) => (
                            <option
                              key={`${block.blockId}-${opt.value}`}
                              value={opt.value}
                            >
                              {opt.label}
                            </option>
                          ))}
                        </Select>
                        {block.helperText && (
                          <p className="text-xs text-pine/70 mt-1">{block.helperText}</p>
                        )}
                      </div>
                    );
                  }

                  if (block.type === 'textarea') {
                    return (
                      <div key={block.blockId}>
                        <Label>
                          {block.label}
                          {block.required ? ' *' : ''}
                        </Label>
                        <Textarea
                          rows={2}
                          value={val == null ? '' : String(val)}
                          placeholder={block.placeholder || undefined}
                          onChange={(e) => setPreviewField(e.target.value)}
                        />
                        {block.helperText && (
                          <p className="text-xs text-pine/70 mt-1">{block.helperText}</p>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div key={block.blockId}>
                      <Label>
                        {block.label}
                        {block.required ? ' *' : ''}
                      </Label>
                      <Input
                        type={
                          block.type === 'date'
                            ? 'date'
                            : block.type === 'phone'
                              ? 'tel'
                              : 'text'
                        }
                        value={val == null ? '' : String(val)}
                        placeholder={block.placeholder || undefined}
                        onChange={(e) => setPreviewField(e.target.value)}
                      />
                      {block.helperText && (
                        <p className="text-xs text-pine/70 mt-1">{block.helperText}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* Shared Destructive & Unsaved-Changes Confirmation Modal */}
      <Modal
        open={Boolean(confirmDialog)}
        onClose={() => setConfirmDialog(null)}
        title={confirmDialog?.title ?? ''}
        description={confirmDialog?.description}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setConfirmDialog(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={confirmDialog?.confirmVariant ?? 'danger'}
              size="md"
              onClick={() => confirmDialog?.onConfirm()}
            >
              {confirmDialog?.confirmLabel ?? 'Confirm'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-pine/85 leading-relaxed">
          {confirmDialog?.body}
        </p>
      </Modal>
    </div>
  );
}
