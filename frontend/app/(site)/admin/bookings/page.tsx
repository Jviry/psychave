'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Loader2,
  Receipt,
  RefreshCw,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { BookingRequest } from '@/lib/types';
import {
  BookingStatusTag,
  Button,
  Card,
  EmptyState,
  Input,
  Label,
  Modal,
  Select,
  Skeleton,
} from '@/components/ui/primitives';

type AdminTab = 'awaiting_payment' | 'refunds';
type RefundFilterStatus =
  | 'confirmed'
  | 'completed'
  | 'no_show'
  | 'reschedule_requested'
  | 'partially_refunded'
  | 'refunded';

const ADMIN_TABS: { id: AdminTab; label: string }[] = [
  { id: 'awaiting_payment', label: 'Awaiting Payment' },
  { id: 'refunds', label: 'Paid & Refunds' },
];

const REFUND_STATUS_OPTIONS: { value: RefundFilterStatus; label: string }[] = [
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'no_show', label: 'No-Show' },
  { value: 'reschedule_requested', label: 'Reschedule Requested' },
  { value: 'partially_refunded', label: 'Partially Refunded' },
  { value: 'refunded', label: 'Refunded' },
];

const REFUND_PRESETS = [25, 50, 75] as const;
const PAGE_SIZE = 10;

const phpFormatter = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatPhp(amount: number): string {
  return `₱${phpFormatter.format(amount)}`;
}

function formatShortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

