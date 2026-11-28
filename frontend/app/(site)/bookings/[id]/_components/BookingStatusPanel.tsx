'use client';

import React, { useEffect, useState } from 'react';
import {
  Check,
  Clock,
  Copy,
  ExternalLink,
  Video,
} from 'lucide-react';
import type { BookingRequest, ProposedSlot } from '@/lib/types';
import { formatDeadlineCountdown, formatManilaDateTime } from '@/lib/booking';
import { SocialLinksList } from '@/components/SocialLinksList';
import { Button } from '@/components/ui/primitives';
import { SlotNegotiationPanel } from './SlotNegotiationPanel';

function DeadlineNotice({ deadline }: { deadline: string }) {
  const [, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-950 space-y-0.5">
      <p className="font-semibold">
        Pay by {formatManilaDateTime(deadline)} PHT
      </p>
      <p>{formatDeadlineCountdown(deadline)} · your agreed slot is held until then.</p>
    </div>
  );
}

interface BookingStatusPanelProps {
  booking: BookingRequest;
  counterSlot?: ProposedSlot;
  paymentQueryState: string | null;
  pollingTimedOut: boolean;
  isGatewayUnavailable: boolean;
  isRedirectingToCheckout: boolean;
  isAcceptingCounter: boolean;
  isSubmittingSlots: boolean;
  isPayingSession: boolean;
  isPayingRescheduleFee: boolean;
  evaluationFormUrl?: string | null;
  onAcceptCounter: (slotId: string) => void;
  onSubmitNewSlots: (slots: string[], onReset: () => void) => void;
  onPaySession: () => void;
  onPayRescheduleFee: () => void;
  onRetryPolling: () => void;
  onNewBooking: () => void;
}

