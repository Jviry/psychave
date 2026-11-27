'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cmsOverviewSchema, CmsOverviewFormValues } from '@/lib/schemas';
import type { CmsContent } from '@/lib/types';
import { useAppStore } from '@/stores/useAppStore';
import {
  Button,
  Input,
  Label,
  Skeleton,
  Textarea,
} from '@/components/ui/primitives';

interface OverviewTabProps {
  cms?: CmsContent;
  isLoading?: boolean;
  isError?: boolean;
}

export function OverviewTab({
  cms,
  isLoading = false,
  isError = false,
}: OverviewTabProps) {
  const queryClient = useQueryClient();
  const { publishFlowEvent } = useAppStore();
  const [overviewStatusMsg, setOverviewStatusMsg] = useState<string | null>(
    null
  );

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
      setOverviewStatusMsg('Saved clinic overview content.');
      publishFlowEvent(
        'CMS Overview Updated',
        'Vision, Mission, and Clinic Overview persisted to database.'
      );
    },
  });

  if (isLoading) {
    return (
      <Skeleton
        className="h-96 max-w-4xl rounded-2xl"
        aria-busy="true"
        aria-label="Loading clinic overview"
      />
    );
  }

  return (
    <section className="rounded-2xl border border-mist bg-surface-raised p-5 sm:p-6 space-y-5 max-w-4xl">
      <h2 className="font-heading text-xl font-medium text-pine border-b border-mist pb-3">
        Vision, Mission &amp; Clinic Overview
      </h2>

      {isError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-900"
        >
          Could not load clinic overview from the server. Try refreshing the
          page.
        </div>
      )}

      {overviewStatusMsg && (
        <div
          role="status"
          className="rounded-lg border border-sage/40 bg-surface-sunken px-3.5 py-2.5 text-xs text-pine font-medium"
        >
          {overviewStatusMsg}
        </div>
      )}

      {saveCmsMutation.isError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-900"
        >
          {saveCmsMutation.error instanceof Error
            ? saveCmsMutation.error.message
            : 'Could not save clinic overview.'}
        </div>
      )}

      <form
        onSubmit={overviewForm.handleSubmit((vals) => {
          setOverviewStatusMsg(null);
          saveCmsMutation.mutate(vals);
        })}
        className="space-y-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="cms-vision">Vision Statement</Label>
            <Textarea
              id="cms-vision"
              rows={4}
              aria-invalid={Boolean(overviewForm.formState.errors.vision)}
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
              aria-invalid={Boolean(overviewForm.formState.errors.mission)}
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
            aria-invalid={Boolean(overviewForm.formState.errors.clinicOverview)}
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
            aria-invalid={Boolean(
              overviewForm.formState.errors.impactNarrative
            )}
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
            Post-Session Evaluation Form URL
          </Label>
          <Input
            id="cms-evaluation-form-url"
            type="url"
            placeholder="https://docs.google.com/forms/..."
            aria-invalid={Boolean(
              overviewForm.formState.errors.evaluationFormUrl
            )}
            {...overviewForm.register('evaluationFormUrl')}
          />
          <p className="text-xs text-pine/70 mt-1">
            Sent to clients by email and shown on completed bookings.
          </p>
          {overviewForm.formState.errors.evaluationFormUrl && (
            <p className="text-xs text-red-700 mt-1">
              {overviewForm.formState.errors.evaluationFormUrl.message}
            </p>
          )}
        </div>

        <div className="pt-1">
          <Button
            type="submit"
            variant="primary"
            disabled={saveCmsMutation.isPending}
          >
            {saveCmsMutation.isPending ? 'Saving…' : 'Save Overview'}
          </Button>
        </div>
      </form>
    </section>
  );
}
