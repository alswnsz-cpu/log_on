-- 자료실 버킷이 압축파일 MIME을 받도록 허용 목록에 3개를 추가한다 (37번)
-- 배경: zip 파일을 올리면 브라우저가 파일에 application/zip(또는 application/x-zip-compressed)을 붙여 보내고,
--   버킷(logon-resources)의 allowed_mime_types 에 그 값이 없어서 Storage가 업로드를 거절했다.
-- 바꾸는 것(이 파일은 이것 하나만 건드린다):
--   storage.buckets 의 id = 'logon-resources' 행의 allowed_mime_types 에
--   application/zip, application/x-zip-compressed, application/x-7z-compressed 를 "추가"한다.
-- 기존 허용 값은 모두 그대로 유지한다. 이미 들어 있는 값은 다시 넣지 않아서 여러 번 실행해도 안전하다.
-- 건드리지 않는 것: file_size_limit, public 설정, 다른 버킷, 테이블, RLS 정책, 스토리지 정책.
-- 실행: SQL Editor에서 사람이 한 번 실행한다(운영 미적용). 화면(프런트)과 순서 제약은 없다.
-- 사용하는 기존 객체: storage.buckets 'logon-resources' (add_resource_library.sql, 31번)

begin;

update storage.buckets b
   set allowed_mime_types = (
     select array_agg(distinct m)
       from unnest(coalesce(b.allowed_mime_types, '{}'::text[])
                   || array['application/zip', 'application/x-zip-compressed', 'application/x-7z-compressed']) as m
   )
 where b.id = 'logon-resources'
   and b.allowed_mime_types is not null;

commit;

-- 확인용 조회(실행 후 allowed_mime_types 에 위 3개가 보이고 file_size_limit 이 52428800 인지 본다)
select id, file_size_limit, allowed_mime_types from storage.buckets where id = 'logon-resources';

-- ============================================================
-- [R] 되돌리기 (이 파일이 추가한 3개만 제거한다)
-- ============================================================
-- begin;
-- update storage.buckets
--    set allowed_mime_types = array_remove(array_remove(array_remove(allowed_mime_types,
--          'application/zip'), 'application/x-zip-compressed'), 'application/x-7z-compressed')
--  where id = 'logon-resources';
-- commit;