export function BookingStatusPanel({
  booking,
  counterSlot,
  paymentQueryState,
  pollingTimedOut,
  isGatewayUnavailable,
  isRedirectingToCheckout,
  isAcceptingCounter,
  isSubmittingSlots,
  isPayingSession,
  isPayingRescheduleFee,
  evaluationFormUrl,
  onAcceptCounter,
  onSubmitNewSlots,
  onPaySession,
  onPayRescheduleFee,
  onRetryPolling,
  onNewBooking,
}: BookingStatusPanelProps) {
  const [copiedLink, setCopiedLink] = useState(false);

  const showContactLinks =
    booking.status !== 'pending' &&
    booking.status !== 'cancelled' &&
    (booking.contactUnlocked || (booking.psychologistSocialLinks?.length ?? 0) > 0);

  const needsRescheduleFee =
    booking.status === 'reschedule-requested' || booking.status === 'no-show';
  const isRefunded =
    booking.status === 'partially-refunded' || booking.status === 'refunded';

  const handleCopyMeetingLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Clipboard may be unavailable in restricted contexts
    }
  };

  return (
    <section
      aria-labelledby="next-steps-heading"
      className="rounded-2xl border border-mist bg-surface-raised p-6 space-y-5"
    >
      <h2
        id="next-steps-heading"
        className="font-heading text-xl font-medium text-pine"
      >
        Status
      </h2>

      {/* Pending */}
      {booking.status === 'pending' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
            <Clock className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
            <span>Waiting for a psychologist</span>
          </div>
          <p className="text-sm text-pine/80 leading-relaxed">
            Verified psychologists are reviewing your request and preferred times. You won&apos;t
            be charged until you agree on a schedule together, and your psychologist&apos;s contact
            links unlock as soon as they pick up your request.
          </p>
        </div>
      )}

      {/* Awaiting psychologist review */}
      {booking.status === 'awaiting-review' && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-pine">
            Assigned to {booking.psychologistCode}
          </p>
          <p className="text-sm text-pine/80 leading-relaxed">
            Your psychologist is reviewing your preferred times. We&apos;ll notify you as soon as
            they confirm a slot or suggest an alternative.
          </p>
        </div>
      )}

      {/* Awaiting client response */}
      {booking.status === 'awaiting-client' && (
        <SlotNegotiationPanel
          booking={booking}
          counterSlot={counterSlot}
          paymentQueryState={paymentQueryState}
          isAccepting={isAcceptingCounter}
          isSubmittingSlots={isSubmittingSlots}
          onAcceptCounter={onAcceptCounter}
          onSubmitNewSlots={onSubmitNewSlots}
        />
      )}

      {/* Awaiting payment */}
      {booking.status === 'awaiting-payment' && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-pine">
            Agreed with {booking.psychologistCode}
          </p>

          {paymentQueryState === 'success' && (
            <div
              role="status"
              className="rounded-xl border border-mint bg-parchment px-3.5 py-3 text-xs text-pine space-y-2"
            >
              <div className="flex items-center gap-2 font-semibold text-accent-ink">
                <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  {pollingTimedOut
                    ? 'Still waiting for PayMongo confirmation'
                    : 'Verifying your payment…'}
                </span>
              </div>
              <p className="text-pine/80">
                {pollingTimedOut
                  ? 'Your checkout completed, but the confirmation webhook has not arrived yet. Click below to check again.'
                  : 'Checking payment confirmation from PayMongo. This page updates automatically as soon as it arrives.'}
              </p>
              {pollingTimedOut && (
                <Button type="button" variant="outline" size="sm" onClick={onRetryPolling}>
                  Check payment status again
                </Button>
              )}
            </div>
          )}

          {paymentQueryState === 'cancelled' && (
            <div
              role="status"
              className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-950 space-y-1"
            >
              <p className="font-semibold">
                Payment was cancelled — your slot is still held until the deadline.
              </p>
              <p>You can retry payment anytime before the deadline below.</p>
            </div>
          )}

          {booking.paymentDeadline && <DeadlineNotice deadline={booking.paymentDeadline} />}

          <Button
            type="button"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={
              isPayingSession ||
              isRedirectingToCheckout ||
              (paymentQueryState === 'success' && !pollingTimedOut)
            }
            onClick={onPaySession}
          >
            {isRedirectingToCheckout
              ? 'Redirecting to PayMongo…'
              : isPayingSession
                ? 'Preparing Checkout…'
                : paymentQueryState === 'cancelled'
                  ? `Retry Payment (₱${booking.pricePhp?.toLocaleString()})`
                  : `Pay ₱${booking.pricePhp?.toLocaleString()} & Confirm Session`}
          </Button>

          {isGatewayUnavailable && (
            <div
              role="status"
              className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-950"
            >
              PayMongo is temporarily unavailable. Reach out to your psychologist below to arrange
              manual payment; once verified, an admin will confirm your session.
            </div>
          )}
        </div>
      )}

      {/* Paid-confirmed & Completed */}
      {(booking.status === 'paid-confirmed' || booking.status === 'completed') && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-pine">
            {booking.status === 'completed'
              ? `Completed with ${booking.psychologistCode}`
              : `Confirmed with ${booking.psychologistCode}`}
          </p>

          {/* Active Teleconsultation Meeting Link — shown for upcoming confirmed sessions only */}
          {booking.status === 'paid-confirmed' && (
            <div className="rounded-xl border border-mist bg-parchment p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent-ink">
                <Video className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Teleconsultation Meeting Link</span>
              </div>

              {booking.meetingLink ? (
                <div className="space-y-2.5">
                  <a
                    href={booking.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 w-full rounded-full bg-sage px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-ink transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
                  >
                    <span>Join Teleconsultation Session</span>
                    <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
                  </a>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono text-pine/75 truncate">{booking.meetingLink}</span>
                    <button
                      type="button"
                      onClick={() => void handleCopyMeetingLink(booking.meetingLink!)}
                      className="inline-flex items-center gap-1 shrink-0 font-semibold text-accent-ink hover:text-pine cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
                    >
                      {copiedLink ? (
                        <>
                          <Check className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Copy link</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-pine/75 leading-relaxed">
                  Your meeting link will appear here once added by your psychologist before the
                  session.
                </p>
              )}
            </div>
          )}

          {booking.status === 'completed' && !evaluationFormUrl && (
            <p className="text-xs text-pine/75 leading-relaxed">
              This session has been completed. Thank you for booking with PsychAve PH.
            </p>
          )}

          {booking.status === 'completed' && evaluationFormUrl && (
            <div className="rounded-xl border border-sage/40 bg-surface-sunken p-4 space-y-2 text-xs">
              <p className="font-semibold text-pine">Post-Session Evaluation</p>
              <p className="text-pine/75">
                Share your feedback on this session using our short evaluation form.
              </p>
              <a
                href={evaluationFormUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-semibold text-accent-ink underline underline-offset-4 hover:text-pine focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage rounded-xs"
              >
                <span>Open Evaluation Form</span>
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            </div>
          )}
        </div>
      )}

      {/* Reschedule fee required / No-show */}
      {needsRescheduleFee && (
        <div className="space-y-4">
          {paymentQueryState === 'success' && (
            <div
              role="status"
              className="rounded-xl border border-mint bg-parchment px-3.5 py-3 text-xs text-pine space-y-2"
            >
              <div className="flex items-center gap-2 font-semibold text-accent-ink">
                <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  {pollingTimedOut
                    ? 'Still waiting for reschedule fee confirmation'
                    : 'Verifying your ₱600 reschedule fee…'}
                </span>
              </div>
              {pollingTimedOut && (
                <Button type="button" variant="outline" size="sm" onClick={onRetryPolling}>
                  Check payment status again
                </Button>
              )}
            </div>
          )}

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-900">
              {booking.status === 'no-show'
                ? 'Session Marked No-Show'
                : 'Late Reschedule Fee Required'}
            </p>
            <p className="font-heading text-lg font-medium text-pine">₱600 Reschedule Fee</p>
            <p className="text-xs text-pine/80 leading-relaxed">
              {booking.status === 'no-show'
                ? 'Pay the ₱600 rescheduling fee to propose new times — or contact your psychologist below if you had a valid reason so they can waive the fee.'
                : 'Your reschedule request was submitted within 2 hours of the session. Pay the ₱600 fee to proceed, or contact your psychologist below to request a waiver.'}
            </p>
          </div>

          <Button
            type="button"
            variant="primary"
            size="md"
            className="w-full"
            disabled={
              isPayingRescheduleFee ||
              isRedirectingToCheckout ||
              (paymentQueryState === 'success' && !pollingTimedOut)
            }
            onClick={onPayRescheduleFee}
          >
            {isRedirectingToCheckout
              ? 'Redirecting to PayMongo…'
              : isPayingRescheduleFee
                ? 'Preparing Checkout…'
                : 'Pay ₱600 Reschedule Fee'}
          </Button>
        </div>
      )}

      {/* Refunded / Partially Refunded */}
      {isRefunded && (
        <div className="rounded-xl border border-mist bg-surface-sunken p-4 space-y-1.5">
          <p className="text-sm font-semibold text-pine">
            {booking.status === 'refunded' ? 'Full Refund Issued' : 'Partial Refund Issued'}
          </p>
          {booking.refundAmountCentavos != null && (
            <p className="text-sm font-mono font-semibold text-accent-ink tabular-nums">
              Refund Amount: ₱{(booking.refundAmountCentavos / 100).toLocaleString()}
            </p>
          )}
          {booking.refundReason && (
            <p className="text-xs text-pine/75">Reason: {booking.refundReason}</p>
          )}
        </div>
      )}

      {/* Cancelled */}
      {booking.status === 'cancelled' && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-red-900">Session Cancelled</p>
          <p className="text-sm text-red-800 leading-relaxed">
            This session request has been cancelled. You can submit a new request whenever
            you&apos;re ready.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={onNewBooking}>
            Request a New Session
          </Button>
        </div>
      )}

      {/* Psychologist Contact Links — unlocked on pickup for all non-cancelled post-pickup states */}
      {showContactLinks && (
        <div className="pt-4 border-t border-mist/60 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-pine/60">
            How to reach your psychologist
          </p>
          <p className="text-xs text-pine/75 leading-relaxed">
            Connect using any link below to coordinate your session or scheduling.
          </p>
          <SocialLinksList
            links={booking.psychologistSocialLinks}
            emptyMessage="Your psychologist has not added contact links yet."
          />
        </div>
      )}
    </section>
  );
}
