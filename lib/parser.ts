export type DocType = 'SO' | 'RM' | 'RU' | 'RI' | 'SR' | string

export type RowCategory =
  | 'sales_order'
  | 'rebate_credit'
  | 'carry_forward'
  | 'adv_ff_fee'
  | 'sales_return'
  | 'needs_review'

export interface ReportHeader {
  reportNumber: string
  runDate: string
  runTime: string
  customerName: string
  pageNumber: number | null
}

export interface LineItem {
  customerNumber: string
  remarks: string
  docType: DocType
  docNumber: string
  paymentTerm: string
  invoiceDate: string | null
  dueDate: string | null
  discountDueDate: string | null
  openAmount: number | null
  discountAvailable: number | null
  netAmountDue: number | null
  rawText: string
  rowCategory: RowCategory
  isCarryForward: boolean
  priorReportDate: string | null
  warnings: string[]
}

export interface CustomerTotal {
  openAmount: number | null
  discountAvailable: number | null
  netAmountDue: number | null
  rawText: string
}

export interface ValidationResult {
  openAmountMatch: boolean
  discountMatch: boolean
  netAmountMatch: boolean
  openAmountDiff: number
  discountDiff: number
  netAmountDiff: number
}

export interface ParsedReport {
  header: ReportHeader | null
  lineItems: LineItem[]
  customerTotal: CustomerTotal | null
  validation: ValidationResult | null
  parseErrors: string[]
  rawText: string
}

const ROUNDING_TOLERANCE = 0.02

export function parseAmount(raw: string): number | null {
  if (!raw || raw.trim() === '') return null
  const s = raw.trim()
  // Reject date-like patterns such as 0/00/00
  if (/^\d+\/\d+\/\d+$/.test(s)) return null
  // Handle trailing minus e.g. "2,229.98-"
  const negative = s.endsWith('-')
  const digits = s.replace(/,/g, '').replace(/-$/, '')
  const n = parseFloat(digits)
  if (isNaN(n)) return null
  return negative ? -n : n
}

export function parseDate(raw: string): string | null {
  if (!raw || raw.trim() === '') return null
  const s = raw.trim()
  if (s === '0/00/00') return null
  return s
}

function inferCategory(remarks: string, docType: string): RowCategory {
  const r = remarks.toUpperCase()
  if (docType === 'RU' || r.includes('UNAPPLIED D.D')) return 'carry_forward'
  if (docType === 'RI' || r.includes('ADV/FF')) return 'adv_ff_fee'
  if (docType === 'SO') return 'sales_order'
  if (docType === 'RM') return 'rebate_credit'
  if (docType === 'SR') return 'sales_return'
  return 'needs_review'
}

function isCarryForward(remarks: string, docType: string): boolean {
  return docType === 'RU' || /unapplied\s*d\.?d\.?/i.test(remarks)
}

// Extracts the prior report date from a carry-forward remark.
// e.g. "unapplied D.D. 6-11-26" → "6/11/26"
//      "unapplied D.D.6-4-26"   → "6/4/26"
export function extractPriorReportDate(remarks: string): string | null {
  const m = remarks.match(/(\d{1,2})-(\d{1,2})-(\d{2,4})/)
  if (!m) return null
  return `${m[1]}/${m[2]}/${m[3]}`
}

export function parseHeader(lines: string[]): ReportHeader | null {
  for (const line of lines) {
    // Pattern: R03989   Run   Date   6/15/26   TIME: 14:24:44   P R E A U T H O R I Z E D   D E B I T   Page No:   1
    const m = line.match(
      /^(R\d+)\s+Run\s+Date\s+(\S+)\s+TIME:\s*(\S+).*Page\s+No[.:]?\s*(\d+)/i
    )
    if (m) {
      return {
        reportNumber: m[1],
        runDate: m[2],
        runTime: m[3],
        customerName: 'Pinch A Penny #144',
        pageNumber: parseInt(m[4], 10),
      }
    }
  }
  return null
}

// Known doc type tokens
const DOC_TYPES = new Set(['SO', 'RM', 'RU', 'RI', 'SR', 'SB', 'RB'])

