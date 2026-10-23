'use client';

import React from 'react';
import { RoleGate } from '../../../components/auth/RoleGate';

export default function ClientBookingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RoleGate role="client">{children}</RoleGate>;
}
