-- LOG:ON Resource Library. Requires schema.sql and existing approval helpers.
-- 관리자만 실행. 운영 적용 전 백업 및 시험 DB 검증.
begin;
create table public.library_resources (
 id uuid primary key default gen_random_uuid(),
 user_id uuid default auth.uid() references public.profiles(id) on delete set null,
 title text not null check (char_length(btrim(title)) between 1 and 200),
 description text not null default '' check (char_length(description) <= 3000),
 category text not null check (category in ('전공 학습','자격증','데이터 분석','토론·발표','공모전','취업·직무','기타')),
 source_url text check (char_length(source_url) <= 2048 and source_url ~* '^https?://[^[:space:]]+$'),
 rights_confirmed boolean not null check (rights_confirmed),
 created_at timestamptz not null default now()
);
create table public.library_files (
 id uuid primary key default gen_random_uuid(),
 resource_id uuid not null references public.library_resources(id) on delete restrict,
 slot smallint not null check (slot between 1 and 3),
 file_name text not null check (char_length(file_name) between 1 and 255),
 storage_path text not null unique,
 size_bytes bigint not null check (size_bytes between 1 and 20971520),
 unique(resource_id,slot),
 check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|hwp|hwpx|pptx|docx|xlsx|csv)$'),
 check (split_part(storage_path,'/',2) = resource_id::text)
);
create table public.library_bookmarks (
 resource_id uuid not null references public.library_resources(id) on delete cascade,
 user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
 primary key(resource_id,user_id)
);
create index library_resources_created_idx on public.library_resources(created_at desc);
create index library_resources_user_idx on public.library_resources(user_id);
create index library_bookmarks_user_idx on public.library_bookmarks(user_id);
alter table public.library_resources enable row level security;
alter table public.library_files enable row level security;
alter table public.library_bookmarks enable row level security;
revoke all on public.library_resources,public.library_files,public.library_bookmarks from public,anon,authenticated;
grant select,delete on public.library_resources,public.library_files,public.library_bookmarks to authenticated;
grant insert(title,description,category,source_url,rights_confirmed),update(title,description,category,source_url,rights_confirmed) on public.library_resources to authenticated;
grant insert(resource_id,slot,file_name,storage_path,size_bytes) on public.library_files to authenticated;
grant insert(resource_id) on public.library_bookmarks to authenticated;
create policy library_resources_read on public.library_resources for select to authenticated using (public.is_approved());
create policy library_resources_insert on public.library_resources for insert to authenticated with check (public.is_approved() and user_id=auth.uid());
create policy library_resources_update on public.library_resources for update to authenticated using (public.is_approved() and user_id=auth.uid()) with check (public.is_approved() and user_id=auth.uid());
create policy library_resources_delete on public.library_resources for delete to authenticated using (public.is_approved() and (user_id=auth.uid() or public.is_officer()));
create policy library_files_read on public.library_files for select to authenticated using (public.is_approved());
create policy library_files_insert on public.library_files for insert to authenticated with check (public.is_approved() and split_part(storage_path,'/',1)=auth.uid()::text and exists (select 1 from public.library_resources r where r.id=resource_id and r.user_id=auth.uid()));
create policy library_files_delete on public.library_files for delete to authenticated using (public.is_approved() and (public.is_officer() or exists (select 1 from public.library_resources r where r.id=resource_id and r.user_id=auth.uid())));
create policy library_bookmarks_read on public.library_bookmarks for select to authenticated using (public.is_approved() and user_id=auth.uid());
create policy library_bookmarks_insert on public.library_bookmarks for insert to authenticated with check (public.is_approved() and user_id=auth.uid());
create policy library_bookmarks_delete on public.library_bookmarks for delete to authenticated using (public.is_approved() and user_id=auth.uid());
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('logon-resources','logon-resources',false,20971520,array['application/pdf','application/x-hwp','application/haansofthwp','application/vnd.hancom.hwp','application/hwp+zip','application/vnd.hancom.hwpx','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv','application/vnd.ms-excel','application/octet-stream']);
-- Reserve attachment row before upload. Only registered paths may be uploaded/read.
create policy library_storage_read on storage.objects for select to authenticated using (bucket_id='logon-resources' and public.is_approved() and (exists(select 1 from public.library_files f where f.storage_path=name) or split_part(name,'/',1)=auth.uid()::text or public.is_officer()));
create policy library_storage_insert on storage.objects for insert to authenticated with check (bucket_id='logon-resources' and public.is_approved() and split_part(name,'/',1)=auth.uid()::text and exists(select 1 from public.library_files f join public.library_resources r on r.id=f.resource_id where f.storage_path=name and r.user_id=auth.uid()));
-- Delete file first, then metadata; retain failed paths for retry. No upsert/update.
create policy library_storage_delete on storage.objects for delete to authenticated using (bucket_id='logon-resources' and public.is_approved() and (split_part(name,'/',1)=auth.uid()::text or public.is_officer()));
commit;
-- [R] 관리자: 프런트 제거 및 백업 후 Storage API/대시보드로 버킷 파일을 먼저 비운다.
-- drop policy library_storage_read on storage.objects;
-- drop policy library_storage_insert on storage.objects;
-- drop policy library_storage_delete on storage.objects;
-- delete from storage.buckets where id='logon-resources';
-- drop table public.library_bookmarks,public.library_files,public.library_resources;