// The raw text from pdfjs comes as a single space-joined line per page.
// We need to split it into logical report rows.
// Strategy: tokenize the full text and reconstruct rows by finding the
// 3-digit customer number anchors and CUSTOMER TOTAL sentinel.
export function parseReport(rawText: string): ParsedReport {
  const errors: string[] = []

  // Normalize: collapse multiple spaces to single, trim
  const normalized = rawText.replace(/\r\n/g, '\n').trim()

  // Split into lines for header extraction
  const allLines = normalized
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const header = parseHeader(allLines)
  if (!header) errors.push('Could not parse report header')

  // Work with the full text as tokens for row parsing
  // The PDF text extraction joins all content on a line with spaces
  const fullText = allLines.join(' ')
  const tokens = fullText.split(/\s+/)

  const lineItems: LineItem[] = []
  let customerTotal: CustomerTotal | null = null

  let i = 0
  while (i < tokens.length) {
    // Look for CUSTOMER TOTAL
    if (
      tokens[i] === 'CUSTOMER' &&
      tokens[i + 1] === 'TOTAL'
    ) {
      const remaining = tokens.slice(i + 2)
      const amounts = extractTrailingAmounts(remaining, 3)
      customerTotal = {
        openAmount: amounts[0],
        discountAvailable: amounts[1],
        netAmountDue: amounts[2],
        rawText: tokens.slice(i).join(' '),
      }
      break
    }

    // Look for a data row: starts with "144" (customer number)
    if (tokens[i] === '144' && i + 1 < tokens.length) {
      const rowStartIdx = i
      // Find the next occurrence of "144" or "CUSTOMER" to bound this row
      let rowEndIdx = tokens.length
      for (let j = i + 1; j < tokens.length; j++) {
        if (
          (tokens[j] === '144') ||
          (tokens[j] === 'CUSTOMER' && tokens[j + 1] === 'TOTAL')
        ) {
          rowEndIdx = j
          break
        }
      }
      const rowTokens = tokens.slice(rowStartIdx, rowEndIdx)
      const item = parseLineItemTokens(rowTokens, errors)
      if (item) lineItems.push(item)
      i = rowEndIdx
      continue
    }
    i++
  }

  const validation = customerTotal
    ? validateTotals(lineItems, customerTotal)
    : null

  return {
    header,
    lineItems,
    customerTotal,
    validation,
    parseErrors: errors,
    rawText,
  }
}

