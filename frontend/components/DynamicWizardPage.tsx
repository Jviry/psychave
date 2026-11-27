'use client';

import React from 'react';
import { isWizardBlockVisible } from '../lib/consent';
import {
  formatReviewValue,
  INPUT_BLOCK_TYPES,
  type WizardErrors,
  type WizardValues,
} from '../lib/wizardEngine';
import type { ServiceItem, WizardBlock, WizardPage } from '../lib/types';
import { Checkbox, Input, Label, Select, Textarea } from './ui/primitives';

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-xs text-red-600">
      {message}
    </p>
  );
}

export interface DynamicWizardPageProps {
  page: WizardPage;
  allPages: WizardPage[];
  values: WizardValues;
  errors: WizardErrors;
  isSelf: boolean;
  consentVersion: string;
  services?: ServiceItem[];
  onChange: (fieldKey: string, value: unknown) => void;
  onJumpToStep?: (stepNumber: number) => void;
  idPrefix?: string;
  resignOnly?: boolean;
}

/**
 * Shared dynamic CMS wizard page renderer used across:
 * 1. Account registration (/register) — self mode
 * 2. Client profile creation & consent re-sign (/profiles/new, ProfileWizard) — dependent / resign mode
 * 3. Admin CMS Preview modal (/admin/cms) — self or dependent preview toggle
 */
const HIDDEN_PAGE_DESCRIPTIONS = new Set([
  'review offered services and clinical scope guardrails.',
  'review offered services and clinical scope notices.',
  'provide demographic and contact information.',
]);

function cleanDocLabel(label: string): string {
  return label.replace(/\s*[—–-]\s*scroll to read\s*$/i, '').trim();
}

function cleanServicesLabel(label: string): string {
  return label.replace(/\s*\(read-only\)\s*$/i, '').trim();
}

