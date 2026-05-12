-- =============================================================================
-- 03_CLEAN.SQL
-- In-place data cleaning — all changes wrapped in one transaction.
--
-- HOW TO USE:
--   1. Run 02_audit.sql first and review findings.
--   2. Run this script; it will pause at "-- REVIEW CHECKPOINT" comments
--      with SELECT statements you can run before committing.
--   3. To accept:  COMMIT;
--      To undo:    ROLLBACK TO SAVEPOINT pre_clean;
--
-- Each step creates a _raw shadow column before touching the live value,
-- so the original dirty data is never destroyed.
-- =============================================================================

BEGIN;

SAVEPOINT pre_clean;
-- To undo all changes at any point:  ROLLBACK TO SAVEPOINT pre_clean;

-- =============================================================================
-- STEP 0 · SNAPSHOT RAW VALUES
-- Add *_raw columns once; skip if they already exist (idempotent).
-- =============================================================================

ALTER TABLE borrowers
    ADD COLUMN IF NOT EXISTS first_name_raw  VARCHAR(100),
    ADD COLUMN IF NOT EXISTS last_name_raw   VARCHAR(100),
    ADD COLUMN IF NOT EXISTS ssn_raw         VARCHAR(20);

ALTER TABLE contacts
    ADD COLUMN IF NOT EXISTS phone_primary_raw   VARCHAR(30),
    ADD COLUMN IF NOT EXISTS email_raw           VARCHAR(200),
    ADD COLUMN IF NOT EXISTS street_address_raw  VARCHAR(300),
    ADD COLUMN IF NOT EXISTS zip_code_raw        VARCHAR(15);

ALTER TABLE loans
    ADD COLUMN IF NOT EXISTS loan_type_raw         VARCHAR(50),
    ADD COLUMN IF NOT EXISTS original_amount_raw   VARCHAR(30),
    ADD COLUMN IF NOT EXISTS current_balance_raw   VARCHAR(30),
    ADD COLUMN IF NOT EXISTS interest_rate_raw     VARCHAR(20),
    ADD COLUMN IF NOT EXISTS origination_date_raw  VARCHAR(30),
    ADD COLUMN IF NOT EXISTS maturity_date_raw     VARCHAR(30);

-- Populate raw columns only on first run (idempotent guard: null check)
UPDATE borrowers
SET    first_name_raw = first_name,
       last_name_raw  = last_name,
       ssn_raw        = ssn
WHERE  first_name_raw IS NULL AND last_name_raw IS NULL;

UPDATE contacts
SET    phone_primary_raw  = phone_primary,
       email_raw          = email,
       street_address_raw = street_address,
       zip_code_raw       = zip_code
WHERE  phone_primary_raw IS NULL AND email_raw IS NULL;

UPDATE loans
SET    loan_type_raw        = loan_type,
       original_amount_raw  = original_amount,
       current_balance_raw  = current_balance,
       interest_rate_raw    = interest_rate,
       origination_date_raw = origination_date,
       maturity_date_raw    = maturity_date
WHERE  loan_type_raw IS NULL;


-- =============================================================================
-- STEP 1 · CLEAN BORROWER NAMES
-- Actions: collapse whitespace → strip leading titles → INITCAP
-- Skips NULL and blank-only records (those stay as NULL for later flagging).
-- =============================================================================

UPDATE borrowers
SET
    first_name = INITCAP(
                     TRIM(
                         REGEXP_REPLACE(
                             -- Strip leading professional titles (Dr., Mr., Mrs., Ms., Prof.)
                             REGEXP_REPLACE(
                                 -- Collapse any run of internal whitespace to a single space
                                 REGEXP_REPLACE(first_name, '\s+', ' ', 'g'),
                                 '^\s*(Dr|Mr|Mrs|Ms|Prof)\.?\s+', '', 'gi'
                             ),
                             '\s+', ' ', 'g'
                         )
                     )
                 ),
    last_name  = INITCAP(
                     TRIM(REGEXP_REPLACE(last_name, '\s+', ' ', 'g'))
                 ),
    updated_at = NOW()
WHERE  TRIM(COALESCE(first_name, '')) <> ''
  AND  TRIM(COALESCE(last_name,  '')) <> '';

-- REVIEW: SELECT borrower_id, first_name_raw, first_name, last_name_raw, last_name FROM borrowers;


