-- =============================================================================
-- 02_AUDIT.SQL
-- Read-only dirty-data inventory — run BEFORE making any changes.
-- Every query here is a SELECT; nothing is modified.
-- =============================================================================

-- =============================================================================
-- SECTION A · BORROWER NAMES
-- =============================================================================

-- A1. Names with leading / trailing / double internal whitespace
SELECT borrower_id,
       first_name,
       last_name,
       (first_name <> TRIM(first_name))  AS first_has_outer_space,
       (last_name  <> TRIM(last_name))   AS last_has_outer_space,
       (first_name ~ '\s{2,}')           AS first_has_double_space,
       (last_name  ~ '\s{2,}')           AS last_has_double_space
FROM   borrowers
WHERE  first_name <> TRIM(COALESCE(first_name, ''))
   OR  last_name  <> TRIM(COALESCE(last_name,  ''))
   OR  first_name ~ '\s{2,}'
   OR  last_name  ~ '\s{2,}';

-- A2. Names not in proper / title case  (INITCAP mismatch)
SELECT borrower_id,
       first_name,                       last_name,
       INITCAP(TRIM(first_name)) AS expected_first,
       INITCAP(TRIM(last_name))  AS expected_last
FROM   borrowers
WHERE  TRIM(COALESCE(first_name, '')) <> ''
  AND (TRIM(first_name) <> INITCAP(TRIM(first_name))
   OR  TRIM(last_name)  <> INITCAP(TRIM(last_name)));

-- A3. Embedded professional titles (Dr., Mr., etc.) in first_name
SELECT borrower_id, first_name, last_name
FROM   borrowers
WHERE  first_name ~* '^\s*(Dr|Mr|Mrs|Ms|Prof)\.?\s+';

-- A4. NULL or whitespace-only names (required fields)
SELECT borrower_id, first_name, last_name,
       CASE WHEN TRIM(COALESCE(first_name,'')) = '' THEN 'MISSING' ELSE 'OK' END AS first_status,
       CASE WHEN TRIM(COALESCE(last_name, '')) = '' THEN 'MISSING' ELSE 'OK' END AS last_status
FROM   borrowers
WHERE  TRIM(COALESCE(first_name,'')) = ''
   OR  TRIM(COALESCE(last_name, '')) = '';

-- A5. Names containing accented / non-ASCII characters (flag for review)
SELECT borrower_id, first_name, last_name
FROM   borrowers
WHERE  first_name ~ '[^\x00-\x7F]'
   OR  last_name  ~ '[^\x00-\x7F]';


-- =============================================================================
-- SECTION B · SSN / TAX ID
-- NOTE: Raw SSN values are MASKED in all output — only last 4 digits shown.
-- =============================================================================

-- B1. Classify SSN format and validity (masked output only)
WITH ssn_digits AS (
    SELECT borrower_id,
           REGEXP_REPLACE(COALESCE(ssn, ''), '[^0-9]', '', 'g') AS digits
    FROM   borrowers
)
SELECT b.borrower_id,
       -- Mask: show only last 4 digits
       CASE
           WHEN LENGTH(d.digits) >= 4
               THEN 'XXX-XX-' || RIGHT(d.digits, 4)
           ELSE 'XXX-XX-????'
       END AS ssn_masked,
       CASE
           WHEN b.ssn IS NULL OR b.ssn = ''           THEN 'MISSING'
           WHEN d.digits ~ '^\d{9}$'
            AND b.ssn ~ '^\d{3}-\d{2}-\d{4}$'        THEN 'VALID_HYPHENATED'
           WHEN d.digits ~ '^\d{9}$'                  THEN 'VALID_NEEDS_HYPHENS'
           WHEN LENGTH(d.digits) < 9                  THEN 'TOO_SHORT'
           WHEN LENGTH(d.digits) > 9                  THEN 'TOO_LONG'
           ELSE                                            'INVALID_FORMAT'
       END AS ssn_status
FROM   borrowers b
JOIN   ssn_digits d ON d.borrower_id = b.borrower_id
ORDER  BY ssn_status, b.borrower_id;

