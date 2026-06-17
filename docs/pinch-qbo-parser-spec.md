Build an MVP web app for processing Pinch A Penny “Preauthorized Debit” PDF reports and preparing QuickBooks Online entries.

Context:
I own/operate Pinch A Penny store #144. I receive PDF reports titled “R03989 PREAUTHORIZED DEBIT.” The attached sample PDFs are real examples. The goal is to upload one of these PDFs, parse the report into structured rows, apply configurable accounting mappings, generate a proposed QuickBooks Online transaction, show it for manual review, and eventually push approved entries to QuickBooks Online.

Important safety requirement:
Do not build anything that automatically posts to production QuickBooks without manual approval. The MVP should parse, validate, and prepare the proposed entry first. QuickBooks posting should be sandbox-only until explicitly enabled.

Use these attached samples:

* 1.pdf
* 2.pdf
* 3.pdf
* 4.pdf

The app should understand this report format:

* Report title: R03989 / PREAUTHORIZED DEBIT
* Customer: Pinch A Penny #144
* Columns include:

  * Customer Number
  * Remarks
  * Doc Type
  * Doc Number
  * Pmt Term
  * Invoice Date
  * Due Date
  * Discount Due Date
  * Open Amount
  * Discount Available
  * Net Amount Due
* Rows may include sales orders, credits/rebates, unapplied debit rows, ADV/FF fees, and customer totals.
* Amounts with a trailing minus sign, such as `2,229.98-`, must be parsed as negative numbers.
* Parentheses in the remarks, such as `(Sales Order)`, are text remarks, not negative amounts.
* The parser must preserve the original raw row text for audit/debugging.

Sample row types to handle:

* `SO` rows, usually sales orders, often with positive open amount and discount available.
* `RM` rows, usually rebates/credits/discounts/promos, often negative.
* `RU` rows, usually “unapplied D.D.” carry-forward rows, often negative.
* `RI` rows, such as `ADV/FF FEES`, usually positive.
* `SR` rows, such as sales return/service return rows, can be negative.
* `CUSTOMER TOTAL` row with report totals.

Build the MVP with this stack unless the existing repo uses something else:

* Next.js / React frontend
* TypeScript
* Supabase/Postgres for persistence
* Server-side PDF text extraction
* A clean parser module with unit tests
* Optional LLM parsing only as a fallback, not the primary parser

Core features:

1. PDF upload
   Create a page where I can upload one or more Pinch A Penny preauthorized debit PDFs.

2. PDF text extraction
   Extract text from the PDF. These sample PDFs appear to contain text, so start with text extraction before OCR. Store:

* file name
* upload timestamp
* extracted raw text
* parsed rows
* parser confidence/errors

3. Report header parsing
   Extract:

* report number, e.g. R03989
* run date
* run time
* customer name / store number
* page number if available

4. Line-item parsing
   Parse each report row into structured data:

* customer_number
* remarks
* doc_type
* doc_number
* payment_term
* invoice_date
* due_date
* discount_due_date
* open_amount
* discount_available
* net_amount_due
* raw_text
* inferred_row_category

5. Amount parser
   Implement and test a robust money parser:

* `1,648.50` => 1648.50
* `82.45` => 82.45
* `2,229.98-` => -2229.98
* `28.16-` => -28.16
* blank amount => null
* `0/00/00` should be treated as an invalid/placeholder date, not a money amount

6. Customer total validation
   Parse the `CUSTOMER TOTAL` line. Validate:

* Sum of row open amounts equals the customer total open amount, within rounding tolerance.
* Sum of row discounts equals total discount available, within rounding tolerance.
* Sum of row net amounts equals customer total net amount due, within rounding tolerance.
  If validation fails, show a clear error and do not allow QuickBooks posting.

7. Carry-forward detection
   Detect rows like:

* `unapplied D.D.6-4-26`
* `unapplied D.D. 6-8-26`
* `unapplied D.D. 6-11-26`

These appear to reference a prior debit/report balance. Flag these as carry-forward/unapplied debit rows. Do not blindly categorize them as a normal expense. They may need special accounting treatment.

8. Accounting mapping table
   Create an editable mapping table where I can map report row patterns to QuickBooks accounts.

Example mapping structure:

* match_type: exact / contains / regex
* match_field: remarks / doc_type / doc_number
* match_value
* qbo_account_name
* qbo_account_id
* qbo_class_id, optional
* qbo_location_id, optional
* default_memo
* treatment: expense / credit / carry_forward / ignore / needs_review

Do not hardcode final QuickBooks account choices. Use configurable mappings.

Suggested initial categories:

* `ADV/FF FEES` => needs mapping, likely advertising/franchise fee related
* `Sun Points IT Purchase` => needs mapping
* `Sales Order` / `SO` => inventory/product purchase or COGS-related, needs mapping
* rebates/promos/discounts with `RM` => credits/rebates, needs mapping
* `unapplied D.D.` / `RU` => carry-forward/needs review
* `SR` => return/credit/needs review

9. Review screen
   After parsing a PDF, show a review screen with:

* report header
* report total
* parsed line items
* inferred category
* proposed QBO account
* confidence/status
* warnings
* editable fields before approval

The review screen should make it obvious when a row is unmapped or needs review.

10. Proposed QuickBooks transaction builder
    Build a module that converts the reviewed/mapped rows into a proposed QuickBooks transaction payload.

Important:
Before implementing the final posting entity, make the QBO transaction type configurable. I need to confirm with my bookkeeper whether this should become:

* a JournalEntry
* an Expense/Purchase
* a Check
* or be used only to help categorize/match an existing bank-feed transaction

For MVP, generate a proposed transaction object and show it in the UI. Do not assume journal entry is the correct final accounting treatment.

11. QuickBooks Online integration
    Add QuickBooks Online OAuth 2.0 support using Intuit’s current docs.
    Requirements:

* Store OAuth tokens securely.
* Support sandbox company connection first.
* Add a “Test QBO connection” button.
* Add a “Preview QBO payload” button.
* Add a “Push to QBO sandbox” button only after manual approval.
* Do not enable production posting by default.

12. Audit trail
    Store:

* original uploaded PDF
* extracted text
* parsed line items
* mapping rules used
* manual edits
* approval timestamp
* QBO payload
* QBO response
* QBO transaction ID if created
* error logs

13. Tests
    Create parser tests using the four provided PDFs or extracted text fixtures.

Tests should verify:

* Header extraction
* Correct date parsing
* Correct handling of trailing-minus negative amounts
* Correct row count
* Correct parsing of SO, RM, RU, RI, and SR rows
* Correct customer total parsing
* Total validation passes for each sample
* Carry-forward rows are flagged
* Unmapped rows are marked as needs_review

14. UI requirements
    Keep the UI simple and practical:

* Upload page
* Parsed reports list
* Report detail/review page
* Mapping rules page
* QuickBooks connection/settings page
* Audit/log page

15. Failure handling
    If parsing confidence is low, stop and show:

* raw extracted text
* parser error
* suggested manual correction
* option to manually edit rows

Never silently post questionable data to QuickBooks.

Deliverables:

* Working MVP app
* Database schema/migrations
* Parser module
* Unit tests
* README with setup steps
* Instructions for setting up QuickBooks sandbox OAuth
* Clear TODO list for production QBO posting after accounting treatment is confirmed

Start by implementing the parser and review screen before building QuickBooks posting.
