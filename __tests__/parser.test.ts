import { parseAmount, parseDate, parseReport } from '../lib/parser'

// Raw text extracted from the 4 sample PDFs via pdfjs-dist
const PDF1_TEXT = `R03989   Run   Date   6/15/26   TIME: 14:24:44   P R E A U T H O R I Z E D   D E B I T   Page No:   1 Customer   Doc   Doc   Pmt   Invoice   Due   Discount   Open   Discount   Net Amount Number   Remarks   Type   Number   Term   Date   Date   Due Date   Amount   Available   Due Pinch A Penny #144 144   unapplied D.D. 6-11-26   RU   73444   6/11/26   6/11/26   6/11/26   1,224.64-   1,224.64- 144   21258924 (Sales Order)   SO   2807507   )   6/07/26   6/16/26   6/15/26   1,668.51   83.42   1,585.09 144   21258932 (Sales Order)   SO   2807508   )   6/07/26   6/16/26   6/15/26   190.46   8.90   181.56 144   21258932 (Sales Order)   SO   2807508   )   6/07/26   6/16/26   6/15/26   16,912.60   845.64   16,066.96 144   21267521 (Sales Order)   SR   2808629   )   6/09/26   6/18/26   6/17/26   264.98-   13.26-   251.72- 144   ADV/FF FEES   RI   2810592   12   6/15/26   6/16/26   0/00/00   7,369.31   7,369.31 144   061326 PS-OF-020 REBATE   RM   2810937   )   6/13/26   6/13/26   6/13/26   2,710.37-   2,710.37- CUSTOMER TOTAL   21,940.89   924.70   21,016.19`

const PDF2_TEXT = `R03989   Run   Date   6/11/26   TIME:   9:11:52   P R E A U T H O R I Z E D   D E B I T   Page No:   1 Customer   Doc   Doc   Pmt   Invoice   Due   Discount   Open   Discount   Net Amount Number   Remarks   Type   Number   Term   Date   Date   Due Date   Amount   Available   Due Pinch A Penny #144 144   unapplied D.D. 6-8-26   RU   73440   6/08/26   6/08/26   6/08/26   1,457.27-   1,457.27- 144   21245525 (Sales Order)   SO   2806531   )   6/03/26   6/12/26   6/11/26   86.61   4.33   82.28 144   21245533 (Sales Order)   SO   2806532   )   6/03/26   6/12/26   6/11/26   158.26   7.91   150.35 CUSTOMER TOTAL   1,212.40-   12.24   1,224.64-`

const PDF3_TEXT = `R03989   Run   Date   6/08/26   TIME: 11:45:43   P R E A U T H O R I Z E D   D E B I T   Page No:   1 Customer   Doc   Doc   Pmt   Invoice   Due   Discount   Open   Discount   Net Amount Number   Remarks   Type   Number   Term   Date   Date   Due Date   Amount   Available   Due Pinch A Penny #144 144   Sun Points   IT   Purchase   RM   59601   H   6/04/26   6/05/26   6/05/26   5,377.84-   5,377.84- 144   unapplied D.D.6-4-26   RU   73410   6/04/26   6/04/26   6/04/26   2,229.98-   2,229.98- 144   21235001 (Sales Order)   SO   2804453   )   5/31/26   6/09/26   6/08/26   2,812.12   140.60   2,671.52 144   21235010 (Sales Order)   SO   2804454   )   5/31/26   6/09/26   6/08/26   1,599.04   79.96   1,519.08 144   ADV/FF FEES   RI   2807714   12   6/08/26   6/09/26   0/00/00   2,077.70   2,077.70 144   060626 PS-OF-020 REBATE   RM   2808064   )   6/06/26   6/06/26   6/06/26   117.75-   117.75- CUSTOMER TOTAL   1,236.71-   220.56   1,457.27-`

