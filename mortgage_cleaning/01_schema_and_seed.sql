-- =============================================================================
-- 01_SCHEMA_AND_SEED.SQL
-- Mortgage refinancing database: schema DDL + intentionally dirty seed data.
-- Target: PostgreSQL 14+
--
-- All "raw import" columns are VARCHAR so that real-world dirty values
-- (bad formats, symbols, mixed case) survive ingestion unchanged.
-- The cleaning scripts in 03_clean.sql normalise them in-place.
-- =============================================================================

-- Optional: accent-stripping support used in name cleaning
CREATE EXTENSION IF NOT EXISTS unaccent;

-- =============================================================================
-- SCHEMA
-- =============================================================================

CREATE TABLE IF NOT EXISTS borrowers (
    borrower_id   SERIAL        PRIMARY KEY,
    first_name    VARCHAR(100),               -- raw; whitespace / case / titles
    last_name     VARCHAR(100),
    ssn           VARCHAR(20),                -- raw text; hyphens optional, may be invalid length
    date_of_birth VARCHAR(30),                -- raw; mixed date formats
    created_at    TIMESTAMPTZ   DEFAULT NOW(),
    updated_at    TIMESTAMPTZ   DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contacts (
    contact_id      SERIAL        PRIMARY KEY,
    borrower_id     INT           REFERENCES borrowers(borrower_id),
    phone_primary   VARCHAR(30),              -- raw; (555)123-4567 / 5559876543 / dots / +1…
    phone_secondary VARCHAR(30),
    email           VARCHAR(200),             -- raw; mixed case, may be structurally invalid
    street_address  VARCHAR(300),             -- raw; inconsistent USPS abbreviations
    city            VARCHAR(100),             -- raw; ALL CAPS or all lowercase
    state           CHAR(2),
    zip_code        VARCHAR(15),              -- raw; 4-digit, 9-digit no hyphen, etc.
    created_at      TIMESTAMPTZ   DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS properties (
    property_id    SERIAL        PRIMARY KEY,
    borrower_id    INT           REFERENCES borrowers(borrower_id),
    street_address VARCHAR(300),
    city           VARCHAR(100),
    state          CHAR(2),
    zip_code       VARCHAR(15),
    property_type  VARCHAR(50),              -- raw; sfr/SFR/Condo/CONDO/multi…
    created_at     TIMESTAMPTZ   DEFAULT NOW(),
    updated_at     TIMESTAMPTZ   DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loans (
    loan_id           SERIAL        PRIMARY KEY,
    borrower_id       INT           REFERENCES borrowers(borrower_id),
    property_id       INT           REFERENCES properties(property_id),
    loan_number       VARCHAR(50),
    loan_type         VARCHAR(50),            -- dirty: conv/CONV/Conventional/fha/FHA Loan/va loan…
    original_amount   VARCHAR(30),            -- dirty: $250,000.00 / 250000 / 250,000
    current_balance   VARCHAR(30),            -- same issues as original_amount
    interest_rate     VARCHAR(20),            -- dirty: 6.75 / 6.75% / 675 (=6.75×100) / .0675
    origination_date  VARCHAR(30),            -- dirty: MM/DD/YYYY · MM-DD-YYYY · YYYY-MM-DD
    maturity_date     VARCHAR(30),
    loan_status       VARCHAR(30),            -- dirty: active/ACTIVE/Active/closed…
    created_at        TIMESTAMPTZ   DEFAULT NOW(),
    updated_at        TIMESTAMPTZ   DEFAULT NOW()
);

-- =============================================================================
-- SEED DATA  (intentionally dirty — mirrors a typical legacy CSV import)
-- =============================================================================

INSERT INTO borrowers (first_name, last_name, ssn, date_of_birth) VALUES
-- 1  Leading/trailing/double internal whitespace; SSN missing hyphens
('  john   ',    '  doe  ',   '123456789',   '01/15/1975'),
-- 2  ALL-CAPS name; hyphenated SSN (valid format, keep as reference)
('JANE',         'SMITH',     '456-78-9012', '1982-07-22'),
-- 3  all-lowercase; apostrophe in surname (legitimate, not dirty)
('robert',       'o''brien',  '789-01-2345', '03-28-1969'),
-- 4  Mixed case, valid SSN
('WILLIAM',      'JOHNSON',   '321-65-4987', '11/04/1990'),
-- 5  Accented characters from a legacy charset migration
('María',        'García',    '456-78-9999', '1978-03-15'),
-- 6  Exact duplicate of borrower 1 (same SSN + name + address)
('john',         'doe',       '123456789',   '01/15/1975'),
-- 7  Embedded professional title in first_name
('Dr. Michael',  'Brown',     '111-22-3333', '1965-09-10'),
-- 8  NULL first_name; blank SSN
(NULL,           'Wilson',    '',            '1980-06-01'),
-- 9  Whitespace-only names; NULL DOB
('   ',          '   ',       '555-44-3333', NULL),
-- 10 SSN too short (8 digits, should be 9)
('Patricia',     'Lee',       '12345678',    '1993-12-25');


INSERT INTO contacts (borrower_id, phone_primary, phone_secondary, email,
                      street_address, city, state, zip_code) VALUES
-- 1  ZIP only 4 digits (missing leading 9 → '90210' → '9002' is truncated)
--    Phone missing space after area code; mixed-case email
(1,  '(555)123-4567',    NULL,         'John.DOE@GMAIL.COM',        '123 main street', 'Los Angeles', 'CA', '9002'),
-- 2  Phone 10 raw digits; ALL-CAPS email; city ALL-CAPS
(2,  '5559876543',       NULL,         'JANE.SMITH@YAHOO.COM',      '456 Oak Avenue',  'CHICAGO',     'IL', '60601'),
-- 3  Phone dashes only (no parens); all-lowercase email; address ALL-CAPS
(3,  '555-987-6543',     NULL,         'robert.obrien@hotmail.com', '789 ELM BLVD',    'new york',    'NY', '10001'),
-- 4  11-digit phone with country code 1; invalid email (no TLD dot segment)
--    9-digit ZIP run together (no hyphen)
(4,  '1-800-555-1234',   NULL,         'william.johnson@company',   '101 Pine Road',   'Houston',     'TX', '770011234'),
-- 5  Phone with dots; valid email
(5,  '555.222.3344',     NULL,         'maria.garcia@gmail.com',    '202 Cedar Drive', 'Miami',       'FL', '33101'),
-- 6  Structural duplicate of borrower 1 (same address, same bad ZIP)
(6,  '(555) 123-4567',   NULL,         'john.doe@gmail.com',        '123 main street', 'Los Angeles', 'CA', '9002'),
-- 7  International-format phone (+1 prefix); secondary phone bare 10-digits
(7,  '+1 (555) 777-8888','5558889999', 'michael.brown@outlook.com', '300 Walnut Lane', 'Seattle',     'WA', '98101'),
-- 8  Completely empty contact record
(8,  '',                  NULL,        '',                           NULL,               NULL,         NULL,  NULL),
-- 9  Non-numeric "phone" string; structurally invalid email
(9,  'not-a-phone',       NULL,        'not-an-email',              '555 Birch Court', 'Denver',      'CO', '80201'),
-- 10 Phone with spaces (not standard); whitespace-only email; valid 9-digit ZIP
(10, '555 111 2222',      NULL,        '   ',                       '777 Maple Place', 'Phoenix',     'AZ', '85001-1234');


INSERT INTO properties (borrower_id, street_address, city, state, zip_code, property_type) VALUES
(1,  '123 main street',  'Los Angeles', 'CA', '9002',        'sfr'),
(2,  '456 oak avenue',   'CHICAGO',     'IL', '60601',       'Condo'),
(3,  '789 ELM BLVD.',    'new york',    'NY', '10001',       'SFR'),
(4,  '101 Pine Road',    'Houston',     'TX', '770011234',   'MULTI'),
(5,  '202 Cedar Dr.',    'Miami',       'FL', '33101',       'sfr'),
(6,  '123 main st',      'Los angeles', 'CA', '9002',        'SFR'),
(7,  '300 Walnut Ln',    'Seattle',     'WA', '98101',       'SFR'),
(8,   NULL,               NULL,         NULL,  NULL,          NULL),
(9,  '555 Birch Ct',     'Denver',      'CO', '80201',       'commercial'),
(10, '777 Maple Pl',     'Phoenix',     'AZ', '85001-1234',  'SFR');


INSERT INTO loans (borrower_id, property_id, loan_number, loan_type,
                   original_amount, current_balance, interest_rate,
                   origination_date, maturity_date, loan_status) VALUES
-- 1  $-sign + comma amounts; %-suffix on rate; MM/DD/YYYY dates
(1,  1,  'LN-001', 'conv',            '$250,000.00', '$185,432.10', '6.75%',  '01/15/2019', '2049-01-15',  'active'),
-- 2  Clean integer amount; comma in balance; no % on rate; ISO dates
(2,  2,  'LN-002', 'CONVENTIONAL',    '320000',      '298,000',     '5.875',  '2020-03-22', '2050-03-22',  'ACTIVE'),
-- 3  Rate stored as integer × 100  (675 → 6.75%); $-prefix; MM-DD-YYYY dates
(3,  3,  'LN-003', 'Fha',             '$180,500',    '165000',      '675',    '06-10-2018', '06-10-2048',  'Active'),
-- 4  Rate stored as decimal fraction (.0425 → 4.25%); comma-only amount; MM/DD/YYYY
(4,  4,  'LN-004', 'va loan',         '225,000.00',  '210000',      '.0425',  '11/30/2021', '11/30/2051',  'active'),
-- 5  $-prefix; %-suffix; ISO dates
(5,  5,  'LN-005', 'USDA',            '$150,000',    '142500',      '3.5%',   '2022-08-01', '2052-08-01',  'active'),
-- 6  Duplicate of LN-001 (mirrors duplicate borrower 6)
(6,  6,  'LN-001', 'conv',            '$250,000.00', '$185,432.10', '6.75%',  '01/15/2019', '2049-01-15',  'active'),
-- 7  $-prefix + comma; ISO origination, MM-DD-YYYY maturity (mixed formats)
(7,  7,  'LN-007', 'Jumbo',           '$1,250,000',  '1200000',     '7.125',  '2023-03-15', '03-15-2053',  'Active'),
-- 8  Entirely NULL — borrower with no loan data
(8,  8,   NULL,    NULL,               NULL,           NULL,          NULL,     NULL,          NULL,         NULL),
-- 9  Commercial loan type; $-prefix both amounts; %-suffix rate
(9,  9,  'LN-009', 'commercial loan', '$500,000',    '$475,000',    '8.5%',   '2021-05-20', '2031-05-20',  'active'),
-- 10 Clean rate; ISO dates; closed status (ineligible for refinance letter)
(10, 10, 'LN-010', 'ARM',             '$195,000',    '188000',      '5.25',   '2023-01-10', '2053-01-10',  'closed');
