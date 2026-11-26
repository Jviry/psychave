'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CreditCard } from 'lucide-react';
import { api } from '@/lib/api';
import { Button, Card, Input, Skeleton } from '@/components/ui/primitives';

export default function AdminBookingsPage() {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['admin-appointments', 'awaiting_payment'],
    queryFn: () => api.getAdminAppointments('awaiting_payment'),
  });

  const confirmMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      api.confirmManualPayment(id, note),
    onSuccess: (updated) => {
      setErrorMsg(null);
      setFeedback(`Marked booking ${updated.id} as manually paid and confirmed.`);
      queryClient.invalidateQueries({ queryKey: ['admin-appointments'] });
    },
    onError: (err: Error) => {
      setFeedback(null);
      setErrorMsg(err.message);
    },
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1 border-b border-mist pb-4">
        <h1 className="font-heading text-3xl font-medium text-pine">
          Manual Payment Verification
        </h1>
        <p className="text-sm text-pine/75">
          Confirm awaiting-payment bookings once the assigned psychologist verifies manual
          payment via social media or direct contact.
        </p>
      </header>

      {feedback && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-sage bg-parchment px-4 py-3 text-xs text-pine font-medium"
        >
          <CheckCircle2 className="w-4 h-4 text-sage shrink-0" aria-hidden="true" />
          <span>{feedback}</span>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900"
        >
          {errorMsg}
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-48" />
      ) : appointments.length === 0 ? (
        <Card className="py-10 text-center text-sm text-pine/70">
          No bookings are currently awaiting payment.
        </Card>
      ) : (
        <div className="space-y-4">
          {appointments.map((appt) => {
            const agreedSlot = appt.proposedSlots.find((s) => s.id === appt.selectedSlotId);
            return (
              <Card key={appt.id} className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-mono text-pine/60">ID: {appt.id}</p>
                    <h2 className="font-heading text-xl font-medium text-pine">
                      {appt.serviceTitle} — {appt.profileLabel || 'Client'}
                    </h2>
                    <p className="text-xs text-pine/75">
                      Assigned RPsy: {appt.psychologistCode || appt.psychologistId || '—'} · Fee:{' '}
                      <strong className="font-semibold">
                        ₱{(appt.pricePhp ?? 0).toLocaleString()}
                      </strong>
                    </p>
                    {agreedSlot && (
                      <p className="text-xs font-mono text-accent-ink">
                        Agreed schedule: {agreedSlot.dateLabel} · {agreedSlot.timeLabel}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <Input
                      value={notes[appt.id] ?? ''}
                      onChange={(e) =>
                        setNotes((prev) => ({ ...prev, [appt.id]: e.target.value }))
                      }
                      placeholder="Reference / RPsy confirmation note"
                      className="sm:w-64"
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={confirmMutation.isPending}
                      onClick={() =>
                        confirmMutation.mutate({ id: appt.id, note: notes[appt.id] })
                      }
                    >
                      <CreditCard className="w-4 h-4" aria-hidden="true" />
                      Confirm Manual Payment
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
