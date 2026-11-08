import { z } from 'zod';

// ──────────────────────────────────────────────
// Shared password rule (matches AWS Cognito defaults)
// ──────────────────────────────────────────────
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

// ──────────────────────────────────────────────
// Username rule: 3-30 chars, alphanumeric + _ -
// ──────────────────────────────────────────────
const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be at most 30 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens');

// ──────────────────────────────────────────────
// Register schema
// ──────────────────────────────────────────────
export const registerSchema = z
  .object({
    email: z.string().email('Please enter a valid email address'),
    username: usernameSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    privacyConsent: z.literal(true, {
      errorMap: () => ({ message: 'You must accept the Data Privacy Policy to continue' }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;

// ──────────────────────────────────────────────
// Login schema
// ──────────────────────────────────────────────
export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

// ──────────────────────────────────────────────
// Email confirmation (6-digit Cognito code)
// ──────────────────────────────────────────────
export const confirmSchema = z.object({
  code: z
    .string()
    .length(6, 'Confirmation code must be exactly 6 digits')
    .regex(/^\d{6}$/, 'Confirmation code must be numeric'),
});

export type ConfirmFormValues = z.infer<typeof confirmSchema>;

// ──────────────────────────────────────────────
// Forgot password — step 1: request code
// ──────────────────────────────────────────────
export const forgotPasswordRequestSchema = z.object({
  username: z.string().min(1, 'Username is required'),
});

export type ForgotPasswordRequestValues = z.infer<typeof forgotPasswordRequestSchema>;

// ──────────────────────────────────────────────
// Forgot password — step 2: submit code + new password
// ──────────────────────────────────────────────
export const forgotPasswordConfirmSchema = z
  .object({
    username: z.string().min(1, 'Username is required'),
    confirmationCode: z
      .string()
      .length(6, 'Code must be exactly 6 digits')
      .regex(/^\d{6}$/, 'Code must be numeric'),
    newPassword: passwordSchema,
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'Passwords do not match',
    path: ['confirmNewPassword'],
  });

export type ForgotPasswordConfirmValues = z.infer<typeof forgotPasswordConfirmSchema>;

// ──────────────────────────────────────────────
// Password strength util (used by live indicator)
// ──────────────────────────────────────────────
export type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong';

export function getPasswordStrength(password: string): PasswordStrength {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (password.length >= 12) score++;

  if (score <= 1) return 'weak';
  if (score === 2) return 'fair';
  if (score === 3) return 'good';
  return 'strong';
}
