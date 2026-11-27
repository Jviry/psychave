'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ServicesTab } from './_components/ServicesTab';
import { WizardBuilderTab } from './_components/WizardBuilderTab';
import { OverviewTab } from './_components/OverviewTab';
import { TestimonialsTab } from './_components/TestimonialsTab';

type CmsTabId = 'services' | 'wizard' | 'overview' | 'structures';

const CMS_TABS: { id: CmsTabId; label: string }[] = [
  { id: 'services', label: 'Services' },
  { id: 'wizard', label: 'Forms & Consent' },
  { id: 'overview', label: 'Clinic Overview' },
  { id: 'structures', label: 'Testimonials' },
];

export default function AdminCmsPage() {
  const [activeTab, setActiveTab] = useState<CmsTabId>('services');

  const {
    data: services = [],
    isLoading: isLoadingServices,
    isError: isServicesError,
  } = useQuery({
    queryKey: ['services', 'admin'],
    queryFn: () => api.getAdminServices(),
  });

  const {
    data: cms,
    isLoading: isLoadingCms,
    isError: isCmsError,
  } = useQuery({
    queryKey: ['cms', 'admin'],
    queryFn: () => api.getAdminCmsContent(),
  });

  const handleTabKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    idx: number
  ) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const nextIdx =
      e.key === 'ArrowRight'
        ? (idx + 1) % CMS_TABS.length
        : (idx - 1 + CMS_TABS.length) % CMS_TABS.length;
    setActiveTab(CMS_TABS[nextIdx].id);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-mist pb-4">
        <h1 className="font-heading text-3xl font-medium text-pine">
          Content Management
        </h1>

        <div
          role="tablist"
          aria-label="CMS Sections"
          className="flex flex-wrap items-center gap-1 p-1 bg-surface-sunken rounded-lg border border-mist w-fit"
        >
          {CMS_TABS.map((tab, idx) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`cms-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`cms-panel-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-sage ${
                  isActive
                    ? 'bg-surface-raised text-pine font-semibold shadow-xs'
                    : 'text-pine/70 hover:text-pine'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      <div
        id={`cms-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`cms-tab-${activeTab}`}
      >
        {activeTab === 'services' && (
          <ServicesTab
            services={services}
            isLoading={isLoadingServices}
            isError={isServicesError}
          />
        )}
        {activeTab === 'wizard' && <WizardBuilderTab services={services} />}
        {activeTab === 'overview' && (
          <OverviewTab
            cms={cms}
            isLoading={isLoadingCms}
            isError={isCmsError}
          />
        )}
        {activeTab === 'structures' && (
          <TestimonialsTab
            testimonials={cms?.testimonials ?? []}
            isLoading={isLoadingCms}
            isError={isCmsError}
          />
        )}
      </div>
    </div>
  );
}