// Given the tokens of a single row starting with "144", parse into a LineItem
function parseLineItemTokens(
  tokens: string[],
  errors: string[]
): LineItem | null {
  // tokens[0] = "144"
  // Format: 144  [docNumber?] remarks...  DOCTYPE  docNumber  paymentTerm  invoiceDate  dueDate  discountDueDate  openAmount  [discountAvailable]  netAmountDue
  // The tricky part: remarks can be multi-word and may include doc number prefix

  // Find the docType position - it's a known 2-char type
  let docTypeIdx = -1
  for (let i = 1; i < tokens.length; i++) {
    if (DOC_TYPES.has(tokens[i])) {
      docTypeIdx = i
      break
    }
  }
  if (docTypeIdx === -1) {
    errors.push(`Could not find doc type in row: ${tokens.join(' ')}`)
    return null
  }

  const docType = tokens[docTypeIdx]
  // Remarks = everything between "144" and docType
  const remarkTokens = tokens.slice(1, docTypeIdx)
  const remarks = remarkTokens.join(' ').trim()

  // After docType: docNumber paymentTerm invoiceDate dueDate discountDueDate amounts...
  const after = tokens.slice(docTypeIdx + 1)
  if (after.length < 2) {
    errors.push(`Too few tokens after doc type in row: ${tokens.join(' ')}`)
    return null
  }

  const docNumber = after[0]
  const paymentTerm = after[1]

  // Remaining: dates and amounts
  // Dates look like M/DD/YY; amounts look like digits with commas/decimals/trailing minus
  const rest = after.slice(2)
  const dates: string[] = []
  let amountStartIdx = rest.length

  for (let i = 0; i < rest.length; i++) {
    if (/^\d+\/\d+\/\d+$/.test(rest[i])) {
      dates.push(rest[i])
    } else {
      amountStartIdx = i
      break
    }
  }

  const invoiceDate = parseDate(dates[0] ?? '')
  const dueDate = parseDate(dates[1] ?? '')
  const discountDueDate = parseDate(dates[2] ?? '')

  const amountTokens = rest.slice(amountStartIdx)
  const parsedAmounts = collectAmounts(amountTokens)

  // Rows with 3 amounts: open, discount, net
  // Rows with 2 amounts: open, net (discount column is blank in the PDF)
  // Rows with 1 amount: open only
  let openAmount: number | null = null
  let discountAvailable: number | null = null
  let netAmountDue: number | null = null

  if (parsedAmounts.length === 3) {
    openAmount = parsedAmounts[0]
    discountAvailable = parsedAmounts[1]
    netAmountDue = parsedAmounts[2]
  } else if (parsedAmounts.length === 2) {
    openAmount = parsedAmounts[0]
    discountAvailable = null
    netAmountDue = parsedAmounts[1]
  } else if (parsedAmounts.length === 1) {
    openAmount = parsedAmounts[0]
  }

  const cat = inferCategory(remarks, docType)
  const cf = isCarryForward(remarks, docType)
  const priorReportDate = cf ? extractPriorReportDate(remarks) : null

  const rowWarnings: string[] = []
  if (cat === 'needs_review') rowWarnings.push('Unmapped row — needs review')
  if (cf) rowWarnings.push('Carry-forward/unapplied debit row')

  return {
    customerNumber: '144',
    remarks,
    docType,
    docNumber,
    paymentTerm,
    invoiceDate,
    dueDate,
    discountDueDate,
    openAmount,
    discountAvailable,
    netAmountDue,
    rawText: tokens.join(' '),
    rowCategory: cat,
    isCarryForward: cf,
    priorReportDate,
    warnings: rowWarnings,
  }
}

// Returns all money-like values found in the token list (no padding to fixed length)
function collectAmounts(tokens: string[]): number[] {
  const result: number[] = []
  for (const t of tokens) {
    const v = parseAmount(t)
    if (v !== null && /^(?:\d[\d,]*(?:\.\d+)?|\.\d+)-?$/.test(t.trim())) {
      result.push(v)
    }
  }
  return result
}

// For CUSTOMER TOTAL, pad to fixed length since all 3 columns are always present
function extractTrailingAmounts(
  tokens: string[],
  maxCount: number
): (number | null)[] {
  const result: (number | null)[] = []
  for (const t of tokens) {
    if (result.length >= maxCount) break
    const v = parseAmount(t)
    if (v !== null && /^(?:\d[\d,]*(?:\.\d+)?|\.\d+)-?$/.test(t.trim())) {
      result.push(v)
    }
  }
  while (result.length < maxCount) result.push(null)
  return result
}

function sum(items: (number | null)[]): number {
  return items.reduce<number>((acc, v) => acc + (v ?? 0), 0)
}

function validateTotals(
  items: LineItem[],
  total: CustomerTotal
): ValidationResult {
  const sumOpen = sum(items.map((r) => r.openAmount))
  const sumDiscount = sum(items.map((r) => r.discountAvailable))
  const sumNet = sum(items.map((r) => r.netAmountDue))

  const openDiff = Math.abs(sumOpen - (total.openAmount ?? 0))
  const discDiff = Math.abs(sumDiscount - (total.discountAvailable ?? 0))
  const netDiff = Math.abs(sumNet - (total.netAmountDue ?? 0))

  return {
    openAmountMatch: openDiff <= ROUNDING_TOLERANCE,
    discountMatch: discDiff <= ROUNDING_TOLERANCE,
    netAmountMatch: netDiff <= ROUNDING_TOLERANCE,
    openAmountDiff: openDiff,
    discountDiff: discDiff,
    netAmountDiff: netDiff,
  }
}
