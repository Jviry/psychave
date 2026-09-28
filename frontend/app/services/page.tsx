'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAppStore } from '../../stores/useAppStore';
import { Button, Card } from '../../components/ui/primitives';

export default function ServicesPage() {
  const router = useRouter();
  const { setCognitoRole, updateIntakeDraft } = useAppStore();

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.getServices(),
  });

  const standaloneConsultation = services.find((s) => s.isStandaloneConsultation);
  const coreServices = services.filter((s) => !s.isStandaloneConsultation);

  return (
    <div className="space-y-12">
      {/* Page Header */}
      <header className="space-y-3 border-b border-[#C0D3C3] pb-6">
        <div className="flex items-center gap-2 text-xs text-[#5D8B69] font-semibold">
          <span>PSYCHAVE PH Service Catalog</span>
          <span aria-hidden="true">·</span>
          <span>Mandatory Clinical Duration &amp; Scope Guardrails</span>
        </div>
        <h1 className="font-heading text-4xl font-bold text-[#25372D]">
          Services, Session Durations &amp; Ethical Guardrails
        </h1>
        <p className="text-base text-[#25372D]/80 max-w-3xl">
          Every service offered at PsychAvenuePH enforces explicit clinical scope boundaries and
          duration rules during Flow C intake and psychologist slot proposal.
        </p>
      </header>

      {/* Standalone Consultation Highlight (45 mins — Screening Only) */}
      {standaloneConsultation && (
        <section className="bg-white border-2 border-[#5D8B69] rounded-2xl p-6 lg:p-8 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#C0D3C3] pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#5D8B69]">
                <span>Standalone Entry Service</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{standaloneConsultation.durationLabel}</span>
              </div>
              <h2 className="font-heading text-3xl font-bold text-[#25372D]">
                {standaloneConsultation.indexNumber}. {standaloneConsultation.title}
              </h2>
            </div>

            <Button
              variant="accent"
              size="md"
              onClick={() => {
                updateIntakeDraft({ serviceId: standaloneConsultation.id });
                setCognitoRole('client');
                router.push('/personas');
              }}
            >
              Start 45-Min Consultation Intake
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 space-y-2">
              <p className="text-sm text-[#25372D]/85 leading-relaxed">
                {standaloneConsultation.description}
              </p>
              <p className="text-xs text-[#25372D]/65">
                Format: {standaloneConsultation.clinicalFormat}
              </p>
            </div>

            <div className="lg:col-span-5 bg-[#EBF2EC] border-l-4 border-[#25372D] p-4 rounded-r-lg space-y-1">
              <p className="text-xs font-bold text-[#25372D]">
                Mandatory Clinical Guardrail — {standaloneConsultation.guardrailTitle}
              </p>
              <p className="text-xs text-[#25372D]/85 leading-relaxed">
                {standaloneConsultation.guardrailNotice}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Core Clinical, Coaching, Supervision & Academic Services */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl font-bold text-[#25372D]">
            Full Clinical, Coaching, Supervision &amp; Research Programs
          </h2>
          <span className="text-xs text-[#25372D]/65 font-mono tabular-nums">
            {services.length} Canonical Services
          </span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-56 rounded-xl bg-white border border-[#C0D3C3] p-6 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {coreServices.map((srv) => (
              <Card key={srv.id} className="flex flex-col justify-between gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs border-b border-[#C0D3C3]/60 pb-3">
                    <span className="font-semibold text-[#5D8B69]">
                      {srv.indexNumber}. {srv.categoryGroup}
                    </span>
                    <span className="font-mono font-bold text-[#25372D] tabular-nums">
                      Duration: {srv.durationLabel}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-heading text-2xl font-bold text-[#25372D]">
                      {srv.title}
                    </h3>
                    <p className="text-sm text-[#25372D]/80 leading-relaxed">
                      {srv.description}
                    </p>
                  </div>

                  {/* Mandatory Service Guardrail Box */}
                  <div className="bg-[#F1F6F2] border-l-4 border-[#5D8B69] p-4 rounded-r-lg space-y-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#25372D]">
                      <svg
                        className="w-4 h-4 text-[#5D8B69] shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span>{srv.guardrailTitle}</span>
                    </div>
                    <p className="text-xs text-[#25372D]/80 leading-relaxed">
                      {srv.guardrailNotice}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#C0D3C3]/60 flex items-center justify-between gap-4">
                  <span className="text-xs text-[#25372D]/70">{srv.clinicalFormat}</span>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      updateIntakeDraft({ serviceId: srv.id });
                      setCognitoRole('client');
                      router.push('/personas');
                    }}
                  >
                    Select &amp; Complete Intake
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Summary Guardrail Comparison Table */}
      <section className="bg-white border border-[#C0D3C3] rounded-xl overflow-hidden">
        <div className="px-6 py-4 bg-[#EBF2EC] border-b border-[#C0D3C3] flex items-center justify-between">
          <h3 className="font-heading text-xl font-bold text-[#25372D]">
            Canonical Service Duration &amp; Boundary Reference Matrix
          </h3>
          <span className="text-xs text-[#25372D]/70">Enforced in Flow C Intake &amp; Proposals</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#C0D3C3] text-xs text-[#25372D]/70 bg-[#F6F9F6]">
                <th className="py-3 px-4 font-semibold">Service</th>
                <th className="py-3 px-4 font-semibold">Standard Duration</th>
                <th className="py-3 px-4 font-semibold">Mandatory Scope Guardrail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#C0D3C3]/60 text-xs">
              {services.map((s) => (
                <tr key={s.id} className="hover:bg-[#F6F9F6]/80">
                  <td className="py-3 px-4 font-semibold text-[#25372D]">{s.title}</td>
                  <td className="py-3 px-4 font-mono tabular-nums text-[#5D8B69] font-semibold">
                    {s.durationLabel}
                  </td>
                  <td className="py-3 px-4 text-[#25372D]/80">{s.guardrailNotice}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