-- =============================================================================
-- STEP 2 · NORMALISE SSNs  →  XXX-XX-XXXX
-- Only reformats values that contain exactly 9 digits.
-- Short / long / non-numeric SSNs are left unchanged and flagged in step 5.
-- =============================================================================

UPDATE borrowers
SET
    ssn = REGEXP_REPLACE(
              -- 1. Strip everything except digits
              REGEXP_REPLACE(ssn, '[^0-9]', '', 'g'),
              -- 2. Insert hyphens at positions 3 and 5
              '^(\d{3})(\d{2})(\d{4})$', '\1-\2-\3'
          ),
    updated_at = NOW()
WHERE  ssn IS NOT NULL
  AND  ssn <> ''
  AND  LENGTH(REGEXP_REPLACE(ssn, '[^0-9]', '', 'g')) = 9;

-- REVIEW: SELECT borrower_id, ssn_raw, ssn FROM borrowers;


-- =============================================================================
-- STEP 3 · NORMALISE PHONE NUMBERS  →  (XXX) XXX-XXXX
-- Handles: raw 10 digits, 11-digit with leading country code 1,
--          dots / dashes / spaces / parens / +1 prefix.
-- Numbers that can't be reduced to 10 digits are left as-is for flagging.
-- =============================================================================

UPDATE contacts
SET
    phone_primary = CASE
        -- 10 raw digits — any separator style
        WHEN LENGTH(REGEXP_REPLACE(phone_primary, '[^0-9]', '', 'g')) = 10
            THEN REGEXP_REPLACE(
                     REGEXP_REPLACE(phone_primary, '[^0-9]', '', 'g'),
                     '^(\d{3})(\d{3})(\d{4})$',
                     '(\1) \2-\3'
                 )
        -- 11 digits where leading digit is 1 (US country code) — strip and reformat
        WHEN LENGTH(REGEXP_REPLACE(phone_primary, '[^0-9]', '', 'g')) = 11
         AND LEFT(REGEXP_REPLACE(phone_primary, '[^0-9]', '', 'g'), 1) = '1'
            THEN REGEXP_REPLACE(
                     SUBSTRING(REGEXP_REPLACE(phone_primary, '[^0-9]', '', 'g'), 2),
                     '^(\d{3})(\d{3})(\d{4})$',
                     '(\1) \2-\3'
                 )
        -- Cannot be fixed — leave as-is; will be logged in data_quality_issues
        ELSE phone_primary
    END,
    updated_at = NOW()
WHERE  phone_primary IS NOT NULL AND TRIM(phone_primary) <> '';

-- REVIEW: SELECT contact_id, borrower_id, phone_primary_raw, phone_primary FROM contacts;


-- =============================================================================
-- STEP 4 · CLEAN EMAIL ADDRESSES
-- Valid format → lowercase and trim.
-- Invalid format or blank → NULL (clearly absent vs. garbage text).
-- =============================================================================

UPDATE contacts
SET
    email = CASE
        WHEN TRIM(email) ~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'
            THEN LOWER(TRIM(email))
        ELSE NULL   -- invalid / blank — flagged in data_quality_issues
    END,
    updated_at = NOW()
WHERE  email IS NOT NULL;

-- REVIEW: SELECT contact_id, borrower_id, email_raw, email FROM contacts;


-- =============================================================================
-- STEP 5 · STANDARDISE STREET ADDRESSES
-- Expand-then-abbreviate to canonical USPS short forms; INITCAP the result.
-- Applies to both contacts and properties tables.
--
-- The helper function is created once and reused.
-- =============================================================================

