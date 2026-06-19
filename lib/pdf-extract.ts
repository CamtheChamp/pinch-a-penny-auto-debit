// Server-side PDF text extraction using pdf-parse (pure JS, no native deps)
import pdfParse from 'pdf-parse'

export async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const result = await pdfParse(Buffer.from(buffer))
  return result.text
}
