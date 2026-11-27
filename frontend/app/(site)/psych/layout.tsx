'use client';

import React from 'react';
import { RoleGate } from '../../../components/auth/RoleGate';

export default function PsychologistDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RoleGate role="psychologist">{children}</RoleGate>;
}
