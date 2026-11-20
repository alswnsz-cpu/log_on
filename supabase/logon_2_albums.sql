-- LOG:ON 2단계: 앨범 (albums, album_photos)
-- ※ add_logon_tables.sql 을 단계별로 나눈 3개 파일 중 두 번째. schema.sql 실행 후 이것을 실행. 실행 전 반드시 백업.
--   1단계(logon_1_portfolio.sql)와는 서로 의존하지 않는다. 사진 파일 저장소는 3단계(logon_3_photo_storage.sql).
--
-- LOG:ON 의 권한 함수를 이 앱의 함수로 대응시켰다.
--   is_active_member() → is_approved()   (승인된 회원)
--   is_logon_admin()   → is_officer()    (임원진 = 회장·부회장)
-- 개인정보 규칙
--   · 앨범·사진: 승인된 회원은 읽기, 임원진만 추가·수정·삭제

-- ============================================================
-- 1. 테이블
-- ============================================================

-- 앨범 작성자는 회원 삭제 시 앨범·사진이 남도록 set null (원본은 on delete 규칙이 없었다)
create table public.albums (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 200),
  description text check (description is null or char_length(description) <= 2000),
  category    text not null default '동아리 활동' check (char_length(category) between 1 and 100),
  cover_path  text,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.album_photos (
  id           uuid primary key default gen_random_uuid(),
  album_id     uuid not null references public.albums (id) on delete cascade,
  storage_path text not null,
  caption      text check (caption is null or char_length(caption) <= 500),
  uploaded_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index album_photos_album_idx on public.album_photos (album_id);

-- ============================================================
-- 2. 권한과 RLS
-- ============================================================

alter table public.albums       enable row level security;
alter table public.album_photos enable row level security;

revoke all on public.albums, public.album_photos from public, anon, authenticated;

grant select, insert, update, delete on public.albums       to authenticated;
grant select, insert, update, delete on public.album_photos to authenticated;

-- 2-2. 앨범: 승인된 회원 읽기 / 임원진만 쓰기
create policy albums_select on public.albums
  for select to authenticated using (public.is_approved());
create policy albums_insert on public.albums
  for insert to authenticated with check (public.is_officer() and created_by = auth.uid());
create policy albums_update on public.albums
  for update to authenticated using (public.is_officer()) with check (public.is_officer());
create policy albums_delete on public.albums
  for delete to authenticated using (public.is_officer());

create policy album_photos_select on public.album_photos
  for select to authenticated using (public.is_approved());
create policy album_photos_insert on public.album_photos
  for insert to authenticated with check (public.is_officer() and uploaded_by = auth.uid());
create policy album_photos_update on public.album_photos
  for update to authenticated using (public.is_officer()) with check (public.is_officer());
create policy album_photos_delete on public.album_photos
  for delete to authenticated using (public.is_officer());

-- ============================================================
-- [R] 되돌리기 (이 2단계에 문제가 있을 때만 실행)
-- ============================================================
-- 3단계(logon_3_photo_storage.sql)까지 실행했다면 3단계 되돌리기를 먼저 하고 이것을 실행한다.
-- 테이블을 지우면 그 테이블의 정책과 인덱스도 함께 지워진다.
-- 만들어 둔 앨범과 사진 목록 데이터가 모두 사라지므로 먼저 백업한다.
-- drop table public.album_photos, public.albums;
