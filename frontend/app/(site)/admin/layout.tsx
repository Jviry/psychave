'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RoleGate } from '../../../components/auth/RoleGate';

const navLinks = [
  { label: 'User Management', href: '/admin/users' },
  { label: 'Credential Verifications', href: '/admin/verifications' },
  { label: 'CMS Editors', href: '/admin/cms' },
];

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <RoleGate role="admin">
      <div className="space-y-6">
        <nav
          aria-label="Admin Dashboard Navigation"
          className="flex flex-wrap items-center justify-between gap-4 border-b border-mist pb-3"
        >
          <div
            role="group"
            aria-label="Admin Workspace Sections"
            className="flex flex-wrap items-center gap-1 p-1 bg-surface-sunken rounded-lg border border-mist"
          >
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-surface-raised text-pine font-semibold shadow-xs'
                      : 'text-pine/70 hover:text-pine'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
          <div className="text-xs text-pine/70 font-mono">
            Access: <span className="font-semibold text-accent-ink">Admin only</span>
          </div>
        </nav>

        <div>{children}</div>
      </div>
    </RoleGate>
  );
}
