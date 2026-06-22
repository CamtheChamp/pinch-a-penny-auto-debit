import { getServerSupabase } from '@/lib/supabase-server'
import { sameReportDate } from '@/lib/report-dates'

export interface UploadWithPrerequisite {
  id: string
  file_name: string
  prerequisite_date: string | null
  prerequisite_upload_id: string | null
}

export interface ReportHeaderSummary {
  report_number: string | null
  run_date: string | null
}

export interface ReportChainNode {
  upload: UploadWithPrerequisite
  header: ReportHeaderSummary | null
}

export interface ReportChainResult {
  reports: ReportChainNode[]
  unresolvedDate: string | null
  cycleDetected: boolean
}

export async function resolvePrerequisiteChain(
  upload: UploadWithPrerequisite,
  userId: string,
): Promise<ReportChainResult> {
  const db = await getServerSupabase()
  const reports: ReportChainNode[] = []
  const seen = new Set<string>([upload.id])
  let current = upload

  while (current.prerequisite_date) {
    const prerequisiteUploadId = current.prerequisite_upload_id ?? await findUploadIdByRunDate(current.prerequisite_date, userId)

    if (!prerequisiteUploadId) {
      return { reports, unresolvedDate: current.prerequisite_date, cycleDetected: false }
    }

    if (seen.has(prerequisiteUploadId)) {
      return { reports, unresolvedDate: null, cycleDetected: true }
    }
    seen.add(prerequisiteUploadId)

    const { data: priorUpload, error } = await db
      .from('pdf_uploads')
      .select('id, file_name, prerequisite_date, prerequisite_upload_id')
      .eq('id', prerequisiteUploadId)
      .eq('user_id', userId)
      .single()

    if (error || !priorUpload) {
      return { reports, unresolvedDate: current.prerequisite_date, cycleDetected: false }
    }

    const prior = priorUpload as UploadWithPrerequisite
    const { data: priorHeader } = await db
      .from('report_headers')
      .select('report_number, run_date')
      .eq('upload_id', prior.id)
      .eq('user_id', userId)
      .single()

    reports.unshift({
      upload: prior,
      header: (priorHeader as ReportHeaderSummary | null) ?? null,
    })

    current = prior
  }

  return { reports, unresolvedDate: null, cycleDetected: false }
}

async function findUploadIdByRunDate(runDate: string, userId: string): Promise<string | null> {
  const db = await getServerSupabase()
  const { data: headers } = await db
    .from('report_headers')
    .select('upload_id, run_date')
    .eq('user_id', userId)

  const match = headers?.find((header: { upload_id: string; run_date: string | null }) =>
    sameReportDate(header.run_date, runDate)
  )

  return match?.upload_id ?? null
}
