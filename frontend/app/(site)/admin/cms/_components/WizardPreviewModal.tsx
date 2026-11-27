'use client';

import React, { useState } from 'react';
import { DEFAULT_WIZARD_PAGES, isWizardBlockVisible } from '@/lib/consent';
import type { ServiceItem, WizardBlockType, WizardPage } from '@/lib/types';
import {
  Button,
  Checkbox,
  Input,
  Label,
  Modal,
  Select,
  Textarea,
} from '@/components/ui/primitives';

const INPUT_BLOCK_TYPES = new Set<WizardBlockType>([
  'text',
  'textarea',
  'select',
  'checkbox',
  'date',
  'phone',
]);

interface WizardPreviewModalProps {
  open: boolean;
  onClose: () => void;
  wizardPages: WizardPage[];
  initialStep: number;
  consentVersion: string;
  hasUnsavedChanges: boolean;
  services: ServiceItem[];
}

export function WizardPreviewModal({
  open,
  onClose,
  wizardPages,
  initialStep,
  consentVersion,
  hasUnsavedChanges,
  services,
}: WizardPreviewModalProps) {
  const [previewStep, setPreviewStep] = useState(initialStep);
  const [previewValues, setPreviewValues] = useState<Record<string, unknown>>({});

  React.useEffect(() => {
    if (open) {
      setPreviewStep(initialStep);
    }
  }, [open, initialStep]);

  const previewPages =
    wizardPages.length > 0 ? wizardPages : DEFAULT_WIZARD_PAGES;
  const safePreviewStep = Math.min(
    Math.max(1, previewStep),
    previewPages.length
  );
  const activePreviewPage =
    previewPages[safePreviewStep - 1] || previewPages[0];

  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidth="2xl"
      title={activePreviewPage?.title || 'Form Preview'}
      description={`Client preview · Step ${safePreviewStep} of ${previewPages.length} · ${consentVersion}${
        hasUnsavedChanges ? ' (unsaved draft)' : ''
      }`}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3 w-full">
          <span className="text-xs text-pine/65">
            Preview only — nothing is submitted.
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
                onClick={onClose}
              >
                Done
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <ol
          className="flex items-center gap-2"
          aria-label="Preview form progress"
        >
          {previewPages.map((p, idx) => {
            const stepNum = idx + 1;
            return (
              <li key={p.pageId} className="flex-1">
                <button
                  type="button"
                  onClick={() => setPreviewStep(stepNum)}
                  title={`Step ${stepNum}: ${p.title}`}
                  aria-label={`Jump to step ${stepNum}: ${p.title}`}
                  className="w-full py-1.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-sage rounded"
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
                    {block.label} ({consentVersion})
                  </Label>
                  <div className="mt-1.5 max-h-44 overflow-y-auto p-4 rounded-lg bg-parchment border border-mist text-xs text-pine/90 leading-relaxed whitespace-pre-wrap">
                    {block.content}
                  </div>
                </div>
              );
            }

            if (block.type === 'services_list') {
              const activeServices = services.filter(
                (s) => s.isActive !== false
              );
              return (
                <div key={block.blockId} className="space-y-2">
                  <h3 className="font-heading text-base font-medium text-pine">
                    {block.label}
                  </h3>
                  <ul className="divide-y divide-mist rounded-lg border border-mist bg-parchment">
                    {activeServices.map((s) => (
                      <li key={s.id} className="p-3 space-y-1">
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
                  <span className="text-xs font-medium uppercase tracking-wider text-pine/65">
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
                  className="rounded-lg border border-mist overflow-hidden divide-y divide-mist"
                >
                  {groups.map((group) => (
                    <div key={`${group.title}-${group.step}`}>
                      <div className="flex items-center justify-between px-3.5 py-2 border-b border-mist bg-surface-sunken/40">
                        <p className="text-xs font-medium uppercase tracking-wider text-pine/65">
                          {group.title}
                        </p>
                        <button
                          type="button"
                          onClick={() => setPreviewStep(group.step)}
                          className="text-xs font-medium text-accent-ink hover:text-pine cursor-pointer"
                        >
                          Edit
                        </button>
                      </div>
                      <dl className="px-3.5 py-2 space-y-1">
                        {group.rows.map(([k, v]) => (
                          <div
                            key={k}
                            className="flex justify-between gap-4 text-xs"
                          >
                            <dt className="text-pine/70">{k}</dt>
                            <dd className="font-medium text-pine text-right">
                              {v}
                            </dd>
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
                  className="flex items-start gap-3 text-xs text-pine cursor-pointer p-3 rounded-lg border border-mist hover:border-mint transition-colors"
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
                    <p className="text-xs text-pine/70 mt-1">
                      {block.helperText}
                    </p>
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
                    <p className="text-xs text-pine/70 mt-1">
                      {block.helperText}
                    </p>
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
                  <p className="text-xs text-pine/70 mt-1">
                    {block.helperText}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
