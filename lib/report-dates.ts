export function normalizeReportDate(date: string | null | undefined): string | null {
  if (!date) return null

  const parts = date.trim().split(/[/-]/)
  if (parts.length !== 3) return date.trim()

  const [month, day, year] = parts
  const monthNumber = Number.parseInt(month, 10)
  const dayNumber = Number.parseInt(day, 10)

  if (!Number.isFinite(monthNumber) || !Number.isFinite(dayNumber) || !year) {
    return date.trim()
  }

  return `${monthNumber}/${dayNumber}/${year}`
}

export function sameReportDate(a: string | null | undefined, b: string | null | undefined): boolean {
  const normalizedA = normalizeReportDate(a)
  const normalizedB = normalizeReportDate(b)
  return !!normalizedA && !!normalizedB && normalizedA === normalizedB
}
