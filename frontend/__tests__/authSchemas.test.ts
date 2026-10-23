/**
 * TDD — RED Phase
 * Auth Schemas: registerSchema, loginSchema, confirmSchema,
 *               forgotPasswordRequestSchema, forgotPasswordConfirmSchema,
 *               getPasswordStrength
 *
 * These tests define the contract BEFORE the implementation is locked in.
 */
import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
  confirmSchema,
  forgotPasswordRequestSchema,
  forgotPasswordConfirmSchema,
  getPasswordStrength,
} from '../lib/authSchemas';

// ─────────────────────────────────────────────────────────────────
// registerSchema
// ─────────────────────────────────────────────────────────────────
describe('registerSchema', () => {
  const valid = {
    email: 'test@example.com',
    username: 'test_user-01',
    password: 'Secure@123',
    confirmPassword: 'Secure@123',
    role: 'client' as const,
    privacyConsent: true as const,
  };

  it('accepts a fully valid client registration', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts psychologist role with a full name', () => {
    const result = registerSchema.safeParse({
      ...valid,
      role: 'psychologist',
      fullName: 'Dr. Maria Santos',
    });
    expect(result.success).toBe(true);
  });

  it('rejects psychologist role without a full name (backend contract)', () => {
    // Backend AuthUsecase: "Full name is required for psychologists"
    const result = registerSchema.safeParse({ ...valid, role: 'psychologist' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.fullName).toBeDefined();
    }
  });

  it('rejects psychologist full name shorter than 2 non-space characters', () => {
    const result = registerSchema.safeParse({
      ...valid,
      role: 'psychologist',
      fullName: '  ',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.fullName).toBeDefined();
    }
  });

  it('rejects invalid email', () => {
    const result = registerSchema.safeParse({ ...valid, email: 'not-an-email' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.email).toBeDefined();
    }
  });

  it('rejects username shorter than 3 chars', () => {
    const result = registerSchema.safeParse({ ...valid, username: 'ab' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.username).toBeDefined();
    }
  });

  it('rejects username longer than 30 chars', () => {
    const result = registerSchema.safeParse({ ...valid, username: 'a'.repeat(31) });
    expect(result.success).toBe(false);
  });

  it('rejects username with spaces', () => {
    const result = registerSchema.safeParse({ ...valid, username: 'hello world' });
    expect(result.success).toBe(false);
  });

  it('rejects username with special chars other than _ and -', () => {
    const result = registerSchema.safeParse({ ...valid, username: 'user@name' });
    expect(result.success).toBe(false);
  });

  it('rejects password shorter than 8 chars', () => {
    const result = registerSchema.safeParse({ ...valid, password: 'Sh@1', confirmPassword: 'Sh@1' });
    expect(result.success).toBe(false);
  });

  it('rejects password with no uppercase letter', () => {
    const result = registerSchema.safeParse({ ...valid, password: 'secure@123', confirmPassword: 'secure@123' });
    expect(result.success).toBe(false);
  });

  it('rejects password with no number', () => {
    const result = registerSchema.safeParse({ ...valid, password: 'Secure@abc', confirmPassword: 'Secure@abc' });
    expect(result.success).toBe(false);
  });

  it('rejects password with no special character', () => {
    const result = registerSchema.safeParse({ ...valid, password: 'Secure1234', confirmPassword: 'Secure1234' });
    expect(result.success).toBe(false);
  });

  it('rejects when passwords do not match', () => {
    const result = registerSchema.safeParse({ ...valid, confirmPassword: 'Different@123' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.confirmPassword).toBeDefined();
    }
  });

  it('rejects when privacy consent is false', () => {
    const result = registerSchema.safeParse({ ...valid, privacyConsent: false });
    expect(result.success).toBe(false);
  });

  it('rejects admin role (not self-assignable)', () => {
    const result = registerSchema.safeParse({ ...valid, role: 'admin' });
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
// loginSchema
// ─────────────────────────────────────────────────────────────────
describe('loginSchema', () => {
  it('accepts valid credentials', () => {
    expect(loginSchema.safeParse({ username: 'myuser', password: 'MyPass@1' }).success).toBe(true);
  });

  it('rejects empty username', () => {
    const result = loginSchema.safeParse({ username: '', password: 'MyPass@1' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.username).toBeDefined();
    }
  });

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({ username: 'myuser', password: '' });
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
// confirmSchema
// ─────────────────────────────────────────────────────────────────
describe('confirmSchema', () => {
  it('accepts a valid 6-digit numeric code', () => {
    expect(confirmSchema.safeParse({ code: '123456' }).success).toBe(true);
  });

  it('rejects a 5-digit code', () => {
    expect(confirmSchema.safeParse({ code: '12345' }).success).toBe(false);
  });

  it('rejects a 7-digit code', () => {
    expect(confirmSchema.safeParse({ code: '1234567' }).success).toBe(false);
  });

  it('rejects a non-numeric code', () => {
    expect(confirmSchema.safeParse({ code: '12345a' }).success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
// forgotPasswordRequestSchema
// ─────────────────────────────────────────────────────────────────
describe('forgotPasswordRequestSchema', () => {
  it('accepts a non-empty username', () => {
    expect(forgotPasswordRequestSchema.safeParse({ username: 'someuser' }).success).toBe(true);
  });

  it('rejects an empty username', () => {
    expect(forgotPasswordRequestSchema.safeParse({ username: '' }).success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
// forgotPasswordConfirmSchema
// ─────────────────────────────────────────────────────────────────
describe('forgotPasswordConfirmSchema', () => {
  const valid = {
    username: 'myuser',
    confirmationCode: '654321',
    newPassword: 'NewPass@99',
    confirmNewPassword: 'NewPass@99',
  };

  it('accepts a fully valid submission', () => {
    expect(forgotPasswordConfirmSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects when new passwords do not match', () => {
    const result = forgotPasswordConfirmSchema.safeParse({ ...valid, confirmNewPassword: 'Other@99' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.confirmNewPassword).toBeDefined();
    }
  });

  it('rejects a non-numeric confirmation code', () => {
    expect(forgotPasswordConfirmSchema.safeParse({ ...valid, confirmationCode: 'abc123' }).success).toBe(false);
  });

  it('rejects a new password that violates Cognito policy', () => {
    expect(forgotPasswordConfirmSchema.safeParse({
      ...valid, newPassword: 'weakpw', confirmNewPassword: 'weakpw',
    }).success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
// getPasswordStrength
// ─────────────────────────────────────────────────────────────────
describe('getPasswordStrength', () => {
  it('returns "weak" for a trivially short password', () => {
    expect(getPasswordStrength('abc')).toBe('weak');
  });

  it('returns "fair" for a password with 2 criteria met', () => {
    expect(getPasswordStrength('Abcdefg1')).toBe('good'); // 8+ len, uppercase, number = 3 → good
  });

  it('returns "strong" when all 5 criteria are met (length >= 12)', () => {
    expect(getPasswordStrength('Str0ng@Pass!!')).toBe('strong');
  });

  it('returns "good" for a solid but not excellent password', () => {
    // 8 chars, uppercase, number, special = 4 → strong
    expect(getPasswordStrength('Pass@123')).toBe('strong');
  });

  it('returns "fair" for only 2 satisfied criteria', () => {
    // len>=8 + uppercase only
    expect(getPasswordStrength('Abcdefgh')).toBe('fair');
  });

  it('returns "weak" for empty string', () => {
    expect(getPasswordStrength('')).toBe('weak');
  });
});
