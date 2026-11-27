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
  psychologistInviteRegisterSchema,
  getPasswordStrength,
  analyzePasswordStrength,
  isAcceptablePasswordStrength,
} from '../lib/authSchemas';

// ─────────────────────────────────────────────────────────────────
// registerSchema
// ─────────────────────────────────────────────────────────────────
describe('registerSchema', () => {
  const valid = {
    email: 'test@example.com',
    username: 'test_user-01',
    password: 'C4ctus-V3lv3t!9',
    confirmPassword: 'C4ctus-V3lv3t!9',
    privacyConsent: true as const,
  };

  it('accepts a fully valid client registration', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
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

  it('rejects weak password even if it meets character rules', () => {
    const result = registerSchema.safeParse({ ...valid, password: 'Password1!', confirmPassword: 'Password1!' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.password).toContain(
        'Password must be rated Good or Strong'
      );
    }
  });

  it('rejects fair password even if it meets character rules', () => {
    const result = registerSchema.safeParse({ ...valid, password: 'Pass@123', confirmPassword: 'Pass@123' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.password).toContain(
        'Password must be rated Good or Strong'
      );
    }
  });

  it('rejects password weakened by containing username or email', () => {
    const result = registerSchema.safeParse({
      ...valid,
      username: 'psychave_maria',
      email: 'maria@example.com',
      password: 'Psychave_maria99!',
      confirmPassword: 'Psychave_maria99!',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.password).toContain(
        'Password must be rated Good or Strong'
      );
    }
  });

  it('accepts strong password', () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: 'T9#mK2$vP8!qL5@x',
      confirmPassword: 'T9#mK2$vP8!qL5@x',
    });
    expect(result.success).toBe(true);
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
});

// ─────────────────────────────────────────────────────────────────
// psychologistInviteRegisterSchema
// ─────────────────────────────────────────────────────────────────
describe('psychologistInviteRegisterSchema', () => {
  const valid = {
    username: 'dr_santos',
    password: 'C4ctus-V3lv3t!9',
    confirmPassword: 'C4ctus-V3lv3t!9',
    fullName: 'Dr. Maria Santos',
    prcCredentialCode: 'PRC-RPSY-2024-001',
    specialization: 'Trauma-Informed CBT',
    bio: 'Licensed clinical psychologist specializing in trauma-informed care.',
    socialMediaLinks: [{ platform: 'Facebook', url: 'https://facebook.com/dr.santos' }],
  };

  it('accepts a valid invited psychologist registration with a good/strong password', () => {
    expect(psychologistInviteRegisterSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects weak or fair passwords on invited psychologist registration', () => {
    const weak = psychologistInviteRegisterSchema.safeParse({
      ...valid,
      password: 'Password1!',
      confirmPassword: 'Password1!',
    });
    expect(weak.success).toBe(false);

    const fair = psychologistInviteRegisterSchema.safeParse({
      ...valid,
      password: 'Pass@123',
      confirmPassword: 'Pass@123',
    });
    expect(fair.success).toBe(false);
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
// getPasswordStrength & analyzePasswordStrength (zxcvbn)
// ─────────────────────────────────────────────────────────────────
describe('getPasswordStrength', () => {
  it('returns "weak" for empty string', () => {
    expect(getPasswordStrength('')).toBe('weak');
  });

  it('returns "weak" for a trivially short password', () => {
    expect(getPasswordStrength('abc')).toBe('weak');
  });

  it('returns "weak" for predictable pattern passwords despite meeting character rules', () => {
    expect(getPasswordStrength('Password1!')).toBe('weak');
    expect(getPasswordStrength('Qwerty123!')).toBe('weak');
  });

  it('returns "fair" for a moderately guessable password', () => {
    expect(getPasswordStrength('Pass@123')).toBe('fair');
  });

  it('returns "good" for a reasonably strong password', () => {
    expect(getPasswordStrength('c4ctus-v3lv3t')).toBe('good');
  });

  it('returns "strong" for a high-entropy passphrase or random password', () => {
    expect(getPasswordStrength('correct-horse-battery-staple-99!')).toBe('strong');
    expect(getPasswordStrength('T9#mK2$vP8!qL5@x')).toBe('strong');
  });

  it('penalizes passwords containing user inputs such as username or email', () => {
    const withoutInputs = getPasswordStrength('psychave_maria99');
    const withInputs = getPasswordStrength('psychave_maria99', ['psychave_maria', 'maria@example.com']);
    expect(withInputs).toBe('weak');
    expect(withoutInputs).not.toBe('weak');
  });
});

describe('analyzePasswordStrength', () => {
  it('returns zxcvbn score and feedback for weak passwords', () => {
    const analysis = analyzePasswordStrength('password123');
    expect(analysis.strength).toBe('weak');
    expect(analysis.score).toBeLessThanOrEqual(1);
    expect(analysis.warning || analysis.suggestions.length > 0).toBeTruthy();
  });

  it('returns empty feedback and score 4 for very strong passwords', () => {
    const analysis = analyzePasswordStrength('correct-horse-battery-staple-99!');
    expect(analysis.strength).toBe('strong');
    expect(analysis.score).toBe(4);
    expect(analysis.warning).toBe('');
  });
});

describe('isAcceptablePasswordStrength', () => {
  it('returns false for weak and fair passwords', () => {
    expect(isAcceptablePasswordStrength('')).toBe(false);
    expect(isAcceptablePasswordStrength('Password1!')).toBe(false);
    expect(isAcceptablePasswordStrength('Pass@123')).toBe(false);
  });

  it('returns true for good and strong passwords', () => {
    expect(isAcceptablePasswordStrength('c4ctus-v3lv3t')).toBe(true);
    expect(isAcceptablePasswordStrength('T9#mK2$vP8!qL5@x')).toBe(true);
  });
});
