-- 자료실 첨부 파일 1개당 크기 상한을 20MB에서 50MB로 올린다 (36번)
-- 바꾸는 것 두 가지(이 파일은 이 둘만 건드린다):
--   (a) public.library_files 의 size_bytes CHECK 제약(library_files_size_bytes_check):
--       기존 1 ~ 20971520(20MB)  →  1 ~ 52428800(50MB)
--   (b) storage.buckets 의 id = 'logon-resources' 행의 file_size_limit:
--       기존 20971520  →  52428800
-- 기존 행은 모두 통과한다: 새 범위(1~52428800)는 기존 범위(1~20971520)를 그대로 포함한 상위 집합이라
--   이미 올라간 첨부의 행과 파일은 바뀌거나 막히지 않는다.
-- 건드리지 않는 것: 다른 테이블·컬럼·데이터·RLS 정책·스토리지 정책, 버킷의 allowed_mime_types·public 설정.
-- 참고: Supabase 무료 플랜은 파일 1개 업로드 상한이 50MB이고 저장 용량은 총 1GB다. 이 값 이상으로는 올리지 않는다.
--       (대시보드 Storage 설정에 프로젝트 전체 업로드 상한이 따로 있어서, 그 값이 50MB보다 작으면 거기서도 올려야 한다.)
-- 실행: SQL Editor에서 사람이 한 번 실행한다(운영 미적용). 화면(프런트)은 이 SQL을 실행한 뒤에 배포한다.
-- 사용하는 기존 객체: public.library_files (add_resource_library.sql, 31번), storage.buckets 'logon-resources'

begin;

alter table public.library_files drop constraint if exists library_files_size_bytes_check;

alter table public.library_files
  add constraint library_files_size_bytes_check
  check (size_bytes between 1 and 52428800);

update storage.buckets
   set file_size_limit = 52428800
 where id = 'logon-resources';

commit;

-- ============================================================
-- [R] 되돌리기 (20MB로 복원)
--   20MB(20971520바이트)를 넘는 첨부가 이미 있으면 아래 add constraint 가 실패한다.
--   먼저 그런 첨부(library_files 행과 Storage 파일)를 지우거나 사람이 정리한 뒤 실행한다.
--   확인: select id, file_name, size_bytes from public.library_files where size_bytes > 20971520;
--   프런트(MAX_BYTES)를 먼저 20MB로 되돌린 뒤 실행한다.
-- ============================================================
-- begin;
-- alter table public.library_files drop constraint if exists library_files_size_bytes_check;
-- alter table public.library_files
--   add constraint library_files_size_bytes_check
--   check (size_bytes between 1 and 20971520);
-- update storage.buckets set file_size_limit = 20971520 where id = 'logon-resources';
-- commit;