-- B2. Duplicate SSNs across borrower records (masked)
WITH ssn_digits AS (
    SELECT borrower_id,
           REGEXP_REPLACE(COALESCE(ssn, ''), '[^0-9]', '', 'g') AS digits
    FROM   borrowers
    WHERE  ssn IS NOT NULL AND ssn <> ''
)
SELECT d.digits AS ssn_digits_masked,      -- deliberately showing digits count only; analyst can look up by borrower_id
       COUNT(*)                                          AS duplicate_count,
       ARRAY_AGG(d.borrower_id ORDER BY d.borrower_id)  AS borrower_ids
FROM   ssn_digits d
WHERE  LENGTH(d.digits) = 9
GROUP  BY d.digits
HAVING COUNT(*) > 1;


-- =============================================================================
-- SECTION C · PHONE NUMBERS
-- =============================================================================

-- C1. Phone status classification (all contact records)
SELECT c.contact_id,
       c.borrower_id,
       c.phone_primary,
       LENGTH(REGEXP_REPLACE(COALESCE(c.phone_primary, ''), '[^0-9]', '', 'g')) AS digit_count,
       CASE
           WHEN TRIM(COALESCE(c.phone_primary, '')) = ''
               THEN 'MISSING'
           WHEN c.phone_primary ~ '^\(\d{3}\) \d{3}-\d{4}$'
               THEN 'ALREADY_CANONICAL'
           WHEN LENGTH(REGEXP_REPLACE(c.phone_primary, '[^0-9]', '', 'g')) = 11
            AND LEFT(REGEXP_REPLACE(c.phone_primary, '[^0-9]', '', 'g'), 1) = '1'
               THEN 'HAS_COUNTRY_CODE_1'
           WHEN LENGTH(REGEXP_REPLACE(c.phone_primary, '[^0-9]', '', 'g')) = 10
               THEN 'VALID_REFORMATTABLE'
           WHEN LENGTH(REGEXP_REPLACE(c.phone_primary, '[^0-9]', '', 'g')) < 10
            AND c.phone_primary ~ '[0-9]'
               THEN 'TOO_FEW_DIGITS'
           WHEN c.phone_primary !~ '[0-9]'
               THEN 'NON_NUMERIC'
           ELSE 'UNRECOGNISED'
       END AS phone_status
FROM   contacts c
ORDER  BY c.borrower_id;


-- =============================================================================
-- SECTION D · EMAIL ADDRESSES
-- =============================================================================

-- D1. Email validity and case classification
SELECT contact_id,
       borrower_id,
       email,
       CASE
           WHEN TRIM(COALESCE(email, '')) = ''
               THEN 'MISSING'
           WHEN TRIM(email) ~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' AND TRIM(email) = LOWER(TRIM(email))
               THEN 'VALID_CLEAN'
           WHEN TRIM(email) ~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'
               THEN 'VALID_NEEDS_LOWERCASE'
           ELSE
               'INVALID_FORMAT'
       END AS email_status
FROM   contacts
ORDER  BY borrower_id;


-- =============================================================================
-- SECTION E · ADDRESSES AND ZIP CODES
-- =============================================================================

-- E1. ZIP code classification
SELECT contact_id,
       borrower_id,
       zip_code,
       CASE
           WHEN TRIM(COALESCE(zip_code, '')) = ''                              THEN 'MISSING'
           WHEN zip_code ~ '^\d{5}$'                                           THEN 'VALID_5_DIGIT'
           WHEN zip_code ~ '^\d{5}-\d{4}$'                                    THEN 'VALID_9_DIGIT'
           WHEN REGEXP_REPLACE(zip_code, '[^0-9]', '', 'g') ~ '^\d{9}$'       THEN 'NINE_DIGIT_NO_HYPHEN'
           WHEN LENGTH(REGEXP_REPLACE(zip_code, '[^0-9]', '', 'g')) < 5        THEN 'TOO_SHORT'
           ELSE                                                                      'INVALID'
       END AS zip_status
FROM   contacts
ORDER  BY borrower_id;

