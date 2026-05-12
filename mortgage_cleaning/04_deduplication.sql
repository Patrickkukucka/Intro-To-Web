-- =============================================================================
-- 04_DEDUPLICATION.SQL
-- Identify and flag duplicate borrower records.
--
-- Strategy (non-destructive):
--   1. Audit queries show all duplicates (no changes).
--   2. UPDATE statements mark duplicates with is_duplicate = TRUE and
--      point duplicate_of_id → the canonical (earliest) borrower_id.
--   3. Duplicate records are NEVER deleted here — exclusion happens at the
--      letter-generation query level (WHERE is_duplicate = FALSE).
--
-- Two duplication signals:
--   A. Same SSN  (strongest signal — definite duplicate)
--   B. Same normalised name + street address  (softer signal — needs review)
-- =============================================================================

-- =============================================================================
-- SECTION 1 · SCHEMA ADDITIONS
-- =============================================================================

ALTER TABLE borrowers
    ADD COLUMN IF NOT EXISTS is_duplicate    BOOLEAN     DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS duplicate_of_id INT         REFERENCES borrowers(borrower_id),
    ADD COLUMN IF NOT EXISTS dedup_reason    VARCHAR(100);


-- =============================================================================
-- SECTION 2 · AUDIT — DUPLICATES BY SSN  (read-only, run first)
-- =============================================================================

WITH ssn_groups AS (
    SELECT REGEXP_REPLACE(ssn, '[^0-9]', '', 'g') AS clean_ssn,
           MIN(borrower_id)                        AS canonical_id,
           ARRAY_AGG(borrower_id ORDER BY borrower_id) AS all_ids,
           COUNT(*)                                AS cnt
    FROM   borrowers
    WHERE  ssn IS NOT NULL AND ssn <> ''
      AND  LENGTH(REGEXP_REPLACE(ssn, '[^0-9]', '', 'g')) = 9
    GROUP  BY clean_ssn
    HAVING COUNT(*) > 1
)
SELECT
    g.cnt                                          AS duplicate_count,
    g.canonical_id                                 AS keep_borrower_id,
    g.all_ids                                      AS all_borrower_ids,
    -- Mask SSN — last 4 digits only
    'XXX-XX-' || RIGHT(g.clean_ssn, 4)            AS ssn_masked
FROM   ssn_groups g
ORDER  BY g.cnt DESC;


-- =============================================================================
-- SECTION 3 · AUDIT — DUPLICATES BY NAME + ADDRESS  (read-only)
-- =============================================================================

WITH name_addr_groups AS (
    SELECT
        LOWER(TRIM(b.first_name))      AS norm_first,
        LOWER(TRIM(b.last_name))       AS norm_last,
        LOWER(TRIM(c.street_address))  AS norm_addr,
        MIN(b.borrower_id)             AS canonical_id,
        ARRAY_AGG(b.borrower_id ORDER BY b.borrower_id) AS all_ids,
        COUNT(*)                       AS cnt
    FROM   borrowers b
    JOIN   contacts  c ON c.borrower_id = b.borrower_id
    WHERE  TRIM(COALESCE(b.first_name,'')) <> ''
      AND  TRIM(COALESCE(b.last_name, '')) <> ''
      AND  c.street_address IS NOT NULL
    GROUP  BY 1, 2, 3
    HAVING COUNT(*) > 1
)
SELECT
    g.cnt           AS duplicate_count,
    g.canonical_id  AS keep_borrower_id,
    g.all_ids       AS all_borrower_ids,
    g.norm_first    AS first_name,
    g.norm_last     AS last_name,
    g.norm_addr     AS street_address
FROM   name_addr_groups g
ORDER  BY g.cnt DESC, g.canonical_id;


-- =============================================================================
-- SECTION 4 · SIDE-BY-SIDE COMPARISON OF DUPLICATE PAIRS
-- Use to manually decide which record is canonical before committing flags.
-- =============================================================================

WITH ssn_dupes AS (
    SELECT REGEXP_REPLACE(ssn, '[^0-9]', '', 'g') AS clean_ssn
    FROM   borrowers
    WHERE  ssn IS NOT NULL AND ssn <> ''
      AND  LENGTH(REGEXP_REPLACE(ssn, '[^0-9]', '', 'g')) = 9
    GROUP  BY 1
    HAVING COUNT(*) > 1
)
SELECT
    b.borrower_id,
    b.first_name,
    b.last_name,
    -- Masked SSN
    'XXX-XX-' || RIGHT(REGEXP_REPLACE(b.ssn,'[^0-9]','','g'), 4) AS ssn_masked,
    c.street_address,
    c.city,
    c.state,
    c.zip_code,
    c.email,
    l.loan_number,
    b.created_at
