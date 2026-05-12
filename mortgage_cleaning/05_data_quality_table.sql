-- =============================================================================
-- 05_DATA_QUALITY_TABLE.SQL
-- Creates the data_quality_issues staging table and populates it with one
-- row per issue per record found after the cleaning pass in 03_clean.sql.
--
-- Run order: 01 → 02 → 03 → 04 → 05 → 06
--
-- issue_type values used:
--   MISSING         — required field is NULL or blank
--   INVALID_FORMAT  — field present but structurally wrong
--   OUT_OF_RANGE    — field present and formatted but value is implausible
--   DUPLICATE       — record is flagged as a duplicate of another borrower
-- =============================================================================

-- =============================================================================
-- CREATE STAGING TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS data_quality_issues (
    issue_id     SERIAL        PRIMARY KEY,
    borrower_id  INT           REFERENCES borrowers(borrower_id),
    table_name   VARCHAR(50)   NOT NULL,
    record_id    INT           NOT NULL,     -- PK of the offending row in table_name
    field_name   VARCHAR(100)  NOT NULL,
    issue_type   VARCHAR(30)   NOT NULL
                     CHECK (issue_type IN ('MISSING','INVALID_FORMAT','OUT_OF_RANGE','DUPLICATE')),
    raw_value    TEXT,                       -- original dirty value (SSN is masked below)
    created_at   TIMESTAMPTZ   DEFAULT NOW(),
    resolved_at  TIMESTAMPTZ,               -- set to NOW() when the issue is corrected
    resolved_by  VARCHAR(100)               -- analyst who resolved it
);

CREATE INDEX IF NOT EXISTS idx_dqi_borrower   ON data_quality_issues(borrower_id);
CREATE INDEX IF NOT EXISTS idx_dqi_issue_type ON data_quality_issues(issue_type);
CREATE INDEX IF NOT EXISTS idx_dqi_resolved   ON data_quality_issues(resolved_at);

-- Prevent double-loading: clear unresolved issues before repopulating
DELETE FROM data_quality_issues WHERE resolved_at IS NULL;


-- =============================================================================
-- SECTION 1 · MISSING REQUIRED FIELDS — borrowers
-- =============================================================================

INSERT INTO data_quality_issues
       (borrower_id, table_name, record_id, field_name, issue_type, raw_value)
SELECT borrower_id, 'borrowers', borrower_id, 'first_name', 'MISSING',
       first_name_raw
FROM   borrowers
WHERE  TRIM(COALESCE(first_name, '')) = ''

UNION ALL

SELECT borrower_id, 'borrowers', borrower_id, 'last_name', 'MISSING',
       last_name_raw
FROM   borrowers
WHERE  TRIM(COALESCE(last_name, '')) = '';


-- =============================================================================
-- SECTION 2 · SSN ISSUES
-- raw_value is always masked — only last 4 digits exposed.
-- =============================================================================

INSERT INTO data_quality_issues
       (borrower_id, table_name, record_id, field_name, issue_type, raw_value)
SELECT
    borrower_id,
    'borrowers',
    borrower_id,
    'ssn',
    CASE
        WHEN ssn_raw IS NULL OR ssn_raw = ''    THEN 'MISSING'
        ELSE                                         'INVALID_FORMAT'
    END AS issue_type,
    -- MASKED: never expose full SSN
    CASE
        WHEN LENGTH(REGEXP_REPLACE(COALESCE(ssn_raw,''), '[^0-9]', '', 'g')) >= 4
            THEN 'XXX-XX-' || RIGHT(REGEXP_REPLACE(ssn_raw, '[^0-9]', '', 'g'), 4)
        ELSE 'XXX-XX-????'
    END AS raw_value_masked
FROM   borrowers
WHERE  -- Post-clean: SSN should now be in XXX-XX-XXXX format if valid
       ssn IS NULL
    OR ssn !~ '^\d{3}-\d{2}-\d{4}$';


-- =============================================================================
-- SECTION 3 · PHONE ISSUES — contacts.phone_primary
-- =============================================================================

INSERT INTO data_quality_issues
       (borrower_id, table_name, record_id, field_name, issue_type, raw_value)
SELECT
    c.borrower_id,
    'contacts',
    c.contact_id,
    'phone_primary',
    CASE
        WHEN TRIM(COALESCE(c.phone_primary_raw, '')) = '' THEN 'MISSING'
        ELSE                                                   'INVALID_FORMAT'
    END,
    c.phone_primary_raw
FROM   contacts c
WHERE  -- Post-clean: valid phones are now (XXX) XXX-XXXX
       c.phone_primary IS NULL
    OR c.phone_primary !~ '^\(\d{3}\) \d{3}-\d{4}$';


-- =============================================================================
-- SECTION 4 · EMAIL ISSUES — contacts.email
-- =============================================================================

INSERT INTO data_quality_issues
       (borrower_id, table_name, record_id, field_name, issue_type, raw_value)
SELECT
    c.borrower_id,
    'contacts',
    c.contact_id,
    'email',
    CASE
        WHEN TRIM(COALESCE(c.email_raw, '')) = '' THEN 'MISSING'
        ELSE                                           'INVALID_FORMAT'
    END,
    c.email_raw