-- E2. Same audit for property ZIP codes
SELECT property_id,
       borrower_id,
       zip_code,
       CASE
           WHEN TRIM(COALESCE(zip_code, '')) = ''                              THEN 'MISSING'
           WHEN zip_code ~ '^\d{5}$'                                           THEN 'VALID_5_DIGIT'
           WHEN zip_code ~ '^\d{5}-\d{4}$'                                    THEN 'VALID_9_DIGIT'
           WHEN REGEXP_REPLACE(zip_code, '[^0-9]', '', 'g') ~ '^\d{9}$'       THEN 'NINE_DIGIT_NO_HYPHEN'
           WHEN LENGTH(REGEXP_REPLACE(zip_code, '[^0-9]', '', 'g')) < 5        THEN 'TOO_SHORT'
           ELSE                                                                      'INVALID'
       END AS zip_status
FROM   properties
ORDER  BY borrower_id;

-- E3. Address abbreviation audit — full words that should be abbreviated
SELECT contact_id, borrower_id, street_address,
       ARRAY_REMOVE(ARRAY[
           CASE WHEN street_address ~* '\bStreet\b'    THEN 'Street→St'    END,
           CASE WHEN street_address ~* '\bAvenue\b'    THEN 'Avenue→Ave'   END,
           CASE WHEN street_address ~* '\bBoulevard\b' THEN 'Blvd→Blvd'   END,
           CASE WHEN street_address ~* '\bDrive\b'     THEN 'Drive→Dr'     END,
           CASE WHEN street_address ~* '\bRoad\b'      THEN 'Road→Rd'      END,
           CASE WHEN street_address ~* '\bLane\b'      THEN 'Lane→Ln'      END,
           CASE WHEN street_address ~* '\bCourt\b'     THEN 'Court→Ct'     END,
           CASE WHEN street_address ~* '\bPlace\b'     THEN 'Place→Pl'     END,
           CASE WHEN street_address ~* '\bCircle\b'    THEN 'Circle→Cir'   END
       ], NULL) AS abbreviations_needed
FROM   contacts
WHERE  street_address ~* '\b(Street|Avenue|Boulevard|Drive|Road|Lane|Court|Place|Circle)\b'
ORDER  BY borrower_id;


-- =============================================================================
-- SECTION F · LOAN AMOUNTS
-- =============================================================================

-- F1. Amounts containing non-numeric characters
SELECT loan_id, borrower_id,
       original_amount,
       current_balance,
       CASE WHEN original_amount ~ '[^0-9.]' THEN TRUE ELSE FALSE END AS orig_has_symbols,
       CASE WHEN current_balance ~ '[^0-9.]' THEN TRUE ELSE FALSE END AS bal_has_symbols
FROM   loans
WHERE  original_amount  ~ '[^0-9.]'
   OR  current_balance  ~ '[^0-9.]'
ORDER  BY loan_id;

-- F2. Amounts that are NULL or blank (required for letter)
SELECT loan_id, borrower_id, original_amount, current_balance
FROM   loans
WHERE  original_amount  IS NULL
   OR  current_balance  IS NULL
   OR  TRIM(original_amount)  = ''
   OR  TRIM(current_balance)  = '';


-- =============================================================================
-- SECTION G · INTEREST RATES
-- =============================================================================

-- G1. Rate format flags and scale detection
WITH rate_cleaned AS (
    SELECT loan_id, borrower_id, interest_rate,
           -- Strip % and whitespace to get a raw numeric string
           TRIM(REPLACE(REPLACE(COALESCE(interest_rate,''), '%', ''), ' ', '')) AS rate_str
    FROM   loans
)
SELECT loan_id, borrower_id, interest_rate,
       rate_str,
       CASE
           WHEN interest_rate IS NULL OR TRIM(interest_rate) = ''
               THEN 'MISSING'
           WHEN rate_str !~ '^[0-9]*\.?[0-9]+$'
               THEN 'NON_NUMERIC'
           WHEN rate_str::NUMERIC > 20
               THEN 'STORED_AS_x100  (e.g. 675 → 6.75%) — divide by 100'
           WHEN rate_str::NUMERIC < 1
               THEN 'STORED_AS_FRACTION  (e.g. .0675 → 6.75%) — multiply by 100'
           WHEN rate_str::NUMERIC BETWEEN 1 AND 20
               THEN 'PLAUSIBLE_RANGE'
           WHEN rate_str::NUMERIC = 0
               THEN 'ZERO_RATE — suspicious'
           ELSE 'OUT_OF_RANGE'
       END AS rate_diagnosis
