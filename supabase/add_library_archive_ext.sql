-- 자료실 첨부파일에 압축파일(zip, 7z) 허용 (35번)
-- library_files.storage_path 의 "확장자 CHECK 제약"만 교체한다.
--   · 기존: ...\.(pdf|hwp|hwpx|pptx|docx|xlsx|csv)$
--   · 변경: ...\.(pdf|hwp|hwpx|pptx|docx|xlsx|csv|zip|7z)$
-- 기존 제약은 add_resource_library.sql 에서 이름 없이 만들어져 PostgreSQL이 이름을 자동으로 붙였다
--   (보통 library_files_storage_path_check). 이름을 확신할 수 없어서, 아래에서 "정의에 pdf|hwp|hwpx 가 들어 있는
--   library_files 의 CHECK 제약"을 찾아 지운 뒤 새 이름(library_files_storage_path_ext_check)으로 다시 만든다.
-- 기존 행은 모두 통과한다: 새 제약은 기존 확장자 7개를 그대로 포함한 상위 집합이라 기존 데이터가 바뀌거나 막히지 않는다.
-- 건드리지 않는 것: 테이블·컬럼·데이터·RLS 정책·스토리지 정책, 버킷 설정(file_size_limit, allowed_mime_types).
--   (압축파일은 화면에서 application/octet-stream 으로 올리며, 버킷은 이미 octet-stream 을 허용한다.)
-- 같은 테이블의 다른 CHECK(경로 두 번째 칸 = resource_id 등)는 정의가 달라 건드리지 않는다.
-- 실행: SQL Editor에서 사람이 한 번 실행한다(운영 미적용). 화면(프런트)은 이 SQL을 실행한 뒤에 배포한다.
-- 사용하는 기존 객체: public.library_files (add_resource_library.sql, 31번)

begin;

do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.library_files'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%pdf|hwp|hwpx|pptx|docx|xlsx|csv%'
  loop
    execute format('alter table public.library_files drop constraint %I', c.conname);
  end loop;
end
$$;

alter table public.library_files drop constraint if exists library_files_storage_path_ext_check;

alter table public.library_files
  add constraint library_files_storage_path_ext_check
  check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|hwp|hwpx|pptx|docx|xlsx|csv|zip|7z)$');

commit;

-- ============================================================
-- [R] 되돌리기 (zip, 7z 첨부가 이미 올라간 뒤에는 원래 제약을 걸 수 없다. 먼저 해당 첨부 행과 파일을 지운다)
-- ============================================================
-- begin;
-- alter table public.library_files drop constraint if exists library_files_storage_path_ext_check;
-- alter table public.library_files
--   add constraint library_files_storage_path_check
--   check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|hwp|hwpx|pptx|docx|xlsx|csv)$');
-- commit;
