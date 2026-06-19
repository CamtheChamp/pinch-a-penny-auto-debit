// Server-side PDF text extraction using pdfjs-dist (worker disabled for serverless)

export async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')

  // Disable the worker — required for serverless/edge environments with no worker thread support
  pdfjsLib.GlobalWorkerOptions.workerSrc = ''

  const data = new Uint8Array(buffer)
  const doc = await pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
    disableRange: true,
    disableStream: true,
    disableAutoFetch: true,
  }).promise

  const pageTexts: string[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    const lineText = content.items.map((item) => ('str' in item ? item.str : '')).join(' ')
    pageTexts.push(lineText)
  }

  return pageTexts.join('\n')
}