FROM   rate_cleaned
ORDER  BY loan_id;

-- G2. Rates with literal % sign or leading dot (formatting issues only)
SELECT loan_id, borrower_id, interest_rate
FROM   loans
WHERE  interest_rate LIKE '%\%%' ESCAPE '\'
   OR  interest_rate LIKE '.%'
ORDER  BY loan_id;


-- =============================================================================
-- SECTION H · DATES
-- =============================================================================

-- H1. Classify date formats — origination_date and maturity_date
SELECT loan_id, borrower_id,
       origination_date,
       maturity_date,
       CASE
           WHEN origination_date IS NULL                      THEN 'MISSING'
           WHEN origination_date ~ '^\d{4}-\d{2}-\d{2}$'    THEN 'ISO_OK'
           WHEN origination_date ~ '^\d{2}/\d{2}/\d{4}$'    THEN 'MM/DD/YYYY'
           WHEN origination_date ~ '^\d{2}-\d{2}-\d{4}$'    THEN 'MM-DD-YYYY'
           ELSE                                                    'UNKNOWN_FORMAT'
       END AS orig_date_format,
       CASE
           WHEN maturity_date IS NULL                         THEN 'MISSING'
           WHEN maturity_date ~ '^\d{4}-\d{2}-\d{2}$'       THEN 'ISO_OK'
           WHEN maturity_date ~ '^\d{2}/\d{2}/\d{4}$'       THEN 'MM/DD/YYYY'
           WHEN maturity_date ~ '^\d{2}-\d{2}-\d{4}$'       THEN 'MM-DD-YYYY'
           ELSE                                                    'UNKNOWN_FORMAT'
       END AS maturity_date_format
FROM   loans
ORDER  BY loan_id;


-- =============================================================================
-- SECTION I · LOAN TYPE CODES
-- =============================================================================

-- I1. All distinct loan_type values present (shows variant explosion)
SELECT loan_type,
       COUNT(*)                                    AS occurrences,
       ARRAY_AGG(loan_id ORDER BY loan_id)         AS loan_ids
FROM   loans
WHERE  loan_type IS NOT NULL
GROUP  BY loan_type
ORDER  BY loan_type;

-- I2. Loan types that don't match a known canonical value
SELECT loan_id, borrower_id, loan_type
FROM   loans
WHERE  UPPER(TRIM(REGEXP_REPLACE(loan_type, '\s+(loan|mortgage)$', '', 'gi')))
       NOT IN ('CONVENTIONAL','FHA','VA','USDA','JUMBO','ARM','COMMERCIAL')
  AND  loan_type IS NOT NULL
ORDER  BY loan_id;


-- =============================================================================
-- SECTION J · RECORDS MISSING REQUIRED FIELDS FOR A REFINANCE LETTER
-- =============================================================================

SELECT b.borrower_id,
       b.first_name,
       b.last_name,
       l.loan_number,
       l.current_balance,
       l.interest_rate,
       c.street_address,
       c.zip_code,
       -- Individual field flags
       CASE WHEN TRIM(COALESCE(b.first_name,'')) = '' THEN 'MISSING' ELSE 'OK' END AS chk_first_name,
       CASE WHEN TRIM(COALESCE(b.last_name, '')) = '' THEN 'MISSING' ELSE 'OK' END AS chk_last_name,
       CASE WHEN l.loan_id        IS NULL              THEN 'MISSING' ELSE 'OK' END AS chk_loan_record,
       CASE WHEN l.loan_number    IS NULL              THEN 'MISSING' ELSE 'OK' END AS chk_loan_number,
       CASE WHEN l.current_balance IS NULL             THEN 'MISSING' ELSE 'OK' END AS chk_balance,
       CASE WHEN l.interest_rate  IS NULL              THEN 'MISSING' ELSE 'OK' END AS chk_rate,
       CASE WHEN c.street_address IS NULL              THEN 'MISSING' ELSE 'OK' END AS chk_address
FROM   borrowers b
LEFT   JOIN loans    l ON l.borrower_id = b.borrower_id
LEFT   JOIN contacts c ON c.borrower_id = b.borrower_id
WHERE  TRIM(COALESCE(b.first_name,''))  = ''
   OR  TRIM(COALESCE(b.last_name,''))   = ''
   OR  l.loan_number    IS NULL
   OR  l.current_balance IS NULL
   OR  l.interest_rate   IS NULL
   OR  c.street_address  IS NULL