FROM   contacts c
WHERE  -- Post-clean: valid emails are lowercased RFC-ish strings; invalids → NULL
       c.email IS NULL
    OR c.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$';


-- =============================================================================
-- SECTION 5 · ZIP CODE ISSUES — contacts and properties
-- =============================================================================

INSERT INTO data_quality_issues
       (borrower_id, table_name, record_id, field_name, issue_type, raw_value)
SELECT
    c.borrower_id,
    'contacts',
    c.contact_id,
    'zip_code',
    CASE
        WHEN TRIM(COALESCE(c.zip_code_raw, '')) = '' THEN 'MISSING'
        ELSE                                              'INVALID_FORMAT'
    END,
    c.zip_code_raw
FROM   contacts c
WHERE  c.zip_code IS NULL
    OR (c.zip_code !~ '^\d{5}$' AND c.zip_code !~ '^\d{5}-\d{4}$')

UNION ALL

SELECT
    p.borrower_id,
    'properties',
    p.property_id,
    'zip_code',
    CASE
        WHEN TRIM(COALESCE(p.zip_code, '')) = '' THEN 'MISSING'
        ELSE                                          'INVALID_FORMAT'
    END,
    p.zip_code  -- no _raw column on properties; use current value
FROM   properties p
WHERE  p.zip_code IS NULL
    OR (p.zip_code !~ '^\d{5}$' AND p.zip_code !~ '^\d{5}-\d{4}$');


-- =============================================================================
-- SECTION 6 · MISSING ADDRESS — contacts.street_address
-- =============================================================================

INSERT INTO data_quality_issues
       (borrower_id, table_name, record_id, field_name, issue_type, raw_value)
SELECT
    c.borrower_id,
    'contacts',
    c.contact_id,
    'street_address',
    'MISSING',
    NULL
FROM   contacts c
WHERE  c.street_address IS NULL;


-- =============================================================================
-- SECTION 7 · LOAN REQUIRED FIELDS — loan_number, current_balance, interest_rate
-- =============================================================================

INSERT INTO data_quality_issues
       (borrower_id, table_name, record_id, field_name, issue_type, raw_value)
SELECT l.borrower_id, 'loans', l.loan_id, 'loan_number', 'MISSING', NULL
FROM   loans l
WHERE  l.loan_number IS NULL

UNION ALL

SELECT l.borrower_id, 'loans', l.loan_id, 'current_balance', 'MISSING',
       l.current_balance_raw
FROM   loans l
WHERE  l.current_balance IS NULL OR TRIM(l.current_balance) = ''

UNION ALL

SELECT l.borrower_id, 'loans', l.loan_id, 'interest_rate', 'MISSING',
       l.interest_rate_raw
FROM   loans l
WHERE  l.interest_rate IS NULL OR TRIM(l.interest_rate) = '';


-- =============================================================================
-- SECTION 8 · INTEREST RATE OUT OF RANGE  (post-clean plausibility check)
-- A valid US mortgage rate is expected between 0.5% and 20%.
-- =============================================================================

INSERT INTO data_quality_issues
       (borrower_id, table_name, record_id, field_name, issue_type, raw_value)
SELECT
    l.borrower_id,
    'loans',
    l.loan_id,
    'interest_rate',
    'OUT_OF_RANGE',
    l.interest_rate_raw
FROM   loans l
WHERE  l.interest_rate IS NOT NULL
  AND  l.interest_rate ~ '^[0-9]*\.?[0-9]+$'
  AND  l.interest_rate::NUMERIC NOT BETWEEN 0.5 AND 20.0;


-- =============================================================================
-- SECTION 9 · LOAN AMOUNT OUT OF RANGE  (sanity check)
-- =============================================================================

INSERT INTO data_quality_issues
       (borrower_id, table_name, record_id, field_name, issue_type, raw_value)
SELECT
    l.borrower_id,
    'loans',
    l.loan_id,
    'current_balance',
    'OUT_OF_RANGE',
    l.current_balance_raw
FROM   loans l
WHERE  l.current_balance IS NOT NULL
  AND  l.current_balance ~ '^[0-9]*\.?[0-9]+$'
  AND  l.current_balance::NUMERIC <= 0;


-- =============================================================================
-- SECTION 10 · DUPLICATE BORROWER FLAGS
-- =============================================================================

INSERT INTO data_quality_issues
       (borrower_id, table_name, record_id, field_name, issue_type, raw_value)
SELECT
    b.borrower_id,
    'borrowers',
    b.borrower_id,
    'borrower_id',
    'DUPLICATE',
    'Duplicate of borrower_id=' || b.duplicate_of_id::TEXT
    || '  reason=' || b.dedup_reason
FROM   borrowers b
WHERE  b.is_duplicate = TRUE;


-- =============================================================================
-- VERIFY: show all logged issues
-- =============================================================================

SELECT
    issue_id,
    borrower_id,
    table_name,
    record_id,
    field_name,
    issue_type,
    raw_value,
    resolved_at
FROM   data_quality_issues
ORDER  BY borrower_id, table_name, field_name;
