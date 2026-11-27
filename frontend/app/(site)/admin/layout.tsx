'use client';

import React from 'react';
import { RoleGate } from '../../../components/auth/RoleGate';

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RoleGate role="admin">{children}</RoleGate>;
}