function formatDeadline(iso?: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function AdminBookingsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<AdminTab>('awaiting_payment');
  const [refundStatusFilter, setRefundStatusFilter] =
    useState<RefundFilterStatus>('confirmed');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  // Active modal state
  const [paymentModalAppt, setPaymentModalAppt] =
    useState<BookingRequest | null>(null);
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentModalError, setPaymentModalError] = useState<string | null>(
    null
  );

  const [refundModalAppt, setRefundModalAppt] =
    useState<BookingRequest | null>(null);
  const [refundPercentage, setRefundPercentage] = useState('');
  const [refundAmountPhp, setRefundAmountPhp] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundModalError, setRefundModalError] = useState<string | null>(null);

  const [viewRefundAppt, setViewRefundAppt] =
    useState<BookingRequest | null>(null);

  const [feedback, setFeedback] = useState<string | null>(null);
  const tabRefs = useRef<Record<AdminTab, HTMLButtonElement | null>>({
    awaiting_payment: null,
    refunds: null,
  });

  const queryStatus =
    activeTab === 'awaiting_payment' ? 'awaiting_payment' : refundStatusFilter;

  const {
    data: appointments = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin-appointments', queryStatus],
    queryFn: () => api.getAdminAppointments(queryStatus),
  });

  const filteredAppointments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return appointments;
    return appointments.filter((appt) => {
      const haystack = [
        appt.id,
        appt.profileLabel,
        appt.serviceTitle,
        appt.psychologistCode,
        appt.psychologistId,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [appointments, searchQuery]);

  // Reset pagination whenever filters change
  useEffect(() => {
    setPage(1);
  }, [activeTab, refundStatusFilter, searchQuery]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredAppointments.length / PAGE_SIZE)
  );
  const safePage = Math.min(page, totalPages);
  const paginatedAppointments = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredAppointments.slice(start, start + PAGE_SIZE);
  }, [filteredAppointments, safePage]);
  const firstRow =
    filteredAppointments.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const lastRow = Math.min(safePage * PAGE_SIZE, filteredAppointments.length);

  const confirmMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      api.confirmManualPayment(id, note),
    onSuccess: (updated) => {
      const clientName = updated.profileLabel || 'Client';
      const feeText =
        updated.pricePhp != null ? ` (${formatPhp(updated.pricePhp)})` : '';
      setFeedback(
        `Marked ${clientName}${feeText} as paid. Confirmation emails have been sent.`
      );
      closePaymentModal();
      queryClient.invalidateQueries({ queryKey: ['admin-appointments'] });
    },
    onError: (err: Error) => {
      setPaymentModalError(err.message || 'Could not confirm manual payment.');
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
    }) =>
      api.refundAdminAppointment(id, { amountCentavos, percentage, reason }),
    onSuccess: (updated) => {
      const clientName = updated.profileLabel || 'Client';
      const php = updated.refundAmountCentavos
        ? formatPhp(updated.refundAmountCentavos / 100)
        : '';
      setFeedback(
        `Sent ${php ? `${php} ` : ''}partial refund for ${clientName} via the payment provider.`
      );
      closeRefundModal();
      queryClient.invalidateQueries({ queryKey: ['admin-appointments'] });
    },
    onError: (err: Error) => {
      setRefundModalError(err.message || 'Could not issue partial refund.');
    },
  });

  function openPaymentModal(appt: BookingRequest) {
    setPaymentModalAppt(appt);
    setPaymentNote('');
    setPaymentModalError(null);
  }

  function closePaymentModal() {
    setPaymentModalAppt(null);
    setPaymentNote('');
    setPaymentModalError(null);
  }

  function openRefundModal(appt: BookingRequest) {
    setRefundModalAppt(appt);
    setRefundPercentage('');
    setRefundAmountPhp('');
    setRefundReason('');
    setRefundModalError(null);
  }

  function closeRefundModal() {
    setRefundModalAppt(null);
    setRefundPercentage('');
    setRefundAmountPhp('');
    setRefundReason('');
    setRefundModalError(null);
  }

  const handleTabChange = (next: AdminTab) => {
    setActiveTab(next);
    setFeedback(null);
  };

  const handleTabKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    idx: number
  ) => {
    let nextIdx: number | null = null;
    if (e.key === 'ArrowRight') {
      nextIdx = (idx + 1) % ADMIN_TABS.length;
    } else if (e.key === 'ArrowLeft') {
      nextIdx = (idx - 1 + ADMIN_TABS.length) % ADMIN_TABS.length;
    } else if (e.key === 'Home') {
      nextIdx = 0;
    } else if (e.key === 'End') {
      nextIdx = ADMIN_TABS.length - 1;
    }
    if (nextIdx === null) return;
    e.preventDefault();
    const nextTab = ADMIN_TABS[nextIdx];
    handleTabChange(nextTab.id);
    tabRefs.current[nextTab.id]?.focus();
  };

  // Refund modal live calculations (centavo-safe)
  const refundPaidPhp = refundModalAppt?.pricePhp ?? 0;
  const refundPaidCentavos = Math.round(refundPaidPhp * 100);
  const pctValue = refundPercentage ? Number(refundPercentage) : null;
  const amtPhpValue = refundAmountPhp ? Number(refundAmountPhp) : null;
  const amtCentavosValue =
    amtPhpValue !== null && Number.isFinite(amtPhpValue)
      ? Math.round(amtPhpValue * 100)
      : null;

  const validPct =
    pctValue !== null &&
    Number.isFinite(pctValue) &&
    Number.isInteger(pctValue) &&
    pctValue >= 1 &&
    pctValue <= 99 &&
    refundPaidCentavos > 0;
  const validAmt =
    amtCentavosValue !== null &&
    amtCentavosValue >= 1 &&
    amtCentavosValue < refundPaidCentavos;

  const refundPreviewPhp = validPct
    ? (refundPaidPhp * (pctValue as number)) / 100
    : validAmt
      ? (amtCentavosValue as number) / 100
      : null;

  const refundRangeInvalid =
    Boolean(refundPercentage || refundAmountPhp) && refundPreviewPhp === null;
  const canSubmitRefund =
    Boolean(refundModalAppt) &&
    refundPaidCentavos > 0 &&
    Boolean(refundReason.trim()) &&
    (validPct || validAmt) &&
    !refundMutation.isPending;

  const activeFilterLabel =
    REFUND_STATUS_OPTIONS.find((opt) => opt.value === refundStatusFilter)
      ?.label ?? refundStatusFilter;

  const paymentAgreedSlot = paymentModalAppt?.proposedSlots.find(
    (s) => s.id === paymentModalAppt.selectedSlotId
  );
  const refundAgreedSlot = refundModalAppt?.proposedSlots.find(
    (s) => s.id === refundModalAppt.selectedSlotId
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-mist pb-4">
        <div className="space-y-1">
          <h1 className="font-heading text-3xl font-medium text-pine">
            Payments &amp; Refunds
          </h1>
          <p className="text-sm text-pine/70">
            Confirm offline payments during provider outages or issue partial
            refunds through the payment provider.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Payment administration views"
          className="flex flex-wrap items-center gap-1 p-1 bg-surface-sunken rounded-lg border border-mist w-fit shrink-0"
        >
          {ADMIN_TABS.map((tab, idx) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[tab.id] = el;
                }}
                id={`bookings-tab-${tab.id}`}
                type="button"
                role="tab"
                tabIndex={isActive ? 0 : -1}
                aria-selected={isActive}
                aria-controls={`bookings-panel-${tab.id}`}
                onClick={() => handleTabChange(tab.id)}
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

      {feedback && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-lg border border-sage bg-parchment px-4 py-3 text-xs text-pine font-medium"
        >
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2
              className="w-4 h-4 text-sage shrink-0"
              aria-hidden="true"
            />
            <span className="break-words">{feedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Dismiss notification"
            className="min-h-7 min-w-7 p-1.5 inline-flex items-center justify-center rounded text-pine/65 hover:text-pine hover:bg-surface-sunken cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-sage"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      <div
        id={`bookings-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`bookings-tab-${activeTab}`}
      >
        <Card className="space-y-5">
          {/* Toolbar: Search + Status Select (Refunds tab) + Refresh + Live Count */}
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-mist pb-4">
            <div
              className={`grid grid-cols-1 gap-4 w-full sm:w-auto ${
                activeTab === 'refunds'
                  ? 'sm:grid-cols-[minmax(0,22rem)_14rem]'
                  : 'sm:grid-cols-[minmax(0,22rem)]'
              }`}
            >
              <div>
                <Label htmlFor="admin-bookings-search">Search bookings</Label>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pine/50"
                    aria-hidden="true"
                  />
                  <Input
                    id="admin-bookings-search"
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Booking ID, client, service, or RPsy…"
                    className="pl-9"
                  />
                </div>
              </div>

              {activeTab === 'refunds' && (
                <div>
                  <Label htmlFor="admin-bookings-status-filter">
                    Filter by status
                  </Label>
                  <Select
                    id="admin-bookings-status-filter"
                    value={refundStatusFilter}
                    onChange={(e) => {
                      setRefundStatusFilter(
                        e.target.value as RefundFilterStatus
                      );
                      setFeedback(null);
                    }}
                  >
                    {REFUND_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <p
                className="text-xs font-mono text-accent-ink font-semibold tabular-nums"
                aria-live="polite"
              >
                {isError
                  ? '—'
                  : `${filteredAppointments.length} ${
                      filteredAppointments.length === 1 ? 'booking' : 'bookings'
                    }`}
                {!isError &&
                  searchQuery.trim() &&
                  filteredAppointments.length !== appointments.length &&
                  ` (of ${appointments.length})`}
              </p>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                aria-label="Refresh bookings"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                Refresh
              </Button>
            </div>
          </div>

          {isError && !isLoading ? (
            <div
              role="alert"
              className="flex flex-col items-center text-center py-12 px-6 space-y-3"
            >
              <div className="w-11 h-11 rounded-full bg-danger-soft border border-danger-border flex items-center justify-center">
                <AlertTriangle
                  className="w-5 h-5 text-red-700"
                  aria-hidden="true"
                />
              </div>
              <div className="space-y-1 max-w-md">
                <p className="font-heading text-lg font-medium text-pine">
                  Unable to load bookings
                </p>
                <p className="text-xs text-pine/75 leading-relaxed">
                  {error instanceof Error
                    ? error.message
                    : 'The server could not be reached. Please retry before assuming there are no pending payments.'}
                </p>
              </div>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={isFetching}
                onClick={() => refetch()}
              >
                {isFetching ? (
                  <>
                    <Loader2
                      className="w-3.5 h-3.5 animate-spin"
                      aria-hidden="true"
                    />
                    Retrying…
                  </>
                ) : (
                  'Retry'
                )}
              </Button>
            </div>
          ) : (
            <>
              {/* Semantic Bookings Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <caption className="sr-only">
                    {activeTab === 'awaiting_payment'
                      ? 'Bookings awaiting manual payment verification'
                      : `${activeFilterLabel} bookings for partial refund review`}
                  </caption>
                  <thead>
                    <tr className="border-b border-mist text-pine/70 bg-parchment">
                      <th scope="col" className="py-3 px-4 font-semibold whitespace-nowrap">
                        Booking / ID
                      </th>
                      <th scope="col" className="py-3 px-4 font-semibold">
                        Client &amp; Service
                      </th>
                      <th scope="col" className="py-3 px-4 font-semibold whitespace-nowrap">
                        RPsy
                      </th>
                      <th scope="col" className="py-3 px-4 font-semibold whitespace-nowrap">
                        Schedule
                      </th>
                      <th scope="col" className="py-3 px-4 font-semibold text-right whitespace-nowrap">
                        Fee
                      </th>
                      <th scope="col" className="py-3 px-4 font-semibold whitespace-nowrap">
                        Status
                      </th>
                      <th scope="col" className="py-3 px-4 font-semibold text-right whitespace-nowrap">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-mist/60">
                    {isLoading ? (
                      Array.from({ length: 5 }).map((_, index) => (
                        <tr key={`skeleton-${index}`}>
                          <td colSpan={7} className="py-3 px-4">
                            <Skeleton className="h-9" />
                          </td>
                        </tr>
                      ))
                    ) : paginatedAppointments.length === 0 ? (
                      <tr>
                        <td colSpan={7}>
                          <EmptyState
                            icon={Receipt}
                            title={
                              searchQuery.trim()
                                ? 'No matching bookings'
                                : activeTab === 'awaiting_payment'
                                  ? 'No bookings awaiting payment'
                                  : `No ${activeFilterLabel.toLowerCase()} bookings`
                            }
                            description={
                              searchQuery.trim()
                                ? 'Try a different booking ID, client name, or psychologist code.'
                                : activeTab === 'awaiting_payment'
                                  ? 'Bookings with an agreed schedule waiting on payment will appear here.'
                                  : 'Switch the status filter above to inspect other paid sessions.'
                            }
                            action={
                              searchQuery.trim() ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSearchQuery('')}
                                >
                                  Clear search
                                </Button>
                              ) : undefined
                            }
                          />
                        </td>
                      </tr>
                    ) : (
                      paginatedAppointments.map((appt) => {
                        const agreedSlot = appt.proposedSlots.find(
                          (s) => s.id === appt.selectedSlotId
                        );
                        const paidPhp = appt.pricePhp ?? 0;
                        const deadline = formatDeadline(appt.paymentDeadline);
                        const isAlreadyRefunded =
                          appt.status === 'partially-refunded' ||
                          appt.status === 'refunded';

                        return (
                          <tr key={appt.id} className="hover:bg-parchment">
                            <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                              <span
                                title={appt.id}
                                className="font-mono text-pine/80 font-medium"
                              >
                                {formatShortId(appt.id)}
                              </span>
                              {activeTab === 'awaiting_payment' && deadline && (
                                <p className="text-xs text-pine/65 mt-0.5 tabular-nums">
                                  Due {deadline}
                                </p>
                              )}
                            </td>

                            <td className="py-3.5 px-4 align-middle min-w-[14rem] max-w-[18rem] break-words">
                              <p className="font-medium text-pine">
                                {appt.profileLabel || 'Client'}
                              </p>
                              <p className="text-pine/70 mt-0.5">
                                {appt.serviceTitle}
                              </p>
                            </td>

                            <td className="py-3.5 px-4 align-middle font-mono text-pine/80 whitespace-nowrap">
                              {appt.psychologistCode ||
                                appt.psychologistId ||
                                '—'}
                            </td>

                            <td className="py-3.5 px-4 align-middle whitespace-nowrap tabular-nums">
                              {agreedSlot ? (
                                <>
                                  <p className="font-medium text-pine">
                                    {agreedSlot.dateLabel}
                                  </p>
                                  <p className="text-pine/70 mt-0.5">
                                    {agreedSlot.timeLabel}
                                  </p>
                                </>
                              ) : (
                                <span className="text-pine/60">—</span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 align-middle text-right font-mono font-semibold text-pine tabular-nums whitespace-nowrap">
                              {formatPhp(paidPhp)}
                              {isAlreadyRefunded &&
                                appt.refundAmountCentavos != null && (
                                  <p className="text-xs font-normal text-accent-ink mt-0.5">
                                    −{formatPhp(appt.refundAmountCentavos / 100)}{' '}
                                    refunded
                                  </p>
                                )}
                            </td>

                            <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                              <BookingStatusTag status={appt.status} />
                            </td>

                            <td className="py-3.5 px-4 align-middle text-right whitespace-nowrap">
                              {activeTab === 'awaiting_payment' ? (
                                <Button
                                  type="button"
                                  variant="primary"
                                  size="sm"
                                  onClick={() => openPaymentModal(appt)}
                                >
                                  <CreditCard
                                    className="w-3.5 h-3.5"
                                    aria-hidden="true"
                                  />
                                  Verify payment
                                </Button>
                              ) : isAlreadyRefunded ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setViewRefundAppt(appt)}
                                >
                                  View refund
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={paidPhp <= 0}
                                  title={
                                    paidPhp <= 0
                                      ? 'No refundable peso amount recorded'
                                      : undefined
                                  }
                                  onClick={() => openRefundModal(appt)}
                                >
                                  <RotateCcw
                                    className="w-3.5 h-3.5"
                                    aria-hidden="true"
                                  />
                                  Issue refund
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {filteredAppointments.length > PAGE_SIZE && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-mist pt-4 text-xs">
                  <p className="text-pine/70 tabular-nums" aria-live="polite">
                    Showing {firstRow}–{lastRow} of{' '}
                    {filteredAppointments.length} bookings
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={safePage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft
                        className="w-3.5 h-3.5"
                        aria-hidden="true"
                      />
                      Previous
                    </Button>
                    <span className="font-mono text-pine/70 tabular-nums px-1">
                      Page {safePage} of {totalPages}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={safePage >= totalPages}
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                    >
                      Next
                      <ChevronRight
                        className="w-3.5 h-3.5"
                        aria-hidden="true"
                      />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      {/* Modal 1: Confirm Manual Payment */}
      <Modal
        open={Boolean(paymentModalAppt)}
        onClose={() => {
          if (!confirmMutation.isPending) closePaymentModal();
        }}
        title="Confirm manual payment"
        description={
          paymentModalAppt
            ? `Record an offline payment verification for ${paymentModalAppt.profileLabel || 'Client'}.`
            : undefined
        }
        maxWidth="md"
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={closePaymentModal}
              disabled={confirmMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="manual-payment-form"
              variant="primary"
              disabled={
                confirmMutation.isPending ||
                !paymentModalAppt ||
                !paymentNote.trim()
              }
            >
              {confirmMutation.isPending
                ? 'Confirming…'
                : 'Confirm Manual Payment'}
            </Button>
          </>
        }
      >
        {paymentModalAppt && (
          <form
            id="manual-payment-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!paymentNote.trim() || confirmMutation.isPending) return;
              setPaymentModalError(null);
              confirmMutation.mutate({
                id: paymentModalAppt.id,
                note: paymentNote.trim(),
              });
            }}
            className="space-y-4"
          >
            <dl className="rounded-lg border border-mist bg-surface-sunken px-4 py-3 space-y-1.5 text-xs">
              <div className="flex justify-between gap-4">
                <dt className="text-pine/70 shrink-0">Booking ID</dt>
                <dd className="font-mono text-pine break-all text-right">
                  {paymentModalAppt.id}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-pine/70 shrink-0">Service</dt>
                <dd className="font-medium text-pine text-right break-words">
                  {paymentModalAppt.serviceTitle}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-pine/70 shrink-0">Assigned RPsy</dt>
                <dd className="font-mono text-pine text-right">
                  {paymentModalAppt.psychologistCode ||
                    paymentModalAppt.psychologistId ||
                    '—'}
                </dd>
              </div>
              {paymentAgreedSlot && (
                <div className="flex justify-between gap-4">
                  <dt className="text-pine/70 shrink-0">Agreed schedule</dt>
                  <dd className="font-medium text-pine text-right tabular-nums">
                    {paymentAgreedSlot.dateLabel} ·{' '}
                    {paymentAgreedSlot.timeLabel}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4 border-t border-mist pt-1.5">
                <dt className="text-pine/70 font-medium">Amount due</dt>
                <dd className="font-mono font-semibold text-pine tabular-nums">
                  {formatPhp(paymentModalAppt.pricePhp ?? 0)}
                </dd>
              </div>
            </dl>

            <div>
              <Label htmlFor="manual-payment-note">
                Payment reference / verification note
              </Label>
              <Input
                id="manual-payment-note"
                value={paymentNote}
                maxLength={300}
                aria-describedby="manual-payment-note-hint"
                onChange={(e) => setPaymentNote(e.target.value)}
                placeholder="e.g. GCash ref #1234567890 verified via email"
                required
                data-autofocus
              />
              <p
                id="manual-payment-note-hint"
                className="mt-1.5 text-xs text-pine/70"
              >
                Required for clinic accounting audit trail during payment
                provider outages.
              </p>
            </div>

            <div className="rounded-lg border border-mist bg-parchment px-3.5 py-2.5 text-xs text-pine/80 leading-relaxed">
              Marks this booking as <strong>paid</strong> and sends confirmation
              emails to both client and psychologist. This cannot be undone
              here.
            </div>

            {paymentModalError && (
              <p role="alert" className="text-xs text-red-700 break-words">
                {paymentModalError}
              </p>
            )}
          </form>
        )}
      </Modal>

      {/* Modal 2: Issue Partial Refund */}
      <Modal
        open={Boolean(refundModalAppt)}
        onClose={() => {
          if (!refundMutation.isPending) closeRefundModal();
        }}
        title="Issue partial refund"
        description={
          refundModalAppt
            ? `Disburse a partial refund for ${refundModalAppt.profileLabel || 'Client'} via the payment provider.`
            : undefined
        }
        maxWidth="md"
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={closeRefundModal}
              disabled={refundMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="partial-refund-form"
              variant="primary"
              disabled={!canSubmitRefund}
            >
              {refundMutation.isPending
                ? 'Issuing refund…'
                : 'Issue Partial Refund'}
            </Button>
          </>
        }
      >
        {refundModalAppt && (
          <form
            id="partial-refund-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!canSubmitRefund || !refundModalAppt) return;
              setRefundModalError(null);
              const pct = validPct ? (pctValue as number) : undefined;
              const amtCentavos = validAmt
                ? (amtCentavosValue as number)
                : undefined;
              refundMutation.mutate({
                id: refundModalAppt.id,
                percentage: pct,
                amountCentavos: amtCentavos,
                reason: refundReason.trim(),
              });
            }}
            className="space-y-4"
          >
            <dl className="rounded-lg border border-mist bg-surface-sunken px-4 py-3 space-y-1.5 text-xs">
              <div className="flex justify-between gap-4">
                <dt className="text-pine/70 shrink-0">Booking ID</dt>
                <dd className="font-mono text-pine break-all text-right">
                  {refundModalAppt.id}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-pine/70 shrink-0">Service</dt>
                <dd className="font-medium text-pine text-right break-words">
                  {refundModalAppt.serviceTitle}
                </dd>
              </div>
              {refundAgreedSlot && (
                <div className="flex justify-between gap-4">
                  <dt className="text-pine/70 shrink-0">Session schedule</dt>
                  <dd className="font-medium text-pine text-right tabular-nums">
                    {refundAgreedSlot.dateLabel} · {refundAgreedSlot.timeLabel}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4 border-t border-mist pt-1.5">
                <dt className="text-pine/70 font-medium">Amount paid</dt>
                <dd className="font-mono font-semibold text-pine tabular-nums">
                  {formatPhp(refundPaidPhp)}
                </dd>
              </div>
            </dl>

            {refundPaidCentavos <= 0 ? (
              <p role="alert" className="text-xs text-red-700">
                This booking has no recorded paid amount, so a partial refund
                cannot be issued.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium uppercase tracking-wider text-pine/65">
                      Partial refund amount (1%–99%)
                    </span>
                    <div className="flex items-center gap-1.5">
                      {REFUND_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          aria-pressed={refundPercentage === String(preset)}
                          onClick={() => {
                            setRefundPercentage(String(preset));
                            setRefundAmountPhp('');
                          }}
                          className={`min-h-7 min-w-7 px-2.5 py-1 rounded-md border text-xs font-medium cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-sage ${
                            refundPercentage === String(preset)
                              ? 'border-sage bg-surface-sunken text-pine font-semibold'
                              : 'border-mist bg-surface-raised text-pine/75 hover:border-mint'
                          }`}
                        >
                          {preset}%
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="modal-refund-pct">Percentage (%)</Label>
                      <Input
                        id="modal-refund-pct"
                        type="number"
                        min="1"
                        max="99"
                        step="1"
                        value={refundPercentage}
                        aria-invalid={refundRangeInvalid}
                        aria-describedby={
                          refundRangeInvalid ? 'refund-range-error' : undefined
                        }
                        onChange={(e) => {
                          setRefundPercentage(e.target.value);
                          setRefundAmountPhp('');
                        }}
                        placeholder="e.g. 50"
                        data-autofocus
                      />
                    </div>
                    <div>
                      <Label htmlFor="modal-refund-amt">
                        Or Peso Amount (₱)
                      </Label>
                      <Input
                        id="modal-refund-amt"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={refundAmountPhp}
                        aria-invalid={refundRangeInvalid}
                        aria-describedby={
                          refundRangeInvalid ? 'refund-range-error' : undefined
                        }
                        onChange={(e) => {
                          setRefundAmountPhp(e.target.value);
                          setRefundPercentage('');
                        }}
                        placeholder="e.g. 750"
                      />
                    </div>
                  </div>

                  {refundPreviewPhp !== null && (
                    <p className="text-xs font-medium text-accent-ink tabular-nums">
                      Will refund {formatPhp(refundPreviewPhp)} of{' '}
                      {formatPhp(refundPaidPhp)}
                    </p>
                  )}

                  {refundRangeInvalid && (
                    <p
                      id="refund-range-error"
                      role="alert"
                      className="text-xs text-red-700"
                    >
                      Enter a whole percentage between 1% and 99%, or an amount
                      between ₱0.01 and strictly less than{' '}
                      {formatPhp(refundPaidPhp)}.
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="modal-refund-reason">Refund reason</Label>
                  <Input
                    id="modal-refund-reason"
                    value={refundReason}
                    maxLength={300}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="Explain why this partial refund is being issued"
                    required
                  />
                </div>

                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-950 leading-relaxed">
                  Sends a real partial refund through the payment provider and
                  marks this booking as <strong>partially refunded</strong>.
                  This cannot be undone.
                </div>
              </>
            )}

            {refundModalError && (
              <p role="alert" className="text-xs text-red-700 break-words">
                {refundModalError}
              </p>
            )}
          </form>
        )}
      </Modal>

      {/* Modal 3: View Recorded Refund */}
      <Modal
        open={Boolean(viewRefundAppt)}
        onClose={() => setViewRefundAppt(null)}
        title="Refund details"
        description={
          viewRefundAppt
            ? `Recorded refund for ${viewRefundAppt.profileLabel || 'Client'}.`
            : undefined
        }
        maxWidth="sm"
        footer={
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setViewRefundAppt(null)}
          >
            Close
          </Button>
        }
      >
        {viewRefundAppt && (
          <dl className="rounded-lg border border-mist bg-surface-sunken px-4 py-3 space-y-2 text-xs">
            <div className="flex justify-between gap-4">
              <dt className="text-pine/70 shrink-0">Booking ID</dt>
              <dd className="font-mono text-pine break-all text-right">
                {viewRefundAppt.id}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-pine/70 shrink-0">Status</dt>
              <dd className="text-right">
                <BookingStatusTag status={viewRefundAppt.status} />
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-pine/70 shrink-0">Refunded amount</dt>
              <dd className="font-mono font-semibold text-pine tabular-nums">
                {viewRefundAppt.refundAmountCentavos != null
                  ? formatPhp(viewRefundAppt.refundAmountCentavos / 100)
                  : 'Recorded'}
              </dd>
            </div>
            {viewRefundAppt.refundReason && (
              <div className="border-t border-mist pt-2 space-y-1">
                <dt className="text-pine/70">Reason</dt>
                <dd className="text-pine leading-relaxed break-words">
                  {viewRefundAppt.refundReason}
                </dd>
              </div>
            )}
          </dl>
        )}
      </Modal>
    </div>
  );
}
