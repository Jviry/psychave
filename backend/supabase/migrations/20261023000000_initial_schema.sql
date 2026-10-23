-- Schema migration generated from SQLModel models and Alembic migrations

-- 1. Custom Types / Enums
DO $$ BEGIN
    CREATE TYPE personarelation AS ENUM ('self_', 'child', 'spouse', 'parent', 'sibling', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE contactmode AS ENUM ('phone', 'email', 'messenger', 'instagram');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY,
    cognito_sub VARCHAR NOT NULL,
    email VARCHAR NOT NULL,
    role VARCHAR NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS ix_users_cognito_sub ON users (cognito_sub);

-- 3. Admin Profiles Table
CREATE TABLE IF NOT EXISTS admin_profiles (
    admin_id UUID PRIMARY KEY REFERENCES users (user_id) ON DELETE CASCADE,
    full_name VARCHAR NOT NULL
);

-- 4. Psychologist Profiles Table
CREATE TABLE IF NOT EXISTS psychologist_profiles (
    psychologist_id UUID PRIMARY KEY REFERENCES users (user_id) ON DELETE CASCADE,
    full_name VARCHAR NOT NULL,
    license_number VARCHAR,
    specialization VARCHAR,
    approval_status VARCHAR NOT NULL DEFAULT 'pending',
    approved_by UUID REFERENCES admin_profiles (admin_id),
    approved_at TIMESTAMP WITHOUT TIME ZONE,
    bio VARCHAR
);

-- 5. Client Profiles Table
CREATE TABLE IF NOT EXISTS client_profiles (
    client_id UUID PRIMARY KEY REFERENCES users (user_id) ON DELETE CASCADE
);

-- 6. Services Table
CREATE TABLE IF NOT EXISTS services (
    service_id UUID PRIMARY KEY,
    name VARCHAR NOT NULL,
    description VARCHAR NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 7. Persona Table
CREATE TABLE IF NOT EXISTS persona (
    persona_id UUID PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES client_profiles (client_id) ON DELETE CASCADE,
    relation_to_account_holder personarelation NOT NULL DEFAULT 'self_',
    persona_name VARCHAR NOT NULL,
    date_of_birth DATE NOT NULL,
    occupation VARCHAR,
    nationality VARCHAR NOT NULL,
    permanent_address VARCHAR NOT NULL,
    present_address VARCHAR NOT NULL,
    contact_number VARCHAR NOT NULL,
    socmed_platform VARCHAR,
    socmed_username VARCHAR,
    preferred_contact_mode contactmode NOT NULL,
    emergency_contact_name VARCHAR NOT NULL,
    emergency_contact_relation VARCHAR NOT NULL,
    emergency_contact_number VARCHAR NOT NULL
);

-- 8. Forms Table
CREATE TABLE IF NOT EXISTS forms (
    form_id UUID PRIMARY KEY,
    persona_id UUID NOT NULL REFERENCES persona (persona_id) ON DELETE CASCADE,
    consent_version VARCHAR NOT NULL,
    terms_signer_name VARCHAR NOT NULL,
    terms_signer_relation VARCHAR NOT NULL,
    scope_acknowledged BOOLEAN NOT NULL,
    is_overseas_or_foreign BOOLEAN NOT NULL DEFAULT FALSE,
    overseas_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    information_confirmed BOOLEAN NOT NULL,
    consent_signer_name VARCHAR NOT NULL,
    signed_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- 9. Appointments Table
CREATE TABLE IF NOT EXISTS appointments (
    appointment_id UUID PRIMARY KEY,
    persona_id UUID NOT NULL REFERENCES persona (persona_id) ON DELETE CASCADE,
    selected_slot_id UUID,
    psychologist_id UUID REFERENCES psychologist_profiles (psychologist_id),
    price DOUBLE PRECISION,
    requested_datetime TIMESTAMP WITHOUT TIME ZONE,
    status VARCHAR NOT NULL DEFAULT 'pending',
    service_id UUID NOT NULL REFERENCES services (service_id),
    presenting_concern VARCHAR NOT NULL
);

-- 10. Proposed Slots Table
CREATE TABLE IF NOT EXISTS proposed_slots (
    slot_id UUID PRIMARY KEY,
    appointment_id UUID NOT NULL REFERENCES appointments (appointment_id) ON DELETE CASCADE,
    session_date DATE NOT NULL,
    start_time TIME WITHOUT TIME ZONE NOT NULL,
    end_time TIME WITHOUT TIME ZONE
);

DO $$ BEGIN
    ALTER TABLE appointments
        ADD CONSTRAINT fk_appointments_selected_slot_id_proposed_slots
        FOREIGN KEY (selected_slot_id) REFERENCES proposed_slots (slot_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 11. Payments Table
CREATE TABLE IF NOT EXISTS payments (
    payment_id UUID PRIMARY KEY,
    appointment_id UUID NOT NULL REFERENCES appointments (appointment_id) ON DELETE CASCADE,
    amount DOUBLE PRECISION NOT NULL,
    payment_method VARCHAR,
    provider VARCHAR NOT NULL DEFAULT 'fake',
    provider_ref VARCHAR,
    checkout_url VARCHAR,
    status VARCHAR NOT NULL DEFAULT 'pending',
    paid_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_payments_provider_ref ON payments (provider_ref);

-- 12. Alembic version tracking
CREATE TABLE IF NOT EXISTS alembic_version (
    version_num VARCHAR(32) NOT NULL,
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);
DELETE FROM alembic_version;
INSERT INTO alembic_version (version_num) VALUES ('f3a9c2d14b7e');
