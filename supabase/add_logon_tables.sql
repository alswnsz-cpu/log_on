-- 추가용 SQL: LOG:ON 포트폴리오·앨범 (schema.sql 실행 후 이것을 실행)
-- ※ LOG:ON 의 Storage 정책·버킷·컬럼 제약과 대조 완료. 실행 전 반드시 백업.
--   원본과 다른 점: created_by·uploaded_by 가 비어도 되고(on delete set null),
--   글자 수 제한(check)을 추가했다.
--
-- LOG:ON 의 권한 함수를 이 앱의 함수로 대응시켰다.
--   is_active_member() → is_approved()   (승인된 회원)
--   is_logon_admin()   → is_officer()    (임원진 = 회장·부회장)
-- 개인정보 규칙
--   · 포트폴리오·자격증·활동: 본인만 읽기·쓰기 (임원진도 다른 사람 것은 볼 수 없다)
--   · 앨범·사진: 승인된 회원은 읽기, 임원진만 추가·수정·삭제
--   · 사진 파일: 비공개 버킷 logon-photos (공개 URL 없음)

-- ============================================================
-- 1. 테이블
-- ============================================================

create table public.portfolios (
  user_id    uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  content    jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.certifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 200),
  issuer        text check (issuer is null or char_length(issuer) <= 200),
  acquired_date date,
  details       text check (details is null or char_length(details) <= 2000),
  created_at    timestamptz not null default now()
);

create table public.activities (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 200),
  category    text check (category is null or char_length(category) <= 100),
  description text check (description is null or char_length(description) <= 4000),
  started_on  date,
  ended_on    date,
  created_at  timestamptz not null default now(),
  check (ended_on is null or started_on is null or ended_on >= started_on)
);

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

create index certifications_user_idx on public.certifications (user_id);
create index activities_user_idx     on public.activities (user_id);
create index album_photos_album_idx  on public.album_photos (album_id);

-- ============================================================
-- 2. 권한과 RLS
-- ============================================================

alter table public.portfolios     enable row level security;
alter table public.certifications enable row level security;
alter table public.activities     enable row level security;
alter table public.albums         enable row level security;
alter table public.album_photos   enable row level security;

revoke all on public.portfolios, public.certifications, public.activities,
              public.albums, public.album_photos from public, anon, authenticated;

-- portfolios 는 삭제 정책 없음 (원본과 동일)
grant select, insert, update         on public.portfolios     to authenticated;
grant select, insert, update, delete on public.certifications to authenticated;
grant select, insert, update, delete on public.activities     to authenticated;
grant select, insert, update, delete on public.albums         to authenticated;
grant select, insert, update, delete on public.album_photos   to authenticated;

-- 2-1. 개인 데이터: 본인만 (임원진 예외 없음)
create policy portfolios_select on public.portfolios
  for select to authenticated using (public.is_approved() and user_id = auth.uid());
create policy portfolios_insert on public.portfolios
  for insert to authenticated with check (public.is_approved() and user_id = auth.uid());
create policy portfolios_update on public.portfolios
  for update to authenticated
  using (public.is_approved() and user_id = auth.uid())
  with check (public.is_approved() and user_id = auth.uid());

create policy certifications_select on public.certifications
  for select to authenticated using (public.is_approved() and user_id = auth.uid());
create policy certifications_insert on public.certifications
  for insert to authenticated with check (public.is_approved() and user_id = auth.uid());
create policy certifications_update on public.certifications
  for update to authenticated
  using (public.is_approved() and user_id = auth.uid())
  with check (public.is_approved() and user_id = auth.uid());
create policy certifications_delete on public.certifications
  for delete to authenticated using (public.is_approved() and user_id = auth.uid());

create policy activities_select on public.activities
  for select to authenticated using (public.is_approved() and user_id = auth.uid());
create policy activities_insert on public.activities
  for insert to authenticated with check (public.is_approved() and user_id = auth.uid());
create policy activities_update on public.activities
  for update to authenticated
  using (public.is_approved() and user_id = auth.uid())
  with check (public.is_approved() and user_id = auth.uid());
create policy activities_delete on public.activities
  for delete to authenticated using (public.is_approved() and user_id = auth.uid());

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
-- [R] 되돌리기 (문제가 있을 때만 실행)
-- ============================================================
-- drop policy logon_photos_select on storage.objects;
-- drop policy logon_photos_insert on storage.objects;
-- drop policy logon_photos_update on storage.objects;
-- drop policy logon_photos_delete on storage.objects;
-- delete from storage.buckets where id = 'logon-photos';  -- 파일이 있으면 먼저 비워야 한다
-- drop table public.album_photos, public.albums, public.activities,
--            public.certifications, public.portfolios;
