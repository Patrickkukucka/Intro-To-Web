-- =============================================================================
-- 06_SUMMARY_REPORT.SQL
-- Data quality summary and letter-readiness report.
--
-- Run after 01–05 have been executed.
-- =============================================================================

-- =============================================================================
-- PART A · POPULATION COUNTS
-- =============================================================================

WITH
total_borrowers AS (
    SELECT COUNT(*)                                       AS n
    FROM   borrowers
),
non_duplicate_borrowers AS (
    SELECT COUNT(*)                                       AS n
    FROM   borrowers
    WHERE  COALESCE(is_duplicate, FALSE) = FALSE
),
duplicate_borrowers AS (
    SELECT COUNT(*)                                       AS n
    FROM   borrowers
    WHERE  is_duplicate = TRUE
),
borrowers_with_any_issue AS (
    SELECT COUNT(DISTINCT borrower_id)                    AS n
    FROM   data_quality_issues
    WHERE  resolved_at IS NULL
),
-- "Ready for letters" = non-duplicate + all required fields clean + loan is active
ready_for_letters AS (
    SELECT COUNT(DISTINCT b.borrower_id)                  AS n
    FROM   borrowers b
    JOIN   contacts  c ON c.borrower_id = b.borrower_id
    JOIN   loans     l ON l.borrower_id = b.borrower_id
    WHERE  COALESCE(b.is_duplicate, FALSE) = FALSE
      -- Name
      AND  TRIM(COALESCE(b.first_name,''))  <> ''
      AND  TRIM(COALESCE(b.last_name, ''))  <> ''
      -- SSN in clean format
      AND  b.ssn ~ '^\d{3}-\d{2}-\d{4}$'
      -- Contact
      AND  c.street_address IS NOT NULL
      AND  (c.zip_code ~ '^\d{5}$' OR c.zip_code ~ '^\d{5}-\d{4}$')
      AND  c.email        ~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'
      AND  c.phone_primary ~ '^\(\d{3}\) \d{3}-\d{4}$'
      -- Loan
      AND  l.loan_number    IS NOT NULL
      AND  l.current_balance IS NOT NULL
      AND  l.current_balance ~ '^[0-9]*\.?[0-9]+$'
      AND  l.current_balance::NUMERIC > 0
      AND  l.interest_rate  IS NOT NULL
      AND  l.interest_rate  ~ '^[0-9]*\.?[0-9]+$'
      AND  l.interest_rate::NUMERIC BETWEEN 0.5 AND 20.0
      AND  l.loan_status = 'ACTIVE'
)
SELECT
    (SELECT n FROM total_borrowers)           AS total_borrowers,
    (SELECT n FROM non_duplicate_borrowers)   AS unique_borrowers,
    (SELECT n FROM duplicate_borrowers)       AS duplicate_borrowers,
    (SELECT n FROM borrowers_with_any_issue)  AS borrowers_with_issues,
    (SELECT n FROM ready_for_letters)         AS ready_for_letters,
    (SELECT non_duplicate_borrowers.n - ready_for_letters.n
     FROM   non_duplicate_borrowers, ready_for_letters)
                                              AS unique_but_not_ready;


-- =============================================================================
-- PART B · ISSUE BREAKDOWN BY TYPE AND FIELD
-- (only unresolved issues)
-- =============================================================================

SELECT
    issue_type,
    field_name,
    table_name,
    COUNT(*)                                              AS affected_records,
    ROUND(
        COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM borrowers), 0),
        1
    )                                                     AS pct_of_total_borrowers
FROM   data_quality_issues
WHERE  resolved_at IS NULL
GROUP  BY issue_type, field_name, table_name
ORDER  BY affected_records DESC, issue_type, field_name;


-- =============================================================================
-- PART C · PER-BORROWER READINESS DETAIL
-- Shows every borrower with a pass/fail on each required field.
-- Use this to drive manual review or hand off to a data steward.
-- =============================================================================

