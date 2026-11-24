import { supabase } from './supabase'

export const LIBRARY_BUCKET = 'logon-resources'
export const MAX_FILES = 3
export const MAX_BYTES = 50 * 1024 * 1024
export const MIME: Record<string, string> = {
  pdf: 'application/pdf', hwp: 'application/x-hwp', hwpx: 'application/hwp+zip',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', csv: 'text/csv',
  zip: 'application/octet-stream', '7z': 'application/octet-stream', // 압축파일은 브라우저가 MIME을 제각각 보내므로 octet-stream으로 보낸다(버킷이 허용함)
}
export const ACCEPT = Object.keys(MIME).map(ext => `.${ext}`).join(',')
export interface LibraryFile {
  id: string
  resource_id: string
  slot: number
  file_name: string
  storage_path: string
  size_bytes: number
}
export function validateFiles(files: File[], existing = 0): string | null {
  if (files.length + existing > MAX_FILES) return '첨부파일은 최대 3개까지 가능합니다.'
  for (const file of files) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!Object.hasOwn(MIME, ext)) return `지원하지 않는 파일 형식: ${file.name}`
    if (file.size < 1 || file.size > MAX_BYTES) return `파일은 1바이트 이상 50MB 이하여야 합니다: ${file.name}`
    if (file.name.length > 255) return '파일 이름은 255자 이하여야 합니다.'
  }
  return null
}
export async function uploadLibraryFile(uid: string, resourceId: string, slot: number, file: File): Promise<void> {
  const invalid = validateFiles([file])
  if (invalid) throw new Error(invalid)
  const ext = file.name.split('.').pop()!.toLowerCase()
  const path = `${uid}/${resourceId}/${crypto.randomUUID()}.${ext}`
  const record = await supabase.from('library_files').insert({ resource_id: resourceId, slot, file_name: file.name, storage_path: path, size_bytes: file.size }).select('id').single()
  if (record.error || !record.data) throw new Error('첨부파일 정보를 등록하지 못했습니다.')
  const uploaded = await supabase.storage.from(LIBRARY_BUCKET).upload(path, file, { contentType: MIME[ext], upsert: false })
  if (uploaded.error) {
    console.error('자료실 업로드 실패', uploaded.error)
    // 업로드가 실패하면 먼저 만든 목록 기록을 지운다(파일 없는 기록이 남지 않게).
    // 네트워크 오류처럼 애매한 실패에서 파일이 저장됐을 수 있으니, 저장소 파일도 함께 지워 본다(실패해도 무시).
    try { await supabase.storage.from(LIBRARY_BUCKET).remove([path]) } catch (error) { console.error('자료실 업로드 실패 후 저장소 정리 실패', error) }
    let rolledBack = false
    try {
      const deleted = await supabase.from('library_files').delete().eq('id', record.data.id).select('id')
      rolledBack = !deleted.error && !!deleted.data?.length
      if (!rolledBack) console.error('자료실 업로드 실패 후 기록 삭제 실패', deleted.error)
    } catch (error) {
      console.error('자료실 업로드 실패 후 기록 삭제 실패', error)
    }
    throw new Error(rolledBack
      ? `파일을 올리지 못했습니다(${file.name}). 다시 시도해 주세요.`
      : `파일을 올리지 못했고 목록 기록도 정리하지 못했습니다(${file.name}). 자료의 첨부파일을 삭제한 뒤 다시 등록해 주세요.`)
  }
}
function downloadErrorMessage(error: unknown): string {
  const e = error as { status?: number | string; statusCode?: number | string; message?: string; name?: string } | null
  const status = Number(e?.status ?? e?.statusCode)
  const text = (e?.message ?? '').toLowerCase()
  if (status === 401 || status === 403 || text.includes('row-level security') || text.includes('unauthorized')) return '이 파일을 내려받을 권한이 없습니다. 승인된 계정으로 로그인했는지 확인해 주세요.'
  if (status === 404 || text.includes('not found')) return '파일을 찾을 수 없습니다. 삭제되었거나 업로드가 완료되지 않았을 수 있습니다.'
  if (!Number.isFinite(status) && (text.includes('fetch') || text.includes('network') || e?.name === 'StorageUnknownError')) return '네트워크 연결을 확인한 뒤 다시 시도해 주세요.'
  return '파일을 내려받지 못했습니다. 잠시 후 다시 시도해 주세요.'
}
export async function downloadLibraryFile(file: LibraryFile): Promise<void> {
  // 파일을 Blob으로 받은 뒤 원래 이름(file_name)으로 저장한다(이름이 퍼센트 인코딩되지 않게).
  let result
  try {
    result = await supabase.storage.from(LIBRARY_BUCKET).download(file.storage_path)
  } catch (error) {
    console.error('자료실 내려받기 실패', error)
    throw new Error(downloadErrorMessage(error))
  }
  if (result.error || !result.data) {
    console.error('자료실 내려받기 실패', result.error)
    throw new Error(downloadErrorMessage(result.error))
  }
  const objectUrl = URL.createObjectURL(result.data)
  try {
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = file.file_name
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
export async function removeLibraryFile(file: LibraryFile): Promise<void> {
  const bucket = supabase.storage.from(LIBRARY_BUCKET)
  const removed = await bucket.remove([file.storage_path])
  if (removed.error) throw new Error('저장소 파일 삭제 실패. 다시 시도해 주세요.')
  if (!(removed.data ?? []).some(item => item.name === file.storage_path)) {
    // A prior successful removal or a failed upload may leave metadata only.
    const folder = file.storage_path.slice(0, file.storage_path.lastIndexOf('/'))
    const name = file.storage_path.split('/').pop()!
    const listed = await bucket.list(folder, { search: name, limit: 100 })
    if (listed.error || !listed.data || listed.data.some(item => item.name === name)) throw new Error('파일 삭제 여부를 확인하지 못했습니다. 다시 시도해 주세요.')
  }
  const deleted = await supabase.from('library_files').delete().eq('id', file.id).select('id')
  if (deleted.error || !deleted.data?.length) throw new Error('첨부파일 기록 삭제 실패. 다시 시도해 주세요.')
}
