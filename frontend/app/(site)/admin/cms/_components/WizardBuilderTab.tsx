'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Eye,
  GripVertical,
  History,
  Lock,
  Plus,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { DEFAULT_WIZARD_PAGES, didConsentBlocksChange } from '@/lib/consent';
import type {
  ServiceItem,
  WizardAppliesTo,
  WizardBlock,
  WizardBlockType,
  WizardFieldTarget,
  WizardPage,
} from '@/lib/types';
import { useAppStore } from '@/stores/useAppStore';
import {
  Button,
  Checkbox,
  Input,
  Label,
  Select,
  Skeleton,
  Textarea,
} from '@/components/ui/primitives';
import { WizardPreviewModal } from './WizardPreviewModal';

const BLOCK_TYPE_LABELS: Record<WizardBlockType, string> = {
  text: 'Text',
  textarea: 'Long text',
  select: 'Dropdown',
  checkbox: 'Checkbox',
  date: 'Date',
  phone: 'Phone',
  scrollable_doc: 'Legal document',
  info_text: 'Info notice',
  section_heading: 'Section heading',
  services_list: 'Services list',
  review_summary: 'Review summary',
};

const BLOCK_TYPE_OPTIONS: { value: WizardBlockType; label: string }[] = [
  { value: 'text', label: 'Text input' },
  { value: 'textarea', label: 'Long text' },
  { value: 'select', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox / acknowledgement' },
  { value: 'date', label: 'Date picker' },
  { value: 'phone', label: 'Phone number' },
  { value: 'scrollable_doc', label: 'Scrollable legal document' },
  { value: 'info_text', label: 'Info notice' },
  { value: 'section_heading', label: 'Section heading' },
  { value: 'services_list', label: 'Active services list (read-only)' },
  { value: 'review_summary', label: 'Entries review summary' },
];

const ADD_BLOCK_GROUPS: {
  heading: string;
  items: { type: WizardBlockType; label: string }[];
}[] = [
  {
    heading: 'Input fields',
    items: [
      { type: 'text', label: 'Text question' },
      { type: 'textarea', label: 'Long text question' },
      { type: 'select', label: 'Dropdown' },
      { type: 'checkbox', label: 'Checkbox / consent ack' },
      { type: 'date', label: 'Date field' },
      { type: 'phone', label: 'Phone field' },
    ],
  },
  {
    heading: 'Content & legal',
    items: [
      { type: 'scrollable_doc', label: 'Scrollable legal document' },
      { type: 'info_text', label: 'Info notice' },
      { type: 'section_heading', label: 'Section heading' },
    ],
  },
];

const INPUT_BLOCK_TYPES = new Set<WizardBlockType>([
  'text',
  'textarea',
  'select',
  'checkbox',
  'date',
  'phone',
]);

function summarizeBlockMeta(block: WizardBlock): string {
  const parts: string[] = [BLOCK_TYPE_LABELS[block.type] || block.type];
  if (block.target === 'consent') parts.push('Consent');
  else if (block.systemLocked) parts.push('Core field');
  if (block.appliesTo === 'self') parts.push('Self only');
  else if (block.appliesTo === 'dependent') parts.push('Dependent only');
  if (block.showIf) parts.push('Conditional');
  return parts.join(' · ');
}

interface WizardBuilderTabProps {
  services: ServiceItem[];
}

export function WizardBuilderTab({ services }: WizardBuilderTabProps) {
  const queryClient = useQueryClient();
  const { publishFlowEvent } = useAppStore();

  const {
    data: activeTemplate,
    isLoading: isLoadingTemplate,
    isError: isTemplateError,
  } = useQuery({
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
  const [advancedOpenIds, setAdvancedOpenIds] = useState<
    Record<string, boolean>
  >({});
  const [bumpType, setBumpType] = useState<'auto' | 'minor' | 'major'>('auto');
  const [wizardStatusMsg, setWizardStatusMsg] = useState<string | null>(null);
  const [wizardErrorMsg, setWizardErrorMsg] = useState<string | null>(null);
  const [reorderAnnouncement, setReorderAnnouncement] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

  // Drag-and-drop state for step reordering
  const [draggedStepIdx, setDraggedStepIdx] = useState<number | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    idx: number;
    position: 'before' | 'after';
  } | null>(null);

  const historyRef = useRef<HTMLDivElement | null>(null);
  const addMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeTemplate?.wizardPages && activeTemplate.wizardPages.length > 0) {
      setWizardPages(
        JSON.parse(JSON.stringify(activeTemplate.wizardPages)) as WizardPage[]
      );
    }
  }, [activeTemplate]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (
        isHistoryOpen &&
        historyRef.current &&
        !historyRef.current.contains(e.target as Node)
      ) {
        setIsHistoryOpen(false);
      }
      if (
        isAddMenuOpen &&
        addMenuRef.current &&
        !addMenuRef.current.contains(e.target as Node)
      ) {
        setIsAddMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isHistoryOpen) setIsHistoryOpen(false);
        if (isAddMenuOpen) setIsAddMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isHistoryOpen, isAddMenuOpen]);

  const baselinePages = useMemo(
    () =>
      activeTemplate?.wizardPages && activeTemplate.wizardPages.length > 0
        ? activeTemplate.wizardPages
        : DEFAULT_WIZARD_PAGES,
    [activeTemplate]
  );

  const hasWizardChanges = useMemo(
    () => JSON.stringify(baselinePages) !== JSON.stringify(wizardPages),
    [baselinePages, wizardPages]
  );

  const consentBlocksModified = useMemo(
    () => didConsentBlocksChange(baselinePages, wizardPages),
    [baselinePages, wizardPages]
  );

  const willTriggerMajorBump =
    bumpType === 'major' || (bumpType === 'auto' && consentBlocksModified);

  const currentPage = wizardPages[selectedPageIdx] || wizardPages[0];
  const activeVersion = activeTemplate?.consentVersion || 'v2';

  const allAvailableFields = useMemo(() => {
    const fields: { key: string; label: string; type: WizardBlockType }[] = [];
    for (const p of wizardPages) {
      for (const b of p.blocks) {
        if (b.fieldKey) {
          fields.push({ key: b.fieldKey, label: b.label, type: b.type });
        }
      }
    }
    return fields;
  }, [wizardPages]);

  const updateCurrentPage = (updater: (page: WizardPage) => WizardPage) => {
    setWizardPages((prev) =>
      prev.map((page, idx) => (idx === selectedPageIdx ? updater(page) : page))
    );
  };

  const reorderStep = (fromIdx: number, targetIdx: number) => {
    if (
      fromIdx < 0 ||
      fromIdx >= wizardPages.length ||
      targetIdx < 0 ||
      targetIdx >= wizardPages.length ||
      fromIdx === targetIdx
    ) {
      return;
    }
    const selectedId = wizardPages[selectedPageIdx]?.pageId;
    const movedTitle = wizardPages[fromIdx]?.title || `Step ${fromIdx + 1}`;

    const next = [...wizardPages];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(targetIdx, 0, moved);

    setWizardPages(next);
    if (selectedId) {
      const nextSelected = next.findIndex((p) => p.pageId === selectedId);
      if (nextSelected >= 0) setSelectedPageIdx(nextSelected);
    }
    setReorderAnnouncement(
      `Moved "${movedTitle}" to step ${targetIdx + 1} of ${next.length}.`
    );
  };

  const handleAddPage = () => {
    const nextNum = wizardPages.length + 1;
    const suffix = Date.now().toString(36).slice(-4);
    const newPageId = `step-${nextNum}-${suffix}`;
    const newBlockId = `custom_field_${suffix}`;
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
    reorderStep(idx, idx + direction);
  };

  const handleStepDragStart = (
    e: React.DragEvent<HTMLLIElement>,
    idx: number
  ) => {
    setDraggedStepIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
  };

  const handleStepDragOver = (
    e: React.DragEvent<HTMLLIElement>,
    idx: number
  ) => {
    if (draggedStepIdx === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const position: 'before' | 'after' =
      e.clientY < midpoint ? 'before' : 'after';
    if (
      dropIndicator?.idx !== idx ||
      dropIndicator?.position !== position
    ) {
      setDropIndicator({ idx, position });
    }
  };

  const handleStepDrop = (
    e: React.DragEvent<HTMLLIElement>,
    idx: number
  ) => {
    e.preventDefault();
    if (draggedStepIdx === null) return;
    const position = dropIndicator?.idx === idx ? dropIndicator.position : 'after';
    let targetIdx = position === 'before' ? idx : idx + 1;
    if (draggedStepIdx < targetIdx) {
      targetIdx -= 1;
    }
    reorderStep(draggedStepIdx, targetIdx);
    setDraggedStepIdx(null);
    setDropIndicator(null);
  };

  const handleStepDragEnd = () => {
    setDraggedStepIdx(null);
    setDropIndicator(null);
  };

  const handleDeletePage = (idx: number) => {
    if (wizardPages.length <= 1) return;
    const page = wizardPages[idx];
    if (page.blocks.some((b) => b.systemLocked)) return;
    setWizardPages((prev) => prev.filter((_, i) => i !== idx));
    setSelectedPageIdx((prev) =>
      Math.max(0, Math.min(prev, wizardPages.length - 2))
    );
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
    setIsAddMenuOpen(false);
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
    if (expandedBlockId === blockId) {
      setExpandedBlockId(null);
    }
  };

  const saveWizardMutation = useMutation({
    mutationFn: () => {
      setWizardStatusMsg(null);
      setWizardErrorMsg(null);
      return api.updateActiveConsentForm({
        consentVersion: activeVersion,
        bumpType,
        wizardPages,
      });
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['consentForm'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      setBumpType('auto');
      setWizardStatusMsg(
        `Published version ${saved.consentVersion} (${saved.wizardPages.length} steps).`
      );
      publishFlowEvent(
        'Forms & Consent Published',
        `Active form version is now ${saved.consentVersion}.`
      );
    },
    onError: (err) => {
      setWizardErrorMsg(
        err instanceof Error ? err.message : 'Could not publish form.'
      );
    },
  });

  if (isLoadingTemplate) {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Loading form editor">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-7 w-28" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Skeleton className="lg:col-span-4 h-72 rounded-2xl" />
          <Skeleton className="lg:col-span-8 h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="sr-only" aria-live="polite">
        {reorderAnnouncement}
      </div>

      {isTemplateError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-900"
        >
          Could not load the active form from the server. Showing default steps
          until connection is restored.
        </div>
      )}

      {/* Compact Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <span className="font-mono font-semibold text-pine bg-surface-sunken border border-mist px-2.5 py-1 rounded-md">
            Active: {activeVersion}
          </span>
          {hasWizardChanges && (
            <span
              className={`font-medium px-2.5 py-1 rounded-md border ${
                willTriggerMajorBump
                  ? 'border-amber-300 bg-amber-50 text-amber-950'
                  : 'border-sage/40 bg-surface-sunken text-accent-ink'
              }`}
            >
              {willTriggerMajorBump
                ? 'Unsaved · Major update (re-sign)'
                : 'Unsaved · Minor update'}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {templateHistory.length > 0 && (
            <div ref={historyRef} className="relative">
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-haspopup="menu"
                aria-expanded={isHistoryOpen}
                onClick={() => setIsHistoryOpen((o) => !o)}
              >
                <History className="w-3.5 h-3.5" aria-hidden="true" />
                History ({templateHistory.length})
              </Button>
              {isHistoryOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-mist bg-surface-raised shadow-lift z-30 py-1.5"
                >
                  <p className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-pine/70 border-b border-mist">
                    Load a saved version
                  </p>
                  <div className="max-h-60 overflow-y-auto divide-y divide-mist/60">
                    {templateHistory.map((tpl) => (
                      <button
                        key={tpl.templateId}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setWizardPages(
                            JSON.parse(
                              JSON.stringify(tpl.wizardPages)
                            ) as WizardPage[]
                          );
                          setSelectedPageIdx(0);
                          setExpandedBlockId(null);
                          setIsHistoryOpen(false);
                          setWizardStatusMsg(
                            `Loaded ${tpl.consentVersion} into the editor.`
                          );
                        }}
                        className="w-full px-3 py-2 text-left text-xs hover:bg-surface-sunken focus-visible:bg-surface-sunken focus-visible:outline-none flex items-center justify-between gap-2 cursor-pointer transition-colors"
                      >
                        <span className="font-mono font-medium text-pine">
                          {tpl.consentVersion}
                        </span>
                        <span className="text-pine/70">
                          {tpl.isActive
                            ? 'Active'
                            : `${tpl.wizardPages.length} steps`}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsPreviewOpen(true)}
          >
            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
            Preview
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => saveWizardMutation.mutate()}
            disabled={!hasWizardChanges || saveWizardMutation.isPending}
          >
            {saveWizardMutation.isPending ? 'Publishing…' : 'Publish'}
          </Button>
        </div>
      </div>

      {/* Dirty-only Version Impact Strip */}
      {hasWizardChanges && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            willTriggerMajorBump
              ? 'border-amber-300 bg-amber-50 text-amber-950'
              : 'border-sage/40 bg-surface-sunken text-pine'
          }`}
        >
          <p className="leading-relaxed">
            {willTriggerMajorBump ? (
              <>
                <strong>Major version bump:</strong> consent copy or rules
                changed. Existing clients will be asked to re-sign before their
                next booking.
              </>
            ) : (
              <>
                <strong>Minor update:</strong> only profile or UI fields
                changed. Existing clients will not need to re-sign.
              </>
            )}
          </p>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <label className="sr-only" htmlFor="wiz-bump-type">
              Versioning mode
            </label>
            <Select
              id="wiz-bump-type"
              value={bumpType}
              onChange={(e) =>
                setBumpType(e.target.value as 'auto' | 'minor' | 'major')
              }
              className="w-44 py-1 text-xs"
            >
              <option value="auto">Version: Auto-detect</option>
              <option value="minor">Force minor (no re-sign)</option>
              <option value="major">Force major (re-sign)</option>
            </Select>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setWizardPages(
                  JSON.parse(JSON.stringify(baselinePages)) as WizardPage[]
                );
                setBumpType('auto');
                setWizardStatusMsg(null);
              }}
            >
              Discard
            </Button>
          </div>
        </div>
      )}

      {wizardStatusMsg && (
        <div
          role="status"
          className="rounded-lg border border-sage/40 bg-surface-sunken px-4 py-2.5 text-xs text-pine font-medium"
        >
          {wizardStatusMsg}
        </div>
      )}

      {wizardErrorMsg && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-900"
        >
          {wizardErrorMsg}
        </div>
      )}

      {/* Two-Column Builder Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Draggable Step Outline */}
        <section
          aria-label="Form steps"
          className="lg:col-span-4 rounded-2xl border border-mist bg-surface-raised overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-mist">
            <h2 className="text-sm font-semibold text-pine">
              Steps ({wizardPages.length})
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleAddPage}
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              Add step
            </Button>
          </div>

          <ul className="divide-y divide-mist">
            {wizardPages.map((page, idx) => {
              const isSelected = idx === selectedPageIdx;
              const hasLockedBlock = page.blocks.some((b) => b.systemLocked);
              const isDragging = draggedStepIdx === idx;
              const showBeforeLine =
                dropIndicator?.idx === idx &&
                dropIndicator.position === 'before' &&
                draggedStepIdx !== idx;
              const showAfterLine =
                dropIndicator?.idx === idx &&
                dropIndicator.position === 'after' &&
                draggedStepIdx !== idx;

              return (
                <li
                  key={page.pageId}
                  draggable={wizardPages.length > 1}
                  onDragStart={(e) => handleStepDragStart(e, idx)}
                  onDragOver={(e) => handleStepDragOver(e, idx)}
                  onDrop={(e) => handleStepDrop(e, idx)}
                  onDragEnd={handleStepDragEnd}
                  className={`relative group flex items-center justify-between gap-2 px-3 py-3 transition-colors ${
                    isDragging
                      ? 'opacity-45 bg-surface-sunken'
                      : isSelected
                        ? 'bg-surface-sunken'
                        : 'hover:bg-surface-sunken/50'
                  }`}
                >
                  {showBeforeLine && (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-sage z-10"
                    />
                  )}
                  {showAfterLine && (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-sage z-10"
                    />
                  )}

                  {wizardPages.length > 1 && (
                    <span
                      title="Drag to reorder step"
                      aria-hidden="true"
                      className="text-pine/45 group-hover:text-pine/75 cursor-grab active:cursor-grabbing p-0.5 shrink-0"
                    >
                      <GripVertical className="w-4 h-4" />
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPageIdx(idx);
                      setExpandedBlockId(null);
                    }}
                    className="text-left flex-1 min-w-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-sage rounded"
                  >
                    <p
                      className={`text-sm truncate ${
                        isSelected
                          ? 'font-semibold text-pine'
                          : 'font-medium text-pine/90'
                      }`}
                    >
                      {idx + 1}. {page.title}
                    </p>
                    <p className="text-xs text-pine/70 mt-0.5 tabular-nums">
                      {page.blocks.length}{' '}
                      {page.blocks.length === 1 ? 'block' : 'blocks'}
                    </p>
                  </button>

                  <div
                    className={`flex items-center gap-0.5 shrink-0 transition-opacity ${
                      isSelected
                        ? 'opacity-100'
                        : 'opacity-70 group-hover:opacity-100 focus-within:opacity-100'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleMovePage(idx, -1)}
                      disabled={idx === 0}
                      aria-label={`Move step ${page.title} up`}
                      className="p-1.5 rounded text-pine/70 hover:text-pine hover:bg-surface-raised disabled:opacity-25 cursor-pointer focus-visible:outline-2 focus-visible:outline-sage"
                    >
                      <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMovePage(idx, 1)}
                      disabled={idx === wizardPages.length - 1}
                      aria-label={`Move step ${page.title} down`}
                      className="p-1.5 rounded text-pine/70 hover:text-pine hover:bg-surface-raised disabled:opacity-25 cursor-pointer focus-visible:outline-2 focus-visible:outline-sage"
                    >
                      <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePage(idx)}
                      disabled={hasLockedBlock || wizardPages.length <= 1}
                      title={
                        hasLockedBlock
                          ? 'Move locked core fields to another step before deleting'
                          : 'Delete step'
                      }
                      aria-label={`Delete step ${page.title}`}
                      className="p-1.5 rounded text-pine/65 hover:text-red-700 disabled:opacity-25 cursor-pointer focus-visible:outline-2 focus-visible:outline-sage"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {wizardPages.length > 1 && (
            <p className="px-4 py-2.5 border-t border-mist text-xs text-pine/65">
              Drag steps or use the arrows to reorder.
            </p>
          )}
        </section>

        {/* Right: Selected Step & Blocks */}
        {currentPage && (
          <section
            aria-label={`Editing step ${selectedPageIdx + 1}`}
            className="lg:col-span-8 rounded-2xl border border-mist bg-surface-raised"
          >
            {/* Step Metadata */}
            <div className="p-5 border-b border-mist space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-pine">
                  Step {selectedPageIdx + 1} of {wizardPages.length}
                </h2>
                <span className="text-xs text-pine/70 tabular-nums">
                  {currentPage.blocks.length}{' '}
                  {currentPage.blocks.length === 1 ? 'block' : 'blocks'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="page-title">Step Title</Label>
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
                  <Label htmlFor="page-desc">Subtitle (Optional)</Label>
                  <Input
                    id="page-desc"
                    value={currentPage.description || ''}
                    placeholder="Short guidance shown under the title"
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

            {/* Flat Divided Blocks List */}
            <div className="divide-y divide-mist">
              {currentPage.blocks.map((block, bIdx) => {
                const isExpanded = expandedBlockId === block.blockId;
                const isInput = INPUT_BLOCK_TYPES.has(block.type);
                const isAdvancedOpen = Boolean(advancedOpenIds[block.blockId]);
                const triggerField = block.showIf
                  ? allAvailableFields.find(
                      (f) => f.key === block.showIf?.fieldKey
                    )
                  : null;

                return (
                  <div
                    key={block.blockId}
                    className={
                      isExpanded ? 'bg-surface-sunken/35' : 'bg-surface-raised'
                    }
                  >
                    {/* Collapsed Row */}
                    <div className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        onClick={() =>
                          setExpandedBlockId(isExpanded ? null : block.blockId)
                        }
                        className="flex items-center gap-3 text-left flex-1 min-w-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-sage rounded"
                      >
                        <ChevronDown
                          className={`w-4 h-4 text-pine/65 shrink-0 transition-transform duration-150 ${
                            isExpanded ? 'rotate-180 text-pine' : ''
                          }`}
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-pine truncate flex items-center gap-1.5">
                            <span className="truncate">{block.label}</span>
                            {block.required && (
                              <span
                                className="text-accent-ink font-semibold"
                                aria-label="Required"
                              >
                                *
                              </span>
                            )}
                            {block.systemLocked && (
                              <Lock
                                className="w-3.5 h-3.5 text-pine/65 shrink-0"
                                aria-label="Core locked field"
                              />
                            )}
                          </p>
                          <p className="text-xs text-pine/70 mt-0.5 truncate">
                            {summarizeBlockMeta(block)}
                          </p>
                        </div>
                      </button>

                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMoveBlock(bIdx, -1)}
                          disabled={bIdx === 0}
                          aria-label={`Move ${block.label} up`}
                          className="p-1.5 rounded text-pine/70 hover:text-pine hover:bg-surface-sunken disabled:opacity-25 cursor-pointer focus-visible:outline-2 focus-visible:outline-sage"
                        >
                          <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveBlock(bIdx, 1)}
                          disabled={bIdx === currentPage.blocks.length - 1}
                          aria-label={`Move ${block.label} down`}
                          className="p-1.5 rounded text-pine/70 hover:text-pine hover:bg-surface-sunken disabled:opacity-25 cursor-pointer focus-visible:outline-2 focus-visible:outline-sage"
                        >
                          <ArrowDown
                            className="w-3.5 h-3.5"
                            aria-hidden="true"
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBlock(block.blockId)}
                          disabled={
                            block.systemLocked || currentPage.blocks.length <= 1
                          }
                          title={
                            block.systemLocked
                              ? 'Core fields cannot be deleted — edit label or move to another step'
                              : 'Delete block'
                          }
                          aria-label={`Delete ${block.label}`}
                          className="p-1.5 rounded text-pine/65 hover:text-red-700 disabled:opacity-25 cursor-pointer focus-visible:outline-2 focus-visible:outline-sage"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded Editor: Essential First, Advanced Disclosed */}
                    {isExpanded && (
                      <div className="px-4 sm:px-5 pb-5 pt-2 sm:pl-12 space-y-4 text-xs">
                        <div>
                          <Label htmlFor={`blk-lbl-${block.blockId}`}>
                            Label / Question
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

                        {(block.type === 'scrollable_doc' ||
                          block.type === 'info_text') && (
                          <div>
                            <Label htmlFor={`blk-content-${block.blockId}`}>
                              Document / Notice Text
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

                        {/* Compact Core Settings Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                          <div>
                            <Label htmlFor={`blk-type-${block.blockId}`}>
                              Type
                            </Label>
                            {block.systemLocked ? (
                              <p className="h-[38px] px-3 rounded-lg border border-mist bg-surface-sunken text-sm text-pine/80 flex items-center gap-1.5">
                                <Lock
                                  className="w-3.5 h-3.5 text-pine/65"
                                  aria-hidden="true"
                                />
                                {BLOCK_TYPE_LABELS[block.type]}
                              </p>
                            ) : (
                              <Select
                                id={`blk-type-${block.blockId}`}
                                value={block.type}
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
                            )}
                          </div>

                          <div>
                            <Label htmlFor={`blk-scope-${block.blockId}`}>
                              Applies To
                            </Label>
                            <Select
                              id={`blk-scope-${block.blockId}`}
                              value={block.appliesTo}
                              onChange={(e) =>
                                handleUpdateBlock(block.blockId, {
                                  appliesTo: e.target.value as WizardAppliesTo,
                                })
                              }
                            >
                              <option value="all">All profiles</option>
                              <option value="self">Self only</option>
                              <option value="dependent">Dependent only</option>
                            </Select>
                          </div>

                          {isInput && (
                            <label className="flex items-center gap-2.5 h-[38px] px-3 rounded-lg border border-mist bg-surface-raised cursor-pointer">
                              <Checkbox
                                checked={block.required}
                                onChange={(e) =>
                                  handleUpdateBlock(block.blockId, {
                                    required: e.target.checked,
                                  })
                                }
                              />
                              <span className="text-sm font-medium text-pine">
                                Required
                              </span>
                            </label>
                          )}
                        </div>

                        {/* Dropdown Options */}
                        {block.type === 'select' && (
                          <div className="space-y-2 pt-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium uppercase tracking-wider text-pine/70">
                                Options ({block.options.length})
                              </span>
                              <button
                                type="button"
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
                                className="inline-flex items-center gap-1 text-xs font-medium text-accent-ink hover:text-pine cursor-pointer focus-visible:outline-2 focus-visible:outline-sage rounded"
                              >
                                <Plus
                                  className="w-3.5 h-3.5"
                                  aria-hidden="true"
                                />
                                Add option
                              </button>
                            </div>

                            <div className="space-y-2">
                              {block.options.map((opt, optIdx) => (
                                <div
                                  key={`${block.blockId}-opt-${optIdx}`}
                                  className="flex items-center gap-2"
                                >
                                  <Input
                                    value={opt.label}
                                    placeholder="Display label"
                                    aria-label={`Option ${optIdx + 1} label`}
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
                                  <Input
                                    value={opt.value}
                                    placeholder="Stored value"
                                    aria-label={`Option ${optIdx + 1} stored value`}
                                    className="font-mono text-xs sm:max-w-[11rem]"
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
                                    className="p-1.5 rounded text-pine/65 hover:text-red-700 disabled:opacity-25 cursor-pointer focus-visible:outline-2 focus-visible:outline-sage"
                                    aria-label={`Remove option ${opt.label || optIdx + 1}`}
                                  >
                                    <Trash2
                                      className="w-3.5 h-3.5"
                                      aria-hidden="true"
                                    />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Progressive Disclosure: Advanced & Logic */}
                        <div className="pt-2 border-t border-mist/80">
                          <button
                            type="button"
                            aria-expanded={isAdvancedOpen}
                            onClick={() =>
                              setAdvancedOpenIds((prev) => ({
                                ...prev,
                                [block.blockId]: !prev[block.blockId],
                              }))
                            }
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-pine/75 hover:text-pine cursor-pointer focus-visible:outline-2 focus-visible:outline-sage rounded"
                          >
                            <SlidersHorizontal
                              className="w-3.5 h-3.5"
                              aria-hidden="true"
                            />
                            <span>
                              {isAdvancedOpen
                                ? 'Hide advanced & logic'
                                : 'Advanced & logic'}
                            </span>
                            {!isAdvancedOpen && block.showIf && (
                              <span className="text-accent-ink">
                                · Conditional
                              </span>
                            )}
                          </button>

                          {isAdvancedOpen && (
                            <div className="mt-4 space-y-4">
                              {isInput && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div>
                                    <Label htmlFor={`blk-ph-${block.blockId}`}>
                                      Placeholder
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
                                      Helper Text
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
                                </div>
                              )}

                              {/* Conditional Visibility */}
                              <div className="space-y-2">
                                <label className="flex items-center gap-2 cursor-pointer text-pine">
                                  <Checkbox
                                    checked={Boolean(block.showIf)}
                                    onChange={(e) =>
                                      handleUpdateBlock(block.blockId, {
                                        showIf: e.target.checked
                                          ? {
                                              fieldKey:
                                                allAvailableFields[0]?.key ||
                                                'is_overseas_or_foreign',
                                              equals: true,
                                            }
                                          : null,
                                      })
                                    }
                                  />
                                  <span className="font-medium">
                                    Only show when another field matches
                                  </span>
                                </label>

                                {block.showIf && (
                                  <div className="flex flex-wrap items-center gap-2 pl-6">
                                    <Select
                                      aria-label="Trigger field"
                                      value={block.showIf.fieldKey}
                                      onChange={(e) => {
                                        const nextField =
                                          allAvailableFields.find(
                                            (f) => f.key === e.target.value
                                          );
                                        handleUpdateBlock(block.blockId, {
                                          showIf: {
                                            fieldKey: e.target.value,
                                            equals:
                                              nextField?.type === 'checkbox'
                                                ? true
                                                : '',
                                          },
                                        });
                                      }}
                                      className="sm:w-64"
                                    >
                                      {allAvailableFields.map((fk) => (
                                        <option key={fk.key} value={fk.key}>
                                          {fk.label}
                                        </option>
                                      ))}
                                    </Select>
                                    <span className="text-pine/70">is</span>
                                    {triggerField?.type === 'checkbox' ? (
                                      <Select
                                        aria-label="Trigger state"
                                        value={
                                          block.showIf.equals === false
                                            ? 'false'
                                            : 'true'
                                        }
                                        onChange={(e) =>
                                          handleUpdateBlock(block.blockId, {
                                            showIf: {
                                              ...block.showIf!,
                                              equals: e.target.value === 'true',
                                            },
                                          })
                                        }
                                        className="w-36"
                                      >
                                        <option value="true">Checked</option>
                                        <option value="false">Unchecked</option>
                                      </Select>
                                    ) : (
                                      <Input
                                        aria-label="Expected value"
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
                                        className="w-36"
                                      />
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Move to Step + Storage/Key */}
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {isInput && (
                                  <>
                                    <div>
                                      <Label
                                        htmlFor={`blk-target-${block.blockId}`}
                                      >
                                        Category &amp; Versioning
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
                                          Profile field (minor update)
                                        </option>
                                        <option value="consent">
                                          Legal consent (major bump)
                                        </option>
                                        <option value="custom">
                                          Custom intake field
                                        </option>
                                        <option value="ui">
                                          UI helper only
                                        </option>
                                      </Select>
                                    </div>

                                    <div>
                                      <Label
                                        htmlFor={`blk-key-${block.blockId}`}
                                      >
                                        Field Key
                                      </Label>
                                      <Input
                                        id={`blk-key-${block.blockId}`}
                                        value={block.fieldKey || ''}
                                        disabled={block.systemLocked}
                                        className="font-mono text-xs"
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
                                  </>
                                )}

                                {wizardPages.length > 1 &&
                                  currentPage.blocks.length > 1 && (
                                    <div>
                                      <Label
                                        htmlFor={`blk-move-${block.blockId}`}
                                      >
                                        Move to Step
                                      </Label>
                                      <Select
                                        id={`blk-move-${block.blockId}`}
                                        value={String(selectedPageIdx)}
                                        onChange={(e) =>
                                          handleMoveBlockToPage(
                                            bIdx,
                                            Number(e.target.value)
                                          )
                                        }
                                      >
                                        {wizardPages.map((p, pIdx) => (
                                          <option
                                            key={p.pageId}
                                            value={String(pIdx)}
                                          >
                                            {pIdx + 1}. {p.title}
                                          </option>
                                        ))}
                                      </Select>
                                    </div>
                                  )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Compact Add Block Trigger */}
            <div className="px-4 sm:px-5 py-3.5 border-t border-mist flex items-center justify-between gap-2">
              <div ref={addMenuRef} className="relative">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-haspopup="menu"
                  aria-expanded={isAddMenuOpen}
                  onClick={() => setIsAddMenuOpen((o) => !o)}
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  Add block
                </Button>

                {isAddMenuOpen && (
                  <div
                    role="menu"
                    className="absolute left-0 bottom-full mb-2 w-72 max-w-[calc(100vw-3rem)] rounded-xl border border-mist bg-surface-raised shadow-lift z-30 p-3 space-y-3"
                  >
                    {ADD_BLOCK_GROUPS.map((group) => (
                      <div key={group.heading} className="space-y-1">
                        <p className="px-2 text-[11px] font-medium uppercase tracking-wider text-pine/70">
                          {group.heading}
                        </p>
                        <div className="grid grid-cols-1 gap-0.5">
                          {group.items.map((item) => (
                            <button
                              key={item.type}
                              type="button"
                              role="menuitem"
                              onClick={() => handleAddBlock(item.type)}
                              className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-pine hover:bg-surface-sunken focus-visible:bg-surface-sunken focus-visible:outline-none cursor-pointer transition-colors"
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <span className="text-xs text-pine/65">
                Click any block to edit
              </span>
            </div>
          </section>
        )}
      </div>

      <WizardPreviewModal
        open={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        wizardPages={wizardPages}
        initialStep={selectedPageIdx + 1}
        consentVersion={activeVersion}
        hasUnsavedChanges={hasWizardChanges}
        services={services}
      />
    </div>
  );
}
