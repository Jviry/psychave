-- Seed data for local Supabase development and testing

-- 1. Users
INSERT INTO users (user_id, cognito_sub, email, role, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'cognito-sub-admin-1', 'admin@psychave.ph', 'admin', NOW()),
  ('00000000-0000-0000-0000-000000000002', 'cognito-sub-psych-1', 'dr.sarah@psychave.ph', 'psychologist', NOW()),
  ('00000000-0000-0000-0000-000000000003', 'cognito-sub-client-1', 'client.juan@example.com', 'client', NOW())
ON CONFLICT (user_id) DO NOTHING;

-- 2. Profiles
INSERT INTO admin_profiles (admin_id, full_name)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'PsychAve Admin')
ON CONFLICT (admin_id) DO NOTHING;

INSERT INTO psychologist_profiles (
  psychologist_id, full_name, license_number, specialization, bio, approval_status, approved_by, approved_at
)
VALUES
  (
    '00000000-0000-0000-0000-000000000002',
    'Dr. Sarah Santos, RPsy',
    'RPSY-12345',
    'Cognitive Behavioral Therapy, Anxiety & Depression',
    'Licensed psychologist with 8+ years experience in CBT and adult psychotherapy.',
    'approved',
    '00000000-0000-0000-0000-000000000001',
    NOW()
  )
ON CONFLICT (psychologist_id) DO NOTHING;

INSERT INTO client_profiles (client_id)
VALUES
  ('00000000-0000-0000-0000-000000000003')
ON CONFLICT (client_id) DO NOTHING;

-- 3. Personas
INSERT INTO persona (
  persona_id, client_id, relation_to_account_holder, persona_name, date_of_birth,
  occupation, nationality, permanent_address, present_address, contact_number,
  preferred_contact_mode, emergency_contact_name, emergency_contact_relation, emergency_contact_number
)
VALUES
  (
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000003',
    'self_',
    'Juan Dela Cruz',
    '1995-05-15',
    'Software Engineer',
    'Filipino',
    '123 Taft Avenue, Manila',
    '456 BGC, Taguig City',
    '+639171234567',
    'email',
    'Maria Dela Cruz',
    'Spouse',
    '+639189876543'
  )
ON CONFLICT (persona_id) DO NOTHING;

-- 4. Services
INSERT INTO services (service_id, name, description, is_active)
VALUES
  (
    '00000000-0000-0000-0000-000000000101',
    'Initial Psychological Consultation',
    'Comprehensive 60-minute intake session and psychological assessment.',
    TRUE
  ),
  (
    '00000000-0000-0000-0000-000000000102',
    'Individual Psychotherapy Session',
    'Standard 50-minute individual follow-up psychotherapy session.',
    TRUE
  ),
  (
    '00000000-0000-0000-0000-000000000103',
    'Couples Therapy Consultation',
    '90-minute joint consultation for relationship counseling and therapy.',
    TRUE
  )
ON CONFLICT (service_id) DO NOTHING;
