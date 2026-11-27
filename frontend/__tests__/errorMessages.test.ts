import { describe, it, expect } from 'vitest';
import { getFriendlyErrorMessage } from '../lib/errorMessages';

describe('getFriendlyErrorMessage', () => {
  const fallback = 'Something went wrong. Please try again.';

  it('maps timeout errors to a calm connection message', () => {
    expect(
      getFriendlyErrorMessage(
        new Error('Request timed out after 15000ms: https://api.internal/bookings'),
        fallback
      )
    ).toBe('The request took too long to respond. Please check your connection and try again.');
  });

  it('maps network errors to a calm offline/server message', () => {
    expect(getFriendlyErrorMessage(new Error('Failed to fetch'), fallback)).toBe(
      'We could not reach the server. Please check your internet connection and try again.'
    );
  });

  it('hides raw JSON payloads and URLs behind the fallback', () => {
    expect(getFriendlyErrorMessage(new Error('{"detail":"boom"}'), fallback)).toBe(fallback);
    expect(
      getFriendlyErrorMessage(new Error('Error contacting http://localhost:8000/api'), fallback)
    ).toBe(fallback);
  });

  it('preserves clean, short human-readable validation messages', () => {
    expect(
      getFriendlyErrorMessage(new Error('Choose at least 3 preferred schedules.'), fallback)
    ).toBe('Choose at least 3 preferred schedules.');
  });

  it('returns fallback for non-Error values', () => {
    expect(getFriendlyErrorMessage(null, fallback)).toBe(fallback);
    expect(getFriendlyErrorMessage('raw string', fallback)).toBe(fallback);
  });
});
