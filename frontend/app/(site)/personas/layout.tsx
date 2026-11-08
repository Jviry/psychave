'use client';

import React from 'react';
import { RoleGate } from '../../../components/auth/RoleGate';

export default function ClientBookingFlowLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RoleGate role="client">{children}</RoleGate>;
}
