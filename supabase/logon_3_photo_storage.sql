-- LOG:ON 3단계: 사진 저장소 (logon-photos 버킷과 storage.objects 정책)
-- ※ add_logon_tables.sql 을 단계별로 나눈 3개 파일 중 세 번째. 2단계(logon_2_albums.sql)를 먼저 실행한 뒤에 실행. 실행 전 반드시 백업.
--
-- LOG:ON 의 권한 함수를 이 앱의 함수로 대응시켰다.
--   is_active_member() → is_approved()   (승인된 회원)
--   is_logon_admin()   → is_officer()    (임원진 = 회장·부회장)
-- 개인정보 규칙
--   · 사진 파일: 비공개 버킷 logon-photos (공개 URL 없음)

-- ============================================================
-- 3. 사진 저장소 (비공개 버킷)
-- ============================================================
-- 용량·형식 제한은 LOG:ON 원본과 같다 (10MB, jpeg·png·webp)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logon-photos', 'logon-photos', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy logon_photos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'logon-photos' and public.is_approved());
create policy logon_photos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'logon-photos' and public.is_officer());
create policy logon_photos_update on storage.objects
  for update to authenticated
  using (bucket_id = 'logon-photos' and public.is_officer())
  with check (bucket_id = 'logon-photos' and public.is_officer());
create policy logon_photos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'logon-photos' and public.is_officer());

-- ============================================================
-- [R] 되돌리기 (이 3단계에 문제가 있을 때만 실행)
-- ============================================================
-- 버킷에 파일이 남아 있으면 버킷을 지울 수 없으므로 먼저 Storage 화면에서 파일을 비운다.
-- drop policy logon_photos_select on storage.objects;
-- drop policy logon_photos_insert on storage.objects;
-- drop policy logon_photos_update on storage.objects;
-- drop policy logon_photos_delete on storage.objects;
-- delete from storage.buckets where id = 'logon-photos';