ORDER  BY b.borrower_id;


-- =============================================================================
-- SECTION K · ISSUE SUMMARY COUNTS (high-level dashboard before cleaning)
-- =============================================================================

WITH issues AS (
    SELECT 'Whitespace in name'            AS issue, COUNT(*) AS n FROM borrowers
     WHERE first_name <> TRIM(COALESCE(first_name,'')) OR last_name <> TRIM(COALESCE(last_name,''))
       OR  first_name ~ '\s{2,}' OR last_name ~ '\s{2,}'
    UNION ALL
    SELECT 'Name not proper-case',              COUNT(*) FROM borrowers
     WHERE TRIM(COALESCE(first_name,'')) <> '' AND
           (TRIM(first_name) <> INITCAP(TRIM(first_name)) OR TRIM(last_name) <> INITCAP(TRIM(last_name)))
    UNION ALL
    SELECT 'Null/blank name',                   COUNT(*) FROM borrowers
     WHERE TRIM(COALESCE(first_name,'')) = '' OR TRIM(COALESCE(last_name,'')) = ''
    UNION ALL
    SELECT 'SSN missing or invalid',            COUNT(*) FROM borrowers
     WHERE ssn IS NULL OR ssn = ''
       OR  LENGTH(REGEXP_REPLACE(ssn,'[^0-9]','','g')) <> 9
    UNION ALL
    SELECT 'Duplicate SSN',
           COUNT(*) FROM borrowers b
     WHERE EXISTS (
         SELECT 1 FROM borrowers b2
          WHERE b2.borrower_id <> b.borrower_id
            AND REGEXP_REPLACE(b2.ssn,'[^0-9]','','g') = REGEXP_REPLACE(b.ssn,'[^0-9]','','g')
            AND LENGTH(REGEXP_REPLACE(b.ssn,'[^0-9]','','g')) = 9
     )
    UNION ALL
    SELECT 'Phone not canonical',               COUNT(*) FROM contacts
     WHERE phone_primary IS NULL OR phone_primary !~ '^\(\d{3}\) \d{3}-\d{4}$'
    UNION ALL
    SELECT 'Email missing or invalid',          COUNT(*) FROM contacts
     WHERE TRIM(COALESCE(email,'')) = ''
       OR  TRIM(email) !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'
    UNION ALL
    SELECT 'ZIP missing or invalid',            COUNT(*) FROM contacts
     WHERE zip_code IS NULL
       OR (zip_code !~ '^\d{5}$' AND zip_code !~ '^\d{5}-\d{4}$')
    UNION ALL
    SELECT 'Amount has symbols ($,)',           COUNT(*) FROM loans
     WHERE original_amount ~ '[^0-9.]' OR current_balance ~ '[^0-9.]'
    UNION ALL
    SELECT 'Rate needs scale correction',       COUNT(*) FROM loans
     WHERE interest_rate IS NOT NULL
       AND interest_rate ~ '^[0-9.%\s]+$'
       AND (REPLACE(REPLACE(TRIM(interest_rate),'%',''),' ','')::NUMERIC > 20
         OR REPLACE(REPLACE(TRIM(interest_rate),'%',''),' ','')::NUMERIC < 1)
    UNION ALL
    SELECT 'Date not in ISO format',            COUNT(*) FROM loans
     WHERE (origination_date IS NOT NULL AND origination_date !~ '^\d{4}-\d{2}-\d{2}$')
        OR (maturity_date    IS NOT NULL AND maturity_date    !~ '^\d{4}-\d{2}-\d{2}$')
    UNION ALL
    SELECT 'Loan type non-canonical',           COUNT(*) FROM loans
     WHERE loan_type IS NOT NULL
       AND UPPER(TRIM(REGEXP_REPLACE(loan_type,'\s+(loan|mortgage)$','','gi')))
           NOT IN ('CONVENTIONAL','FHA','VA','USDA','JUMBO','ARM','COMMERCIAL')
)
SELECT issue, n AS affected_records
FROM   issues
ORDER  BY n DESC;
