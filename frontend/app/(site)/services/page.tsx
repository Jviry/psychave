'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { useAppStore } from '../../../stores/useAppStore';
import { Button, Card, Skeleton } from '../../../components/ui/primitives';
import { ArrowRight } from 'lucide-react';

export default function ServicesPage() {
  const router = useRouter();
  const { setCognitoRole, updateBookingDraft } = useAppStore();

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.getServices(),
  });

  const standaloneConsultation = services.find((s) => s.isStandaloneConsultation);
  const coreServices = services.filter((s) => !s.isStandaloneConsultation);

  return (
    <div className="space-y-12">
      {/* Page Header */}
      <header className="space-y-3 border-b border-mist pb-6">
        <div className="flex items-center gap-2 text-xs text-accent-ink font-semibold">
          <span>PSYCHAVE PH Service Catalog</span>
          <span aria-hidden="true">·</span>
          <span>Mandatory Clinical Duration &amp; Scope Guardrails</span>
        </div>
        <h1 className="font-heading text-4xl font-bold text-pine">
          Services, Session Durations &amp; Ethical Guardrails
        </h1>
        <p className="text-base text-pine/80 max-w-3xl">
          Every service offered at PsychAvenuePH enforces explicit clinical scope boundaries and
          duration rules during Flow C booking and psychologist slot proposal.
        </p>
      </header>

      {/* Standalone Consultation Highlight (45 mins — Screening Only) */}
      {standaloneConsultation && (
        <section className="bg-surface-raised border border-sage/50 rounded-lg p-6 lg:p-8 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-mist pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-accent-ink">
                <span>Standalone Entry Service</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{standaloneConsultation.durationLabel}</span>
              </div>
              <h2 className="font-heading text-3xl font-bold text-pine">
                {standaloneConsultation.indexNumber}. {standaloneConsultation.title}
              </h2>
            </div>

            <Button
              variant="accent"
              size="md"
              onClick={() => {
                updateBookingDraft({ serviceId: standaloneConsultation.id });
                setCognitoRole('client');
                router.push('/personas');
              }}
            >
              Start 45-Min Consultation Booking
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 space-y-2">
              <p className="text-sm text-pine/85 leading-relaxed">
                {standaloneConsultation.description}
              </p>
              <p className="text-xs text-pine/65">
                Format: {standaloneConsultation.clinicalFormat}
              </p>
            </div>

            <div className="lg:col-span-5 space-y-1">
              <p className="text-xs font-semibold text-pine">
                Mandatory Clinical Guardrail — {standaloneConsultation.guardrailTitle}
              </p>
              <p className="text-xs text-pine/75 leading-relaxed">
                {standaloneConsultation.guardrailNotice}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Core Clinical, Coaching, Supervision & Academic Services */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl font-bold text-pine">
            Full Clinical, Coaching, Supervision &amp; Research Programs
          </h2>
          <span className="text-xs text-pine/65 font-mono tabular-nums">
            {services.length} Canonical Services
          </span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((n) => (
              <Skeleton key={n} className="h-56" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {coreServices.map((srv) => (
              <Card key={srv.id} className="flex flex-col justify-between gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs border-b border-mist/60 pb-3">
                    <span className="font-mono font-semibold text-accent-ink tabular-nums">
                      {srv.indexNumber}. {srv.categoryGroup}
                    </span>
                    <span className="font-mono font-semibold text-pine/65 tabular-nums">
                      {srv.durationLabel}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-heading text-2xl font-bold text-pine">
                      {srv.title}
                    </h3>
                    <p className="text-sm text-pine/80 leading-relaxed">
                      {srv.description}
                    </p>
                  </div>

                  {/* Mandatory Service Guardrail */}
                  <div className="space-y-1 text-xs">
                    <p className="font-semibold text-pine">
                      Guardrail: {srv.guardrailTitle}
                    </p>
                    <p className="text-pine/70 leading-relaxed">
                      {srv.guardrailNotice}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-mist flex items-center justify-between gap-4">
                  <span className="text-xs text-pine/70">{srv.clinicalFormat}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      updateBookingDraft({ serviceId: srv.id });
                      setCognitoRole('client');
                      router.push('/personas');
                    }}
                  >
                    <span className="inline-flex items-center gap-1">
                      Select &amp; Complete Booking
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </span>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Summary Guardrail Comparison Table */}
      <section className="bg-surface-raised border border-mist rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-mist flex items-center justify-between">
          <h3 className="font-heading text-xl font-bold text-pine">
            Canonical Service Duration &amp; Boundary Reference Matrix
          </h3>
          <span className="text-xs text-pine/70">Enforced in Flow C Booking &amp; Proposals</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-mist text-xs text-pine/70 bg-parchment">
                <th className="py-3 px-4 font-semibold">Service</th>
                <th className="py-3 px-4 font-semibold">Standard Duration</th>
                <th className="py-3 px-4 font-semibold">Mandatory Scope Guardrail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist/60 text-xs">
              {services.map((s) => (
                <tr key={s.id} className="hover:bg-parchment/80">
                  <td className="py-3 px-4 font-semibold text-pine">{s.title}</td>
                  <td className="py-3 px-4 font-mono tabular-nums text-accent-ink font-semibold">
                    {s.durationLabel}
                  </td>
                  <td className="py-3 px-4 text-pine/80">{s.guardrailNotice}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