SELECT
    b.borrower_id,
    b.first_name                                          AS first_name,
    b.last_name                                           AS last_name,
    -- SSN masked
    CASE
        WHEN b.ssn ~ '^\d{3}-\d{2}-\d{4}$'
            THEN 'XXX-XX-' || RIGHT(REPLACE(b.ssn,'-',''), 4)
        ELSE 'INVALID'
    END                                                   AS ssn_status,
    c.phone_primary,
    c.email,
    c.street_address,
    c.zip_code,
    l.loan_number,
    l.loan_type,
    l.current_balance,
    l.interest_rate,
    l.loan_status,
    -- Readiness flags
    CASE WHEN TRIM(COALESCE(b.first_name,'')) = ''   THEN 'FAIL' ELSE 'OK' END AS chk_first_name,
    CASE WHEN TRIM(COALESCE(b.last_name, '')) = ''   THEN 'FAIL' ELSE 'OK' END AS chk_last_name,
    CASE WHEN b.ssn !~ '^\d{3}-\d{2}-\d{4}$'        THEN 'FAIL' ELSE 'OK' END AS chk_ssn,
    CASE WHEN c.street_address IS NULL               THEN 'FAIL' ELSE 'OK' END AS chk_address,
    CASE WHEN c.zip_code IS NULL
          OR (c.zip_code !~ '^\d{5}$'
         AND  c.zip_code !~ '^\d{5}-\d{4}$')        THEN 'FAIL' ELSE 'OK' END AS chk_zip,
    CASE WHEN c.email IS NULL
          OR c.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'
                                                     THEN 'FAIL' ELSE 'OK' END AS chk_email,
    CASE WHEN c.phone_primary IS NULL
          OR c.phone_primary !~ '^\(\d{3}\) \d{3}-\d{4}$'
                                                     THEN 'FAIL' ELSE 'OK' END AS chk_phone,
    CASE WHEN l.loan_number IS NULL                  THEN 'FAIL' ELSE 'OK' END AS chk_loan_num,
    CASE WHEN l.current_balance IS NULL
          OR l.current_balance !~ '^[0-9]*\.?[0-9]+$'
          OR l.current_balance::NUMERIC <= 0         THEN 'FAIL' ELSE 'OK' END AS chk_balance,
    CASE WHEN l.interest_rate IS NULL
          OR l.interest_rate !~ '^[0-9]*\.?[0-9]+$'
          OR l.interest_rate::NUMERIC NOT BETWEEN 0.5 AND 20.0
                                                     THEN 'FAIL' ELSE 'OK' END AS chk_rate,
    CASE WHEN l.loan_status <> 'ACTIVE'              THEN 'FAIL' ELSE 'OK' END AS chk_status,
    CASE WHEN COALESCE(b.is_duplicate, FALSE)        THEN 'DUPLICATE' ELSE 'OK' END AS chk_duplicate,
    -- Overall verdict
    CASE
        WHEN COALESCE(b.is_duplicate, FALSE)          THEN 'EXCLUDED_DUPLICATE'
        WHEN TRIM(COALESCE(b.first_name,'')) = ''
          OR TRIM(COALESCE(b.last_name, '')) = ''
          OR c.street_address IS NULL
          OR l.loan_number IS NULL
          OR l.current_balance IS NULL
          OR l.interest_rate IS NULL
          OR l.loan_status <> 'ACTIVE'               THEN 'NOT_READY_MISSING_DATA'
        WHEN b.ssn !~ '^\d{3}-\d{2}-\d{4}$'
          OR c.zip_code IS NULL
          OR (c.zip_code !~ '^\d{5}$'
         AND  c.zip_code !~ '^\d{5}-\d{4}$')
          OR c.email IS NULL
          OR c.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'
          OR c.phone_primary IS NULL
          OR c.phone_primary !~ '^\(\d{3}\) \d{3}-\d{4}$'
          OR l.current_balance !~ '^[0-9]*\.?[0-9]+$'
          OR l.interest_rate  !~ '^[0-9]*\.?[0-9]+$'
          OR l.interest_rate::NUMERIC NOT BETWEEN 0.5 AND 20.0
                                                     THEN 'NOT_READY_INVALID_DATA'
        ELSE                                              'READY_FOR_LETTER'
    END AS letter_readiness
FROM   borrowers b
LEFT   JOIN contacts  c ON c.borrower_id = b.borrower_id
LEFT   JOIN loans     l ON l.borrower_id = b.borrower_id
ORDER  BY letter_readiness, b.borrower_id;


-- =============================================================================
-- PART D · LETTER-READY RECORDS ONLY
-- This is the final extract for the letter-generation system.
-- =============================================================================

SELECT
    b.borrower_id,
    b.first_name || ' ' || b.last_name    AS full_name,
    c.street_address,
    c.city,
    c.state,
    c.zip_code,
    c.email,
    c.phone_primary,
    l.loan_number,
    l.loan_type,
    l.current_balance::DECIMAL(15,2)      AS current_balance,
    l.interest_rate::DECIMAL(6,4)         AS interest_rate_pct,
    l.origination_date,
    l.maturity_date,
    l.loan_status
FROM   borrowers b
JOIN   contacts  c ON c.borrower_id = b.borrower_id
JOIN   loans     l ON l.borrower_id = b.borrower_id
WHERE  COALESCE(b.is_duplicate, FALSE) = FALSE
  AND  TRIM(COALESCE(b.first_name,''))  <> ''
  AND  TRIM(COALESCE(b.last_name, ''))  <> ''
  AND  c.street_address IS NOT NULL
  AND  (c.zip_code ~ '^\d{5}$' OR c.zip_code ~ '^\d{5}-\d{4}$')
  AND  c.email         ~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'
  AND  c.phone_primary ~ '^\(\d{3}\) \d{3}-\d{4}$'
  AND  l.loan_number    IS NOT NULL
  AND  l.current_balance IS NOT NULL
  AND  l.current_balance ~ '^[0-9]*\.?[0-9]+$'
  AND  l.current_balance::NUMERIC > 0
  AND  l.interest_rate  IS NOT NULL
  AND  l.interest_rate  ~ '^[0-9]*\.?[0-9]+$'
  AND  l.interest_rate::NUMERIC BETWEEN 0.5 AND 20.0
  AND  l.loan_status = 'ACTIVE'
ORDER  BY b.borrower_id;