export function DynamicWizardPage({
  page,
  allPages,
  values,
  errors,
  isSelf,
  services = [],
  onChange,
  onJumpToStep,
  idPrefix = 'wiz',
  resignOnly = false,
}: DynamicWizardPageProps) {
  const visibleBlocks = page.blocks.filter((b) => {
    if (b.blockId === 'who_for') return false;
    if (resignOnly && b.target === 'profile') return false;
    return isWizardBlockVisible(b, isSelf, values);
  });

  // Auto-render "Same as permanent address" checkbox directly before present_address
  // whenever both permanent_address and present_address are visible on the same page.
  const hasBothAddresses =
    visibleBlocks.some((b) => b.fieldKey === 'permanent_address') &&
    visibleBlocks.some((b) => b.fieldKey === 'present_address');

  const sameAsPermanent = Boolean(values.sameAsPermanent);

  const renderBlock = (block: WizardBlock) => {
    if (block.type === 'scrollable_doc') {
      return (
        <div key={block.blockId}>
          <Label variant="doc">{cleanDocLabel(block.label)}</Label>
          <div className="mt-1.5 max-h-56 overflow-y-auto p-4 rounded-lg bg-parchment border border-mist text-xs text-pine/90 leading-relaxed whitespace-pre-wrap">
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
            {cleanServicesLabel(block.label)}
          </h3>
          {activeServices.length === 0 ? (
            <p className="text-xs text-pine/65">
              Offered psychological services are listed on our Services page.
            </p>
          ) : (
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
          )}
        </div>
      );
    }

    if (block.type === 'section_heading') {
      return (
        <div
          key={block.blockId}
          className="border-t border-mist/70 pt-4 space-y-1"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-pine/75">
            {block.label}
          </p>
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
          className="p-3.5 rounded-lg bg-surface-sunken border border-mist text-xs text-pine/85 leading-relaxed whitespace-pre-wrap"
        >
          {block.content || block.label}
        </div>
      );
    }

    if (block.type === 'review_summary') {
      const groups = allPages
        .map((p, idx) => {
          if (p.pageId === page.pageId) return null;
          const rows: [string, string][] = [];
          for (const b of p.blocks) {
            if (!INPUT_BLOCK_TYPES.has(b.type) || !b.fieldKey) continue;
            if (b.target === 'ui') continue;
            if (resignOnly && b.target === 'profile') continue;
            if (!isWizardBlockVisible(b, isSelf, values)) continue;
            rows.push([b.label, formatReviewValue(b, values[b.fieldKey])]);
          }
          return rows.length > 0 ? { title: p.title, step: idx + 1, rows } : null;
        })
        .filter((g): g is NonNullable<typeof g> => g !== null);

      return (
        <div
          key={block.blockId}
          className="rounded-lg border border-mist overflow-hidden"
        >
          {groups.length === 0 ? (
            <p className="px-3.5 py-3 text-xs text-pine/70">
              No previous entries to review.
            </p>
          ) : (
            groups.map((group) => (
              <div
                key={`${group.title}-${group.step}`}
                className="border-b border-mist last:border-b-0"
              >
                <div className="flex items-center justify-between px-3.5 py-2 border-b border-mist bg-surface-sunken/40">
                  <p className="text-xs font-medium uppercase tracking-wider text-pine/60">
                    {group.title}
                  </p>
                  {onJumpToStep && (
                    <button
                      type="button"
                      onClick={() => onJumpToStep(group.step)}
                      className="text-xs font-medium text-accent-ink hover:text-pine cursor-pointer"
                    >
                      Edit
                    </button>
                  )}
                </div>
                <dl className="divide-y divide-mist/50">
                  {group.rows.map(([label, val], i) => (
                    <div
                      key={`${group.step}-${i}-${label}`}
                      className="grid grid-cols-1 sm:grid-cols-3 gap-1 px-3.5 py-2 text-xs"
                    >
                      <dt className="text-pine/65 font-medium">{label}</dt>
                      <dd className="sm:col-span-2 text-pine break-words">{val}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))
          )}
        </div>
      );
    }

    // Input block types
    const fieldKey = block.fieldKey || block.blockId;
    const inputId = `${idPrefix}-${fieldKey}`;
    const errorId = `${inputId}-error`;
    const err = errors[fieldKey];
    const val = values[fieldKey];

    if (block.type === 'checkbox') {
      return (
        <div key={block.blockId}>
          <label
            htmlFor={inputId}
            className="flex items-start gap-3 text-sm text-pine cursor-pointer p-3.5 rounded-xl border border-mist hover:border-mint transition-colors"
          >
            <Checkbox
              id={inputId}
              className="mt-0.5"
              checked={Boolean(val)}
              onChange={(e) => onChange(fieldKey, e.target.checked)}
              aria-invalid={!!err}
              aria-describedby={err ? errorId : undefined}
            />
            <span className="leading-relaxed text-xs">{block.label}</span>
          </label>
          {block.helperText && (
            <p className="mt-1 text-xs text-pine/65">{block.helperText}</p>
          )}
          <FieldError id={errorId} message={err} />
        </div>
      );
    }

    if (block.type === 'select') {
      const selectOptions =
        fieldKey === 'relation_to_account_holder' && !isSelf
          ? block.options.filter((o) => o.value !== 'self')
          : block.options;

      return (
        <div key={block.blockId}>
          <Label htmlFor={inputId}>{block.label}</Label>
          <Select
            id={inputId}
            value={String(val ?? '')}
            onChange={(e) => onChange(fieldKey, e.target.value)}
            aria-invalid={!!err}
            aria-describedby={err ? errorId : undefined}
          >
            {!selectOptions.some((o) => o.value === '') && !val && (
              <option value="">Select an option…</option>
            )}
            {selectOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          {block.helperText && (
            <p className="mt-1 text-xs text-pine/65">{block.helperText}</p>
          )}
          <FieldError id={errorId} message={err} />
        </div>
      );
    }

    if (block.type === 'textarea') {
      const isPresentAddress = fieldKey === 'present_address';
      const sameId = `${idPrefix}-same-as-permanent`;
      return (
        <div key={block.blockId} className="space-y-2">
          {isPresentAddress && hasBothAddresses && (
            <label
              htmlFor={sameId}
              className="flex items-center gap-2.5 text-xs text-pine cursor-pointer"
            >
              <Checkbox
                id={sameId}
                checked={sameAsPermanent}
                onChange={(e) => onChange('sameAsPermanent', e.target.checked)}
              />
              <span>Present address is the same as permanent address</span>
            </label>
          )}
          <div>
            <Label htmlFor={inputId}>{block.label}</Label>
            <Textarea
              id={inputId}
              rows={2}
              value={String(val ?? '')}
              placeholder={block.placeholder || undefined}
              disabled={isPresentAddress && hasBothAddresses && sameAsPermanent}
              onChange={(e) => onChange(fieldKey, e.target.value)}
              autoComplete="off"
              aria-invalid={!!err}
              aria-describedby={err ? errorId : undefined}
            />
            {block.helperText && (
              <p className="mt-1 text-xs text-pine/65">{block.helperText}</p>
            )}
            <FieldError id={errorId} message={err} />
          </div>
        </div>
      );
    }

    if (block.type === 'date') {
      return (
        <div key={block.blockId}>
          <Label htmlFor={inputId}>{block.label}</Label>
          <Input
            id={inputId}
            type="date"
            value={String(val ?? '')}
            max={
              fieldKey === 'date_of_birth'
                ? new Date().toISOString().slice(0, 10)
                : undefined
            }
            onChange={(e) => onChange(fieldKey, e.target.value)}
            aria-invalid={!!err}
            aria-describedby={err ? errorId : undefined}
          />
          {block.helperText && (
            <p className="mt-1 text-xs text-pine/65">{block.helperText}</p>
          )}
          <FieldError id={errorId} message={err} />
        </div>
      );
    }

    // 'text' | 'phone'
    return (
      <div key={block.blockId}>
        <Label htmlFor={inputId}>{block.label}</Label>
        <Input
          id={inputId}
          type={block.type === 'phone' ? 'tel' : 'text'}
          value={String(val ?? '')}
          placeholder={block.placeholder || undefined}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          autoComplete="off"
          aria-invalid={!!err}
          aria-describedby={err ? errorId : undefined}
        />
        {block.helperText && (
          <p className="mt-1 text-xs text-pine/65 leading-relaxed">
            {block.helperText}
          </p>
        )}
        <FieldError id={errorId} message={err} />
      </div>
    );
  };

  const pageDescription =
    page.description &&
    !HIDDEN_PAGE_DESCRIPTIONS.has(page.description.trim().toLowerCase())
      ? page.description
      : null;

  return (
    <div className="space-y-4">
      {pageDescription && (
        <p className="text-xs text-pine/75">{pageDescription}</p>
      )}
      {visibleBlocks.map((block) => renderBlock(block))}
    </div>
  );
}
