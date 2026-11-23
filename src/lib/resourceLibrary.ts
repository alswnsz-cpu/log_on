import { supabase } from './supabase'

export const LIBRARY_BUCKET = 'logon-resources'
export const MAX_FILES = 3
export const MAX_BYTES = 20 * 1024 * 1024
export const MIME: Record<string, string> = {
  pdf: 'application/pdf', hwp: 'application/x-hwp', hwpx: 'application/hwp+zip',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', csv: 'text/csv',
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
    if (file.size < 1 || file.size > MAX_BYTES) return `파일은 1바이트 이상 20MB 이하여야 합니다: ${file.name}`
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
    // Keep the reservation: an ambiguous network failure may have stored the object.
    throw new Error('파일 업로드를 확인하지 못했습니다. 자료의 첨부파일을 확인하고 삭제 후 다시 등록해 주세요.')
  }
}
export async function downloadLibraryFile(file: LibraryFile): Promise<void> {
  const result = await supabase.storage.from(LIBRARY_BUCKET).download(file.storage_path)
  if (result.error || !result.data) throw new Error('파일을 다운로드하지 못했습니다.')
  const url = URL.createObjectURL(result.data)
  const link = document.createElement('a')
  link.href = url
  link.download = file.file_name
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30000)
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
