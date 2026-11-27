'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CreditCard, RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';
import { BookingStatusTag, Button, Card, Input, Skeleton } from '@/components/ui/primitives';

type AdminTab = 'awaiting_payment' | 'refunds';
type RefundFilterStatus =
  | 'confirmed'
  | 'completed'
  | 'no_show'
  | 'reschedule_requested'
  | 'partially_refunded'
  | 'refunded';

const REFUND_STATUS_OPTIONS: { value: RefundFilterStatus; label: string }[] = [
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'no_show', label: 'No-Show' },
  { value: 'reschedule_requested', label: 'Reschedule Requested' },
  { value: 'partially_refunded', label: 'Partially Refunded' },
  { value: 'refunded', label: 'Refunded' },
];

export default function AdminBookingsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<AdminTab>('awaiting_payment');
  const [refundStatusFilter, setRefundStatusFilter] =
    useState<RefundFilterStatus>('confirmed');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [refundInputs, setRefundInputs] = useState<
    Record<string, { percentage: string; amountPhp: string; reason: string }>
  >({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const queryStatus =
    activeTab === 'awaiting_payment' ? 'awaiting_payment' : refundStatusFilter;

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['admin-appointments', queryStatus],
    queryFn: () => api.getAdminAppointments(queryStatus),
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

  const refundMutation = useMutation({
    mutationFn: ({
      id,
      amountCentavos,
      percentage,
      reason,
    }: {
      id: string;
      amountCentavos?: number;
      percentage?: number;
      reason: string;
    }) => api.refundAdminAppointment(id, { amountCentavos, percentage, reason }),
    onSuccess: (updated) => {
      setErrorMsg(null);
      const php = updated.refundAmountCentavos
        ? `₱${(updated.refundAmountCentavos / 100).toLocaleString()}`
        : '';
      setFeedback(`Issued partial refund ${php} for booking ${updated.id}.`);
      setRefundInputs((prev) => {
        const next = { ...prev };
        delete next[updated.id];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['admin-appointments'] });
    },
    onError: (err: Error) => {
      setFeedback(null);
      setErrorMsg(err.message);
    },
  });

  const getRefundDraft = (id: string) =>
    refundInputs[id] ?? { percentage: '', amountPhp: '', reason: '' };

  const updateRefundDraft = (
    id: string,
    patch: Partial<{ percentage: string; amountPhp: string; reason: string }>
  ) => {
    setRefundInputs((prev) => ({
      ...prev,
      [id]: { ...getRefundDraft(id), ...patch },
    }));
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1 border-b border-mist pb-4">
        <h1 className="font-heading text-3xl font-medium text-pine">
          Bookings &amp; Payment Administration
        </h1>
        <p className="text-sm text-pine/75">
          Verify manual payments for awaiting-payment bookings or issue partial refunds on
          paid sessions.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-mist pb-3">
        <Button
          variant={activeTab === 'awaiting_payment' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('awaiting_payment')}
        >
          Manual Payment Verification
        </Button>
        <Button
          variant={activeTab === 'refunds' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('refunds')}
        >
          Paid Sessions &amp; Partial Refunds
        </Button>
      </div>

      {activeTab === 'refunds' && (
        <div
          role="group"
          aria-label="Filter paid appointments by status"
          className="flex flex-wrap items-center gap-1 p-1 bg-surface-sunken rounded-lg border border-mist w-fit"
        >
          {REFUND_STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRefundStatusFilter(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                refundStatusFilter === opt.value
                  ? 'bg-surface-raised text-pine font-semibold shadow-xs'
                  : 'text-pine/70 hover:text-pine'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

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
          {activeTab === 'awaiting_payment'
            ? 'No bookings are currently awaiting payment.'
            : `No ${refundStatusFilter.replace('_', ' ')} bookings found.`}
        </Card>
      ) : (
        <div className="space-y-4">
          {appointments.map((appt) => {
            const agreedSlot = appt.proposedSlots.find((s) => s.id === appt.selectedSlotId);
            const draft = getRefundDraft(appt.id);
            const paidPhp = appt.pricePhp ?? 0;
            const pctValue = draft.percentage ? Number(draft.percentage) : null;
            const amtPhpValue = draft.amountPhp ? Number(draft.amountPhp) : null;
            const validPct =
              pctValue !== null &&
              Number.isFinite(pctValue) &&
              pctValue > 0 &&
              pctValue < 100 &&
              paidPhp > 0;
            const validAmt =
              amtPhpValue !== null &&
              Number.isFinite(amtPhpValue) &&
              amtPhpValue > 0 &&
              amtPhpValue < paidPhp;
            const previewPhp = validPct
              ? (paidPhp * (pctValue as number)) / 100
              : validAmt
                ? amtPhpValue
                : null;
            const isAlreadyRefunded =
              appt.status === 'partially-refunded' || appt.status === 'refunded';
            const canSubmitRefund =
              !isAlreadyRefunded &&
              Boolean(draft.reason.trim()) &&
              (validPct || validAmt) &&
              !refundMutation.isPending;

            return (
              <Card key={appt.id} className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-mono text-pine/60">ID: {appt.id}</p>
                      <BookingStatusTag status={appt.status} />
                    </div>
                    <h2 className="font-heading text-xl font-medium text-pine">
                      {appt.serviceTitle} — {appt.profileLabel || 'Client'}
                    </h2>
                    <p className="text-xs text-pine/75">
                      Assigned RPsy: {appt.psychologistCode || appt.psychologistId || '—'} · Fee:{' '}
                      <strong className="font-semibold">
                        ₱{paidPhp.toLocaleString()}
                      </strong>
                    </p>
                    {agreedSlot && (
                      <p className="text-xs font-mono text-accent-ink">
                        Agreed schedule: {agreedSlot.dateLabel} · {agreedSlot.timeLabel}
                      </p>
                    )}
                  </div>

                  {activeTab === 'awaiting_payment' ? (
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
                  ) : isAlreadyRefunded ? (
                    <div className="rounded-lg border border-mist bg-parchment px-4 py-3 text-xs text-pine space-y-1 sm:w-96">
                      <p className="font-semibold">
                        Refunded:{' '}
                        {appt.refundAmountCentavos != null
                          ? `₱${(appt.refundAmountCentavos / 100).toLocaleString()}`
                          : 'Recorded'}
                      </p>
                      {appt.refundReason && (
                        <p className="text-pine/75">Reason: {appt.refundReason}</p>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 sm:w-96">
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          id={`refund-pct-${appt.id}`}
                          name={`refund-pct-${appt.id}`}
                          type="number"
                          min="1"
                          max="99"
                          step="1"
                          value={draft.percentage}
                          onChange={(e) =>
                            updateRefundDraft(appt.id, {
                              percentage: e.target.value,
                              amountPhp: '',
                            })
                          }
                          placeholder="% (e.g. 50)"
                        />
                        <Input
                          id={`refund-amt-${appt.id}`}
                          name={`refund-amt-${appt.id}`}
                          type="number"
                          min="1"
                          step="1"
                          value={draft.amountPhp}
                          onChange={(e) =>
                            updateRefundDraft(appt.id, {
                              amountPhp: e.target.value,
                              percentage: '',
                            })
                          }
                          placeholder="Or ₱ amount"
                        />
                      </div>
                      <Input
                        id={`refund-reason-${appt.id}`}
                        name={`refund-reason-${appt.id}`}
                        value={draft.reason}
                        onChange={(e) =>
                          updateRefundDraft(appt.id, { reason: e.target.value })
                        }
                        placeholder="Refund reason (required)"
                      />
                      {previewPhp !== null && (
                        <p className="text-[11px] font-medium text-pine/80">
                          Will refund ₱{previewPhp.toLocaleString(undefined, { maximumFractionDigits: 2 })} of ₱{paidPhp.toLocaleString()}
                        </p>
                      )}
                      {(draft.percentage || draft.amountPhp) && previewPhp === null && (
                        <p className="text-[11px] text-red-700">
                          Enter a percentage between 1% and 99%, or an amount strictly less than ₱{paidPhp.toLocaleString()}.
                        </p>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!canSubmitRefund}
                        onClick={() => {
                          const pct = validPct ? (pctValue as number) : undefined;
                          const amtCentavos = validAmt
                            ? Math.round((amtPhpValue as number) * 100)
                            : undefined;
                          refundMutation.mutate({
                            id: appt.id,
                            percentage: pct,
                            amountCentavos: amtCentavos,
                            reason: draft.reason,
                          });
                        }}
                      >
                        <RotateCcw className="w-4 h-4" aria-hidden="true" />
                        Issue Partial Refund
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