FROM   borrowers b
JOIN   ssn_dupes  s ON REGEXP_REPLACE(b.ssn,'[^0-9]','','g') = s.clean_ssn
LEFT   JOIN contacts c ON c.borrower_id = b.borrower_id
LEFT   JOIN loans    l ON l.borrower_id = b.borrower_id
ORDER  BY s.clean_ssn, b.borrower_id;


-- =============================================================================
-- SECTION 5 · FLAG DUPLICATES  (wrapped in transaction)
--
-- Convention: the record with the LOWEST borrower_id is kept as canonical.
-- All others get is_duplicate = TRUE.
-- =============================================================================

BEGIN;

SAVEPOINT pre_dedup;
-- Undo with:  ROLLBACK TO SAVEPOINT pre_dedup;

-- ─── 5A. Flag SSN duplicates ─────────────────────────────────────────────────

WITH ssn_canonical AS (
    SELECT REGEXP_REPLACE(ssn, '[^0-9]', '', 'g') AS clean_ssn,
           MIN(borrower_id)                        AS canonical_id
    FROM   borrowers
    WHERE  ssn IS NOT NULL AND ssn <> ''
      AND  LENGTH(REGEXP_REPLACE(ssn, '[^0-9]', '', 'g')) = 9
    GROUP  BY clean_ssn
    HAVING COUNT(*) > 1
)
UPDATE borrowers b
SET    is_duplicate    = TRUE,
       duplicate_of_id = sc.canonical_id,
       dedup_reason    = 'DUPLICATE_SSN',
       updated_at      = NOW()
FROM   ssn_canonical sc
WHERE  REGEXP_REPLACE(b.ssn, '[^0-9]', '', 'g') = sc.clean_ssn
  AND  b.borrower_id <> sc.canonical_id;

-- ─── 5B. Flag name+address duplicates (where not already flagged by SSN) ─────

WITH name_addr_canonical AS (
    SELECT
        LOWER(TRIM(b.first_name))     AS norm_first,
        LOWER(TRIM(b.last_name))      AS norm_last,
        LOWER(TRIM(c.street_address)) AS norm_addr,
        MIN(b.borrower_id)            AS canonical_id
    FROM   borrowers b
    JOIN   contacts  c ON c.borrower_id = b.borrower_id
    WHERE  TRIM(COALESCE(b.first_name,'')) <> ''
      AND  TRIM(COALESCE(b.last_name, '')) <> ''
      AND  c.street_address IS NOT NULL
      AND  NOT COALESCE(b.is_duplicate, FALSE)   -- skip already-flagged records
    GROUP  BY 1, 2, 3
    HAVING COUNT(*) > 1
)
UPDATE borrowers b
SET    is_duplicate    = TRUE,
       duplicate_of_id = COALESCE(b.duplicate_of_id, nac.canonical_id),
       dedup_reason    = CASE
                             WHEN b.dedup_reason IS NOT NULL
                             THEN b.dedup_reason || '+DUPLICATE_NAME_ADDR'
                             ELSE 'DUPLICATE_NAME_ADDR'
                         END,
       updated_at      = NOW()
FROM   name_addr_canonical nac
JOIN   contacts            c  ON c.borrower_id = b.borrower_id
WHERE  LOWER(TRIM(b.first_name))     = nac.norm_first
  AND  LOWER(TRIM(b.last_name))      = nac.norm_last
  AND  LOWER(TRIM(c.street_address)) = nac.norm_addr
  AND  b.borrower_id <> nac.canonical_id
  AND  NOT COALESCE(b.is_duplicate, FALSE);


-- =============================================================================
-- SECTION 6 · POST-FLAG REVIEW
-- =============================================================================

SELECT b.borrower_id,
       b.first_name,
       b.last_name,
       'XXX-XX-' || RIGHT(REGEXP_REPLACE(COALESCE(b.ssn,''),'[^0-9]','','g'), 4) AS ssn_masked,
       b.is_duplicate,
       b.duplicate_of_id,
       b.dedup_reason
FROM   borrowers b
ORDER  BY b.duplicate_of_id NULLS FIRST, b.borrower_id;


COMMIT;
-- ROLLBACK TO SAVEPOINT pre_dedup;


-- =============================================================================
-- SECTION 7 · HOW TO USE DEDUP FLAGS IN DOWNSTREAM QUERIES
-- =============================================================================

-- Exclude duplicate records from all reporting / letter generation:
--
--   SELECT *
--   FROM   borrowers
--   WHERE  COALESCE(is_duplicate, FALSE) = FALSE;
--
-- Show canonical record plus all its duplicates (e.g. for merge review):
--
--   SELECT b.*
--   FROM   borrowers b
--   WHERE  b.borrower_id = <canonical_id>
--      OR  b.duplicate_of_id = <canonical_id>
--   ORDER  BY b.borrower_id;
