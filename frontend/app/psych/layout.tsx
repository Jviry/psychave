'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppStore } from '../../stores/useAppStore';

export default function PsychologistDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { cognitoRole, setCognitoRole, activePsychologistId } = useAppStore();

  // Ensure role is synchronized to psychologist when viewing psychologist dashboard
  useEffect(() => {
    if (cognitoRole !== 'psychologist') {
      setCognitoRole('psychologist');
    }
  }, [cognitoRole, setCognitoRole]);

  const navLinks = [
    { label: 'Pending Requests', href: '/psych/queue' },
    { label: 'My Schedule', href: '/psych/schedule' },
    { label: 'Profile', href: '/psych/profile' },
  ];

  return (
    <div className="space-y-6">
      {/* Dashboard Nav Bar */}
      <nav
        aria-label="Psychologist Dashboard Navigation"
        className="flex flex-wrap items-center justify-between gap-4 border-b border-mist pb-3"
      >
        <div className="flex items-center gap-2">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-pine text-white shadow-xs'
                    : 'bg-white border border-mist text-pine hover:bg-[#F1F6F2]'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
        <div className="text-xs text-pine/70 font-mono">
          Practitioner ID: <span className="font-bold text-sage">{activePsychologistId}</span>
        </div>
      </nav>

      {/* Page Content */}
      <div>{children}</div>
    </div>
  );
}