const PDF4_TEXT = `R03989   Run   Date   6/04/26   TIME:   9:53:17   P R E A U T H O R I Z E D   D E B I T   Page No:   1 Customer   Doc   Doc   Pmt   Invoice   Due   Discount   Open   Discount   Net Amount Number   Remarks   Type   Number   Term   Date   Date   Due Date   Amount   Available   Due Pinch A Penny #144 144   21223553 (Sales Order)   SO   2803360   )   5/27/26   6/05/26   6/04/26   271.18   13.56   257.62 144   21223561 (Sales Order)   SO   2803361   )   5/27/26   6/05/26   6/04/26   1,648.50   82.45   1,566.05 144   21224927 (Sales Order)   SO   2803362   )   5/27/26   6/05/26   6/04/26   78.03   3.90   74.13 144   20% Toys   RM   2805490   )   5/30/26   5/30/26   5/30/26   28.16-   28.16- 144   10% Off Select Suncoast Chem RM   2805490   )   5/30/26   5/30/26   5/30/26   319.27-   319.27- 144   15% APC Parts   RM   2805490   )   5/30/26   5/30/26   5/30/26   20.41-   20.41- 144   $75 APC Promo   Card   RM   2805490   )   5/30/26   5/30/26   5/30/26   375.00-   375.00- 144   15% Off Porpoise Maintenance RM   2805490   )   5/30/26   5/30/26   5/30/26   25.28-   25.28- 144   15% Off Porpoise Filter Elem RM   2805490   )   5/30/26   5/30/26   5/30/26   25.95-   25.95- 144   $700 OFF SunBlazer   Heating   S RM   2805490   )   5/30/26   5/30/26   5/30/26   1,050.00-   1,050.00- 144   15% Off Select Equipment   RM   2805490   )   5/30/26   5/30/26   5/30/26   1,260.39-   1,260.39- 144   $100 Polaris Instant Rebate   RM   2805490   )   5/30/26   5/30/26   5/30/26   100.00-   100.00- 144   $125 Polaris Instant Rebate   RM   2805490   )   5/30/26   5/30/26   5/30/26   500.00-   500.00- 144   10% Off Select Chemicals   RM   2806131   )   5/31/26   5/31/26   5/31/26   102.82-   102.82- 144   10% Off Select Chemicals   RM   2806131   )   5/31/26   5/31/26   5/31/26   11.98-   11.98- 144   BOGO 50% All in One 32oz   RM   2806131   )   5/31/26   5/31/26   5/31/26   57.00-   57.00- 144   BOGO 50% All in One 32oz   RM   2806131   )   5/31/26   5/31/26   5/31/26   19.00-   19.00- 144   BUY 10 GET   1 FREE   RM   2806131   )   5/31/26   5/31/26   5/31/26   214.00-   214.00- 144   15% Off   Select Maintenance   RM   2806131   )   5/31/26   5/31/26   5/31/26   18.52-   18.52- CUSTOMER TOTAL   2,130.07-   99.91   2,229.98-`

// ─── Amount parser ──────────────────────────────────────────────────────────

describe('parseAmount', () => {
  it('parses a positive with comma', () => {
    expect(parseAmount('1,648.50')).toBe(1648.5)
  })

  it('parses a simple decimal', () => {
    expect(parseAmount('82.45')).toBe(82.45)
  })

  it('parses trailing-minus as negative', () => {
    expect(parseAmount('2,229.98-')).toBe(-2229.98)
  })

  it('parses small trailing-minus', () => {
    expect(parseAmount('28.16-')).toBe(-28.16)
  })

  it('returns null for blank', () => {
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('   ')).toBeNull()
  })

  it('returns null for date-like pattern', () => {
    expect(parseAmount('0/00/00')).toBeNull()
    expect(parseAmount('6/15/26')).toBeNull()
  })
})

// ─── Date parser ────────────────────────────────────────────────────────────

describe('parseDate', () => {
  it('returns null for 0/00/00 placeholder', () => {
    expect(parseDate('0/00/00')).toBeNull()
  })

  it('returns valid date strings unchanged', () => {
    expect(parseDate('6/15/26')).toBe('6/15/26')
  })

  it('returns null for empty string', () => {
    expect(parseDate('')).toBeNull()
  })
})

// ─── Report header ──────────────────────────────────────────────────────────

describe('parseReport - header', () => {
  it('extracts header from PDF1', () => {
    const { header } = parseReport(PDF1_TEXT)
    expect(header).not.toBeNull()
    expect(header?.reportNumber).toBe('R03989')
    expect(header?.runDate).toBe('6/15/26')
    expect(header?.runTime).toBe('14:24:44')
    expect(header?.pageNumber).toBe(1)
  })

  it('extracts header from PDF2', () => {
    const { header } = parseReport(PDF2_TEXT)
    expect(header?.runDate).toBe('6/11/26')
  })
})

