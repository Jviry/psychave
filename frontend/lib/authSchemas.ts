import { z } from 'zod';
import zxcvbn from 'zxcvbn';

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
// Invited Psychologist Registration schema
// ──────────────────────────────────────────────
export const psychologistInviteRegisterSchema = z
  .object({
    username: usernameSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    fullName: z
      .string()
      .trim()
      .min(2, 'Full name must be at least 2 characters')
      .max(120, 'Full name must be under 120 characters'),
    prcCredentialCode: z
      .string()
      .trim()
      .min(3, 'PRC license credential code must be at least 3 characters')
      .max(80, 'Credential code must be under 80 characters'),
    specialization: z
      .string()
      .trim()
      .min(3, 'Specialization must be at least 3 characters')
      .max(150, 'Specialization must be under 150 characters'),
    bio: z
      .string()
      .trim()
      .min(10, 'Professional bio must be at least 10 characters')
      .max(1000, 'Professional bio must be under 1,000 characters'),
    socialMediaLinks: z
      .array(
        z.object({
          platform: z.string().trim().min(1, 'Choose a platform'),
          url: z
            .string()
            .trim()
            .min(1, 'Add the profile URL')
            .url('Enter a valid URL starting with http:// or https://'),
        })
      )
      .min(1, 'Add at least one social media contact link')
      .max(6, 'Add up to 6 social media links'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type PsychologistInviteRegisterFormValues = z.infer<
  typeof psychologistInviteRegisterSchema
>;

// ──────────────────────────────────────────────
// Password strength util (powered by zxcvbn)
// ──────────────────────────────────────────────
export type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong';

export interface PasswordStrengthAnalysis {
  strength: PasswordStrength;
  score: 0 | 1 | 2 | 3 | 4;
  warning: string;
  suggestions: string[];
}

export function analyzePasswordStrength(
  password: string,
  userInputs?: string[]
): PasswordStrengthAnalysis {
  if (!password) {
    return { strength: 'weak', score: 0, warning: '', suggestions: [] };
  }

  const sanitizedInputs = userInputs?.filter((input) => input.trim().length > 0);
  const result = zxcvbn(password, sanitizedInputs);

  let strength: PasswordStrength;
  if (result.score <= 1) strength = 'weak';
  else if (result.score === 2) strength = 'fair';
  else if (result.score === 3) strength = 'good';
  else strength = 'strong';

  return {
    strength,
    score: result.score,
    warning: result.feedback.warning,
    suggestions: result.feedback.suggestions,
  };
}

export function getPasswordStrength(
  password: string,
  userInputs?: string[]
): PasswordStrength {
  return analyzePasswordStrength(password, userInputs).strength;
}