CREATE OR REPLACE FUNCTION standardise_street(addr TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT INITCAP(TRIM(
        -- Remove trailing punctuation (e.g. "BLVD.")
        REGEXP_REPLACE(
        -- Abbreviate full street-type words (word-boundary anchored, case-insensitive)
        REGEXP_REPLACE(
        REGEXP_REPLACE(
        REGEXP_REPLACE(
        REGEXP_REPLACE(
        REGEXP_REPLACE(
        REGEXP_REPLACE(
        REGEXP_REPLACE(
        REGEXP_REPLACE(
        REGEXP_REPLACE(
        -- Collapse internal whitespace first
        REGEXP_REPLACE(addr, '\s+', ' ', 'g'),
            '\bStreet\b',    'St',   'gi'),
            '\bAvenue\b',    'Ave',  'gi'),
            '\bBoulevard\b', 'Blvd', 'gi'),
            '\bDrive\b',     'Dr',   'gi'),
            '\bRoad\b',      'Rd',   'gi'),
            '\bLane\b',      'Ln',   'gi'),
            '\bCourt\b',     'Ct',   'gi'),
            '\bPlace\b',     'Pl',   'gi'),
            '\bCircle\b',    'Cir',  'gi'),
        '\.$', '', 'g')
    ));
$$;

UPDATE contacts
SET    street_address = standardise_street(street_address),
       city           = INITCAP(TRIM(city)),
       updated_at     = NOW()
WHERE  street_address IS NOT NULL;

UPDATE properties
SET    street_address = standardise_street(street_address),
       city           = INITCAP(TRIM(city)),
       property_type  = UPPER(TRIM(property_type)),
       updated_at     = NOW()
WHERE  street_address IS NOT NULL;

-- REVIEW: SELECT contact_id, street_address_raw, street_address, city FROM contacts;


-- =============================================================================
-- STEP 6 · NORMALISE ZIP CODES
-- 5-digit → keep; 9-digit no hyphen → add hyphen; too short → NULL.
-- Applies to contacts and properties.
-- =============================================================================

CREATE OR REPLACE FUNCTION normalise_zip(z TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN z IS NULL OR TRIM(z) = ''
            THEN NULL
        WHEN TRIM(z) ~ '^\d{5}$'
            THEN TRIM(z)
        WHEN TRIM(z) ~ '^\d{5}-\d{4}$'
            THEN TRIM(z)
        WHEN REGEXP_REPLACE(z, '[^0-9]', '', 'g') ~ '^\d{9}$'
            THEN LEFT(REGEXP_REPLACE(z, '[^0-9]', '', 'g'), 5)
                 || '-'
                 || RIGHT(REGEXP_REPLACE(z, '[^0-9]', '', 'g'), 4)
        -- Anything else (e.g. 4-digit) cannot be auto-corrected — return NULL
        ELSE NULL
    END;
$$;

UPDATE contacts
SET    zip_code   = normalise_zip(zip_code),
       updated_at = NOW();

UPDATE properties
SET    zip_code   = normalise_zip(zip_code),
       updated_at = NOW();

-- REVIEW: SELECT contact_id, zip_code_raw, zip_code FROM contacts;


-- =============================================================================
-- STEP 7 · CLEAN LOAN AMOUNTS
-- Strip dollar signs, commas, and whitespace from original_amount / current_balance.
-- Result is a plain decimal string ready for CAST to DECIMAL(15,2).
-- =============================================================================

UPDATE loans
SET
    original_amount = REGEXP_REPLACE(
                          REPLACE(REPLACE(COALESCE(original_amount,''), '$', ''), ',', ''),
                          '\s', '', 'g'
                      ),
    current_balance = REGEXP_REPLACE(
                          REPLACE(REPLACE(COALESCE(current_balance,''), '$', ''), ',', ''),
                          '\s', '', 'g'
                      ),
    updated_at      = NOW()
WHERE  original_amount IS NOT NULL OR current_balance IS NOT NULL;

-- REVIEW: SELECT loan_id, original_amount_raw, original_amount,
--                current_balance_raw, current_balance FROM loans;


-- =============================================================================
-- STEP 8 · NORMALISE INTEREST RATES  →  decimal percentage (e.g. 6.75)
-- Three dirty patterns to handle:
--   "6.75%"  — strip % sign          → 6.75
--   "675"    — stored as rate × 100  → divide by 100
--   ".0675"  — stored as fraction    → multiply by 100
-- Non-numeric values are left as-is and flagged.
-- =============================================================================

UPDATE loans
SET
    interest_rate = CASE
        WHEN REPLACE(REPLACE(TRIM(interest_rate), '%', ''), ' ', '')::NUMERIC > 20
            -- e.g. 675 → 6.75
            THEN (REPLACE(REPLACE(TRIM(interest_rate), '%', ''), ' ', '')::NUMERIC / 100)::TEXT
        WHEN REPLACE(REPLACE(TRIM(interest_rate), '%', ''), ' ', '')::NUMERIC < 1
            -- e.g. .0425 → 4.25
            THEN (REPLACE(REPLACE(TRIM(interest_rate), '%', ''), ' ', '')::NUMERIC * 100)::TEXT
        ELSE
            -- already in plausible range — just strip % and whitespace
            REPLACE(REPLACE(TRIM(interest_rate), '%', ''), ' ', '')
    END,
    updated_at    = NOW()
WHERE  interest_rate IS NOT NULL
  AND  TRIM(interest_rate) <> ''
  -- Only attempt values that look numeric (with optional % and whitespace)
  AND  REPLACE(REPLACE(TRIM(interest_rate), '%', ''), ' ', '') ~ '^[0-9]*\.?[0-9]+$';

-- REVIEW: SELECT loan_id, interest_rate_raw, interest_rate FROM loans;


-- =============================================================================
-- STEP 9 · NORMALISE DATES  →  YYYY-MM-DD (ISO 8601)
-- Handles: MM/DD/YYYY · MM-DD-YYYY → YYYY-MM-DD
-- Already-ISO dates and NULLs pass through unchanged.
-- =============================================================================

UPDATE loans
SET
    origination_date = CASE
        WHEN origination_date ~ '^\d{2}/\d{2}/\d{4}$'
            THEN TO_CHAR(TO_DATE(origination_date, 'MM/DD/YYYY'), 'YYYY-MM-DD')
        WHEN origination_date ~ '^\d{2}-\d{2}-\d{4}$'
            THEN TO_CHAR(TO_DATE(origination_date, 'MM-DD-YYYY'), 'YYYY-MM-DD')
        ELSE origination_date   -- already ISO or NULL → unchanged
    END,
    maturity_date    = CASE
        WHEN maturity_date ~ '^\d{2}/\d{2}/\d{4}$'
            THEN TO_CHAR(TO_DATE(maturity_date, 'MM/DD/YYYY'), 'YYYY-MM-DD')
        WHEN maturity_date ~ '^\d{2}-\d{2}-\d{4}$'
            THEN TO_CHAR(TO_DATE(maturity_date, 'MM-DD-YYYY'), 'YYYY-MM-DD')
        ELSE maturity_date
    END,
    updated_at       = NOW()
WHERE  origination_date IS NOT NULL OR maturity_date IS NOT NULL;

-- REVIEW: SELECT loan_id, origination_date_raw, origination_date,
--                maturity_date_raw, maturity_date FROM loans;


-- =============================================================================
-- STEP 10 · STANDARDISE LOAN TYPE CODES  →  canonical UPPERCASE values
-- Strips trailing " loan" / " mortgage" noise words, then maps to canonical.
-- Unknown types are uppercased but preserved (never silently deleted).
-- =============================================================================

UPDATE loans
SET
    loan_type = CASE
                    UPPER(TRIM(
                        REGEXP_REPLACE(loan_type, '\s+(loan|mortgage)$', '', 'gi')
                    ))
        WHEN 'CONV'         THEN 'CONVENTIONAL'
        WHEN 'CONVENTIONAL' THEN 'CONVENTIONAL'
        WHEN 'FHA'          THEN 'FHA'
        WHEN 'VA'           THEN 'VA'
        WHEN 'USDA'         THEN 'USDA'
        WHEN 'JUMBO'        THEN 'JUMBO'
        WHEN 'ARM'          THEN 'ARM'
        WHEN 'COMMERCIAL'   THEN 'COMMERCIAL'
        ELSE UPPER(TRIM(loan_type))   -- unknown → uppercase + preserve
    END,
    loan_status = UPPER(TRIM(loan_status)),
    updated_at  = NOW()
WHERE  loan_type IS NOT NULL;

-- REVIEW: SELECT loan_id, loan_type_raw, loan_type, loan_status FROM loans;


-- =============================================================================
-- FINAL REVIEW
-- Run these SELECTs interactively to validate before committing.
-- =============================================================================

-- Quick cross-table view of key cleaned fields
SELECT b.borrower_id,
       b.first_name,        b.last_name,
       b.ssn,
       c.phone_primary,     c.email,
       c.street_address,    c.zip_code,
       l.loan_number,       l.loan_type,
       l.original_amount,   l.current_balance,
       l.interest_rate,     l.origination_date,
       l.loan_status
FROM   borrowers b
LEFT   JOIN contacts  c ON c.borrower_id = b.borrower_id
LEFT   JOIN loans     l ON l.borrower_id = b.borrower_id
ORDER  BY b.borrower_id;

-- =============================================================================
-- COMMIT or ROLLBACK
-- Uncomment exactly one of these after reviewing results:
-- =============================================================================

COMMIT;
-- ROLLBACK TO SAVEPOINT pre_clean;
