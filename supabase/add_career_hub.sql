-- LOG:ON Career Hub: 신규 테이블 및 RLS. schema.sql 선행.
-- 관리자만 실행. 운영 적용 전 백업 및 시험 DB 검증.
begin;
create table public.career_posts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid default auth.uid() references public.profiles(id) on delete set null,
 kind text not null check (kind in ('기업 탐색','직무 탐색','채용 정보','취업 인사이트')),
 field text not null check (field in ('SCM·공급망 관리','해운·항만','항공물류','포워딩·국제물류','유통·풀필먼트','무역·통관','물류 IT·데이터','구매·조달','기타')),
 title text not null check (char_length(btrim(title)) between 1 and 200),
 company text not null default '' check (char_length(company)<=200),
 job_title text not null default '' check (char_length(job_title)<=200),
 employment_type text not null default '' check (employment_type in ('','인턴','신입','경력','기타')),
 description text not null check (char_length(btrim(description)) between 1 and 5000),
 duties text not null default '' check (char_length(duties)<=3000),
 qualifications text not null default '' check (char_length(qualifications)<=3000),
 skills text not null default '' check (char_length(skills)<=2000),
 certifications text not null default '' check (char_length(certifications)<=2000),
 preferred text not null default '' check (char_length(preferred)<=2000),
 deadline date,
 source_url text check (char_length(source_url)<=2048 and source_url ~* '^https?://[^[:space:]]+$'),
 created_at timestamptz not null default now(),
 check (kind <> '기업 탐색' or char_length(btrim(company))>0),
 check (kind <> '직무 탐색' or char_length(btrim(job_title))>0),
 check (kind <> '채용 정보' or (char_length(btrim(company))>0 and char_length(btrim(job_title))>0 and employment_type<>'' and source_url is not null)),
 check (kind = '채용 정보' or (deadline is null and employment_type=''))
);
create table public.career_comments (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.career_posts(id) on delete cascade,
 user_id uuid default auth.uid() references public.profiles(id) on delete set null,
 content text not null check (char_length(btrim(content)) between 1 and 1000),
 created_at timestamptz not null default now()
);
create table public.career_bookmarks (
 post_id uuid not null references public.career_posts(id) on delete cascade,
 user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
 primary key(post_id,user_id)
);
create index career_posts_kind_created_idx on public.career_posts(kind,created_at desc);
create index career_posts_deadline_idx on public.career_posts(deadline) where kind='채용 정보';
create index career_posts_user_idx on public.career_posts(user_id);
create index career_comments_post_idx on public.career_comments(post_id,created_at);
create index career_comments_user_idx on public.career_comments(user_id);
create index career_bookmarks_user_idx on public.career_bookmarks(user_id);
alter table public.career_posts enable row level security;
alter table public.career_comments enable row level security;
alter table public.career_bookmarks enable row level security;
revoke all on public.career_posts,public.career_comments,public.career_bookmarks from public,anon,authenticated;
grant select,delete on public.career_posts,public.career_comments,public.career_bookmarks to authenticated;
grant insert(kind,field,title,company,job_title,employment_type,description,duties,qualifications,skills,certifications,preferred,deadline,source_url), update(kind,field,title,company,job_title,employment_type,description,duties,qualifications,skills,certifications,preferred,deadline,source_url) on public.career_posts to authenticated;
grant insert(post_id,content),update(content) on public.career_comments to authenticated;
grant insert(post_id) on public.career_bookmarks to authenticated;
create policy career_posts_read on public.career_posts for select to authenticated using (public.is_approved());
create policy career_posts_insert on public.career_posts for insert to authenticated with check (public.is_approved() and user_id=auth.uid());
create policy career_posts_update on public.career_posts for update to authenticated using (public.is_approved() and user_id=auth.uid()) with check (public.is_approved() and user_id=auth.uid());
create policy career_posts_delete on public.career_posts for delete to authenticated using (public.is_approved() and (user_id=auth.uid() or public.is_officer()));
create policy career_comments_read on public.career_comments for select to authenticated using (public.is_approved());
create policy career_comments_insert on public.career_comments for insert to authenticated with check (public.is_approved() and user_id=auth.uid());
create policy career_comments_update on public.career_comments for update to authenticated using (public.is_approved() and user_id=auth.uid()) with check (public.is_approved() and user_id=auth.uid());
create policy career_comments_delete on public.career_comments for delete to authenticated using (public.is_approved() and (user_id=auth.uid() or public.is_officer()));
create policy career_bookmarks_read on public.career_bookmarks for select to authenticated using (public.is_approved() and user_id=auth.uid());
create policy career_bookmarks_insert on public.career_bookmarks for insert to authenticated with check (public.is_approved() and user_id=auth.uid());
create policy career_bookmarks_delete on public.career_bookmarks for delete to authenticated using (public.is_approved() and user_id=auth.uid());
commit;
-- [R] 관리자: 프런트 제거 및 신규 데이터 백업 후 실행.
-- drop table public.career_bookmarks,public.career_comments,public.career_posts;