// ─── Line item counts ───────────────────────────────────────────────────────

describe('parseReport - line item counts', () => {
  it('PDF1: 7 line items', () => {
    const { lineItems } = parseReport(PDF1_TEXT)
    expect(lineItems).toHaveLength(7)
  })

  it('PDF2: 3 line items', () => {
    const { lineItems } = parseReport(PDF2_TEXT)
    expect(lineItems).toHaveLength(3)
  })

  it('PDF3: 6 line items', () => {
    const { lineItems } = parseReport(PDF3_TEXT)
    expect(lineItems).toHaveLength(6)
  })

  it('PDF4: 19 line items', () => {
    const { lineItems } = parseReport(PDF4_TEXT)
    expect(lineItems).toHaveLength(19)
  })
})

// ─── Doc type parsing ───────────────────────────────────────────────────────

describe('parseReport - doc types', () => {
  it('PDF1 has SO, RU, SR, RI, RM rows', () => {
    const { lineItems } = parseReport(PDF1_TEXT)
    const types = lineItems.map((i) => i.docType)
    expect(types).toContain('SO')
    expect(types).toContain('RU')
    expect(types).toContain('SR')
    expect(types).toContain('RI')
    expect(types).toContain('RM')
  })

  it('PDF3 has RM rows', () => {
    const { lineItems } = parseReport(PDF3_TEXT)
    const types = new Set(lineItems.map((i) => i.docType))
    expect(types.has('RM')).toBe(true)
  })
})

// ─── Carry-forward detection ─────────────────────────────────────────────────

describe('parseReport - carry-forward', () => {
  it('PDF1: unapplied D.D. row flagged as carry_forward', () => {
    const { lineItems } = parseReport(PDF1_TEXT)
    const cf = lineItems.filter((i) => i.isCarryForward)
    expect(cf.length).toBeGreaterThanOrEqual(1)
    expect(cf[0].docType).toBe('RU')
  })

  it('PDF3: both RU and unapplied D.D. rows flagged', () => {
    const { lineItems } = parseReport(PDF3_TEXT)
    const cf = lineItems.filter((i) => i.isCarryForward)
    expect(cf.length).toBeGreaterThanOrEqual(1)
  })
})

// ─── Negative amount handling ────────────────────────────────────────────────

describe('parseReport - negative amounts', () => {
  it('PDF1: RU row has negative open amount', () => {
    const { lineItems } = parseReport(PDF1_TEXT)
    const ru = lineItems.find((i) => i.docType === 'RU')
    expect(ru?.openAmount).toBe(-1224.64)
  })

  it('PDF4: 20% Toys has negative open amount', () => {
    const { lineItems } = parseReport(PDF4_TEXT)
    const row = lineItems.find((i) => i.remarks.includes('20% Toys'))
    expect(row?.openAmount).toBe(-28.16)
  })
})

// ─── Customer total parsing ──────────────────────────────────────────────────

describe('parseReport - customer totals', () => {
  it('PDF1: total net amount due = 21,016.19', () => {
    const { customerTotal } = parseReport(PDF1_TEXT)
    expect(customerTotal?.netAmountDue).toBeCloseTo(21016.19, 1)
  })

  it('PDF2: total net amount due = -1,224.64', () => {
    const { customerTotal } = parseReport(PDF2_TEXT)
    expect(customerTotal?.netAmountDue).toBeCloseTo(-1224.64, 1)
  })
})

// ─── Total validation ────────────────────────────────────────────────────────

describe('parseReport - validation', () => {
  it('PDF1: validation passes', () => {
    const { validation } = parseReport(PDF1_TEXT)
    expect(validation?.openAmountMatch).toBe(true)
    expect(validation?.netAmountMatch).toBe(true)
  })

  it('PDF2: validation passes', () => {
    const { validation } = parseReport(PDF2_TEXT)
    expect(validation?.netAmountMatch).toBe(true)
  })

  it('PDF3: validation passes', () => {
    const { validation } = parseReport(PDF3_TEXT)
    expect(validation?.netAmountMatch).toBe(true)
  })

  it('PDF4: validation passes', () => {
    const { validation } = parseReport(PDF4_TEXT)
    expect(validation?.netAmountMatch).toBe(true)
  })
})
