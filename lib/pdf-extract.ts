// Server-side PDF text extraction using pdfjs-dist

export async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')

  const data = new Uint8Array(buffer)
  const doc = await getDocument({ data }).promise

  const pageTexts: string[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    const lineText = content.items.map((item) => ('str' in item ? item.str : '')).join(' ')
    pageTexts.push(lineText)
  }

  return pageTexts.join('\n')
}
